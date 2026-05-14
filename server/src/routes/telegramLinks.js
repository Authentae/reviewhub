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
    res.json({ token, expires_at: expiresAt, bot_username: process.env.TELEGRAM_BOT_USERNAME || '' });
  } catch (err) {
    captureException(err, { route: 'telegram.generate-token' });
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
