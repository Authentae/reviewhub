// Telegram link management — analogue of routes/lineOaLinks.js.
//
// GET    /api/telegram/status          — caller's link state + bot username
// POST   /api/telegram/generate-token  — mint 15-min /link <token>
// POST   /api/telegram/unlink          — clear chat_id

const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middleware/auth');
const { get, run } = require('../db/schema');
const { captureException } = require('../lib/errorReporter');
const crypto = require('crypto');

const router = express.Router();
router.use(authMiddleware);

const writeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// `enabled` reflects the deployment-level switch (TELEGRAM_BOT_ENABLED env).
// `bot_username` is the bot's @handle from BotFather; needed for the
// "open Telegram → talk to @X" deep-link on the Settings UI.
router.get('/status', (req, res) => {
  try {
    const enabled = process.env.TELEGRAM_BOT_ENABLED === 'true' &&
                    !!process.env.TELEGRAM_BOT_TOKEN;
    const bot_username = process.env.TELEGRAM_BOT_USERNAME || '';
    const link = get(
      'SELECT telegram_chat_id, telegram_username, first_name, linked_at FROM telegram_links WHERE user_id = ?',
      [req.user.id]
    );
    const linked = !!(link && link.telegram_chat_id);
    res.json({
      enabled,
      bot_username,
      linked,
      first_name: linked ? link.first_name : null,
      telegram_username: linked ? link.telegram_username : null,
      linked_at: linked ? link.linked_at : null,
    });
  } catch (err) {
    captureException(err, { route: 'telegram.status' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/generate-token', writeLimiter, (req, res) => {
  try {
    if (process.env.TELEGRAM_BOT_ENABLED !== 'true') {
      return res.status(503).json({ error: 'Telegram Bot not enabled on this deployment' });
    }
    // Random URL-safe token. 24 bytes → 32-char base64url. Plenty.
    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    // Upsert: either create a row if user has none, or rotate the token
    // on an existing row (which may already be linked — re-linking flow).
    const existing = get('SELECT id FROM telegram_links WHERE user_id = ?', [req.user.id]);
    if (existing) {
      run(
        `UPDATE telegram_links
            SET link_token = ?, link_token_expires_at = ?, updated_at = datetime('now')
          WHERE id = ?`,
        [token, expiresAt, existing.id]
      );
    } else {
      run(
        `INSERT INTO telegram_links (user_id, link_token, link_token_expires_at)
         VALUES (?, ?, ?)`,
        [req.user.id, token, expiresAt]
      );
    }
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';
    res.json({
      token,
      expires_at: expiresAt,
      bot_username: botUsername,
      // Pre-formatted command to paste into Telegram chat.
      command: `/link ${token}`,
      // Telegram deep link with start payload — opens the bot chat
      // pre-filled with /start <token>. One tap on mobile = linked.
      deep_link: botUsername ? `https://t.me/${botUsername}?start=${token}` : null,
    });
  } catch (err) {
    captureException(err, { route: 'telegram.generate-token' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/telegram/test-push — fire a synthetic notification to verify
// the push pipeline end-to-end without waiting for a real Google review.
router.post('/test-push', writeLimiter, async (req, res) => {
  try {
    const tg = require('../lib/telegram/messenger');
    if (!tg.isEnabled()) {
      return res.status(503).json({ error: 'Telegram Bot not configured on this deployment' });
    }
    const link = get('SELECT telegram_chat_id FROM telegram_links WHERE user_id = ?', [req.user.id]);
    if (!link || !link.telegram_chat_id) {
      return res.status(400).json({ error: 'No linked Telegram chat. Generate a code + link first.' });
    }
    const biz = get(
      'SELECT business_name, google_managing_email FROM businesses WHERE user_id = ? ORDER BY id ASC LIMIT 1',
      [req.user.id]
    );
    const businessName = biz?.business_name || 'Your business';
    const managingEmail = biz?.google_managing_email;
    const replyOnGoogleUrl = managingEmail
      ? `https://business.google.com/reviews?authuser=${encodeURIComponent(managingEmail)}`
      : 'https://business.google.com/reviews';
    const { text, buttons, draftCopyMessage } = tg.buildReviewNotification({
      businessName,
      reviewerName: 'ReviewHub Test',
      rating: 5,
      reviewText: 'Test notification — if you see this on Telegram, the push pipeline is wired correctly end-to-end. Real reviews arrive here within 30 min of being posted on Google.',
      reviewDate: new Date().toISOString(),
      draftText: 'Thank you so much for the test! 🎉 — Sample AI-drafted reply.',
      draftLanguage: 'en',
      replyOnGoogleUrl,
      editUrl: 'https://reviewhub.review/dashboard',
    });
    const r = await tg.pushWithButtons(link.telegram_chat_id, text, buttons);
    if (!r.ok) {
      captureException(new Error(`telegram test-push: ${r.error}`), { route: 'telegram.test-push' });
      return res.status(502).json({ error: `Telegram push failed: ${r.error || 'unknown'}` });
    }
    // Follow-up: draft-only message in <code> for one-tap copy on mobile.
    if (draftCopyMessage) {
      await tg.pushText(link.telegram_chat_id, draftCopyMessage);
    }
    res.json({ ok: true });
  } catch (err) {
    captureException(err, { route: 'telegram.test-push' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/unlink', writeLimiter, (req, res) => {
  try {
    const link = get('SELECT id FROM telegram_links WHERE user_id = ?', [req.user.id]);
    if (!link) return res.json({ ok: true, alreadyUnlinked: true });
    run(
      `UPDATE telegram_links
          SET telegram_chat_id = NULL,
              telegram_username = NULL,
              first_name = NULL,
              link_token = NULL,
              link_token_expires_at = NULL,
              updated_at = datetime('now')
        WHERE id = ?`,
      [link.id]
    );
    res.json({ ok: true });
  } catch (err) {
    captureException(err, { route: 'telegram.unlink' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
