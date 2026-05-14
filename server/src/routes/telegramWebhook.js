// Telegram Bot webhook — receives incoming messages from owners.
//
// We listen for the `/link <token>` command sent from the owner's
// personal Telegram. The token was minted by /api/telegram/generate-token
// (15-min TTL). When token matches, we bind their chat_id to the user.
//
// Webhook security: Telegram supports a custom secret token sent in the
// `X-Telegram-Bot-Api-Secret-Token` header. Validate against env to
// reject forged calls. (Set the same secret when registering the
// webhook via the setWebhook API.)
//
// POST /api/telegram/webhook
//   Body: a Telegram Update object — most relevant subfields:
//     update.message.text
//     update.message.chat.id
//     update.message.from.username, first_name

const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, run } = require('../db/schema');
const { captureException } = require('../lib/errorReporter');
const telegram = require('../lib/telegram/messenger');

const router = express.Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/webhook', webhookLimiter, async (req, res) => {
  // Always 200 OK to Telegram so it doesn't retry endlessly. Errors are
  // logged but not surfaced as 4xx/5xx.
  try {
    if (process.env.TELEGRAM_BOT_ENABLED !== 'true') {
      return res.json({ ok: true, skipped: 'not-enabled' });
    }

    // Verify the secret token header. If TELEGRAM_WEBHOOK_SECRET is set,
    // we require an exact match. Without secret set, accept all (dev mode).
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret) {
      const got = req.headers['x-telegram-bot-api-secret-token'];
      if (got !== expectedSecret) {
        return res.status(401).json({ error: 'bad secret' });
      }
    }

    const update = req.body || {};
    const msg = update.message || update.edited_message;
    if (!msg || !msg.text || !msg.chat || !msg.chat.id) {
      return res.json({ ok: true, skipped: 'no-message' });
    }

    const chatId = String(msg.chat.id);
    const text = String(msg.text || '').trim();
    const fromUsername = msg.from?.username || null;
    const firstName = msg.from?.first_name || null;

    // /start — greet the user. /link <token> — bind chat to user.
    if (/^\/start\b/i.test(text)) {
      await telegram.pushText(chatId,
        'Hi! 👋 I\'m the ReviewHub bot. To receive new-review notifications here, '
        + 'go to your ReviewHub Settings → Connect Telegram → generate a code → send '
        + '<code>/link &lt;your-code&gt;</code> here.');
      return res.json({ ok: true });
    }

    const linkMatch = text.match(/^\/link\s+([A-Za-z0-9_-]+)\s*$/i);
    if (linkMatch) {
      const token = linkMatch[1];
      // Find an unexpired token. Length sanity check first (24-byte
      // base64url is 32 chars; cap to avoid pathological inputs).
      if (token.length < 16 || token.length > 64) {
        await telegram.pushText(chatId, '❌ Invalid code format.');
        return res.json({ ok: true });
      }
      const link = get(
        `SELECT id, user_id, link_token_expires_at
           FROM telegram_links
          WHERE link_token = ?`,
        [token]
      );
      if (!link) {
        await telegram.pushText(chatId, '❌ Code not recognized. Generate a fresh one in Settings.');
        return res.json({ ok: true });
      }
      if (new Date(link.link_token_expires_at) < new Date()) {
        await telegram.pushText(chatId, '❌ Code expired. Generate a fresh one in Settings.');
        return res.json({ ok: true });
      }
      // Bind chat_id + clear the link_token (one-time use).
      run(
        `UPDATE telegram_links
            SET telegram_chat_id = ?,
                telegram_username = ?,
                first_name = ?,
                link_token = NULL,
                link_token_expires_at = NULL,
                linked_at = datetime('now'),
                updated_at = datetime('now')
          WHERE id = ?`,
        [chatId, fromUsername, firstName, link.id]
      );
      await telegram.pushText(chatId,
        `✅ Linked! You'll receive new-review notifications here. `
        + `Reply <code>/unlink</code> any time to stop, or change in Settings.`);
      return res.json({ ok: true });
    }

    // /unlink — let the user unlink themselves from inside Telegram
    if (/^\/unlink\b/i.test(text)) {
      const link = get(
        'SELECT id FROM telegram_links WHERE telegram_chat_id = ?',
        [chatId]
      );
      if (link) {
        run(
          `UPDATE telegram_links
              SET telegram_chat_id = NULL,
                  telegram_username = NULL,
                  first_name = NULL,
                  updated_at = datetime('now')
            WHERE id = ?`,
          [link.id]
        );
        await telegram.pushText(chatId, '🛑 Unlinked. You won\'t receive ReviewHub notifications here. Re-link any time from Settings.');
      } else {
        await telegram.pushText(chatId, 'You\'re not currently linked.');
      }
      return res.json({ ok: true });
    }

    // Unrecognized command — soft help.
    if (text.startsWith('/')) {
      await telegram.pushText(chatId, 'Commands: /link <code>, /unlink, /start');
    }
    return res.json({ ok: true });
  } catch (err) {
    captureException(err, { route: 'telegram.webhook' });
    // Still return 200 so Telegram doesn't retry storm.
    res.json({ ok: true, error: 'internal' });
  }
});

module.exports = router;
