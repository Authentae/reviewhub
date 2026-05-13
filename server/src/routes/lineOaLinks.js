// /api/line-oa — manage the authenticated user's LINE OA link.
//
// Three operations:
//   - GET /status            → { enabled, linked, display_name?, linked_at?, picture_url?, bot_id? }
//   - POST /generate-token   → { token, expires_at }  // 15-min TTL
//   - POST /unlink           → { ok: true }           // clears line_user_id
//
// `enabled` reflects the deployment-level switch (LINE_OA_ENABLED env).
// `bot_id` returns the LINE OA Basic ID (e.g. @reviewhubreview) so the UI
// can render a "Open in LINE" deep link the user can tap on phone to add
// the bot as a friend.
//
// Auth via the existing authMiddleware. All write operations are
// rate-limited at 10/min to prevent token-spam.

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { get, run, insert } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { captureException } = require('../lib/errorReporter');

const router = express.Router();
router.use(authMiddleware);

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const TOKEN_TTL_SECONDS = 15 * 60; // 15 min

// LINE OA Basic ID — the @-handle. Read from env so a different
// deployment can point users at a different bot. Default reflects the
// production handle for ReviewHub.
function botBasicId() {
  return process.env.LINE_OA_BASIC_ID || '@024hjpcv';
}

// Make a URL-safe random token. 32 bytes → 43 base64url chars (>= 256
// bits of entropy). The webhook-handler regex accepts /link <8-64 chars>
// so this fits.
function generateLinkToken() {
  return crypto.randomBytes(32).toString('base64url');
}

router.get('/status', (req, res) => {
  try {
    const enabled = process.env.LINE_OA_ENABLED === 'true';
    const link = get(
      `SELECT line_user_id, display_name, picture_url, linked_at, link_token, link_token_expires_at
         FROM line_oa_links WHERE user_id = ?`,
      [req.user.id]
    );
    const linked = !!(link && link.line_user_id);
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({
      enabled,
      linked,
      display_name: linked ? link.display_name : undefined,
      picture_url: linked ? link.picture_url : undefined,
      linked_at: linked ? link.linked_at : undefined,
      pending_token: !linked && link?.link_token ? {
        token: link.link_token,
        expires_at: link.link_token_expires_at,
      } : undefined,
      bot_id: botBasicId(),
    });
  } catch (err) {
    captureException(err, { route: 'line-oa.status' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/generate-token', writeLimiter, (req, res) => {
  try {
    if (process.env.LINE_OA_ENABLED !== 'true') {
      return res.status(503).json({ error: 'LINE OA not enabled on this deployment' });
    }

    const token = generateLinkToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();

    // Upsert into line_oa_links. UNIQUE(user_id) means the simplest path
    // is: try update first; if no row updated, insert.
    const existing = get('SELECT id, line_user_id FROM line_oa_links WHERE user_id = ?', [req.user.id]);

    if (existing && existing.line_user_id) {
      // User already linked — generating a fresh token doesn't make sense
      // unless they explicitly want to re-link. Be explicit:
      return res.status(409).json({
        error: 'Already linked. Unlink first if you want to switch LINE accounts.',
      });
    }

    if (existing) {
      run(
        `UPDATE line_oa_links
            SET link_token = ?, link_token_expires_at = ?, updated_at = datetime('now')
          WHERE id = ?`,
        [token, expiresAt, existing.id]
      );
    } else {
      insert(
        `INSERT INTO line_oa_links (user_id, link_token, link_token_expires_at)
         VALUES (?, ?, ?)`,
        [req.user.id, token, expiresAt]
      );
    }

    res.json({
      token,
      expires_at: expiresAt,
      bot_id: botBasicId(),
      // Convenience: the exact message the user should send in LINE.
      // Pre-formatted so they can copy-paste without typos.
      command: `/link ${token}`,
    });
  } catch (err) {
    captureException(err, { route: 'line-oa.generate-token' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/line-oa/test-push
//
// Sends a synthetic Flex-card notification to the caller's linked LINE
// account. Used to verify the end-to-end push pipeline is working without
// waiting for a real new review to come in via the Places poller.
// Requires the user to have linked LINE first (line_user_id present).
//
// 400 if not linked
// 502 on LINE API failure
// 503 if LINE OA env vars not configured
router.post('/test-push', writeLimiter, async (req, res) => {
  try {
    const lineMessenger = require('../lib/line/messenger');
    if (!lineMessenger.isEnabled()) {
      return res.status(503).json({ error: 'LINE OA not configured on this deployment' });
    }
    const link = get('SELECT line_user_id FROM line_oa_links WHERE user_id = ?', [req.user.id]);
    if (!link || !link.line_user_id) {
      return res.status(400).json({ error: 'No linked LINE account. Generate a code + link first.' });
    }
    // Fetch the user's business so the test card looks realistic.
    const biz = get(
      'SELECT business_name, google_managing_email FROM businesses WHERE user_id = ? ORDER BY id ASC LIMIT 1',
      [req.user.id]
    );
    const businessName = biz?.business_name || 'Your business';
    const managingEmail = biz?.google_managing_email;
    const replyOnGoogleUrl = managingEmail
      ? `https://business.google.com/reviews?authuser=${encodeURIComponent(managingEmail)}`
      : 'https://business.google.com/reviews';
    const flex = lineMessenger.buildReviewNotificationFlex({
      businessName,
      reviewerName: 'ReviewHub Test',
      rating: 5,
      reviewText: 'Test notification — if you see this Flex card on LINE, the push pipeline is wired correctly end-to-end. Real reviews will arrive here within 30 min of being posted on Google.',
      draftText: 'Thank you so much for the test! 🎉 — This is a sample AI-drafted reply.',
      draftLanguage: 'en',
      replyOnGoogleUrl,
      editUrl: 'https://reviewhub.review/dashboard',
    });
    try {
      await lineMessenger.pushFlex(
        link.line_user_id,
        `Test push for ${businessName}`,
        flex,
        { copyableText: 'Thank you so much for the test! 🎉 — This is a sample AI-drafted reply.' }
      );
    } catch (err) {
      captureException(err, { route: 'line-oa.test-push', op: 'pushFlex' });
      return res.status(502).json({ error: `LINE push failed: ${err.message || 'unknown'}` });
    }
    res.json({ ok: true });
  } catch (err) {
    captureException(err, { route: 'line-oa.test-push' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/unlink', writeLimiter, (req, res) => {
  try {
    const link = get('SELECT id FROM line_oa_links WHERE user_id = ?', [req.user.id]);
    if (!link) return res.json({ ok: true, alreadyUnlinked: true });
    // Keep the row for audit/history but clear identifiable LINE fields
    // and the token. The webhook unfollow handler does the same so the
    // two paths converge on the same end state.
    run(
      `UPDATE line_oa_links
          SET line_user_id = NULL,
              display_name = NULL,
              picture_url = NULL,
              link_token = NULL,
              link_token_expires_at = NULL,
              updated_at = datetime('now')
        WHERE id = ?`,
      [link.id]
    );
    res.json({ ok: true });
  } catch (err) {
    captureException(err, { route: 'line-oa.unlink' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
