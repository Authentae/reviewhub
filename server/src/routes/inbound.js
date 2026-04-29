// Inbound email forwarding pipeline.
//
// Architecture:
//   1. User sets up forwarding from their review-platform notification emails
//      (Booking.com / Wongnai / etc.) to reviews+<secret>@reviewhub.review.
//   2. Mailgun (or compatible inbound email service) receives that mail and
//      POSTs the parsed message to /api/inbound/email.
//   3. We look up the user by <secret>, parse the message via lib/inbound/
//      parsers, and insert a review record on the user's active business.
//
// Routes:
//   GET   /api/inbound/address      — show the caller's forwarding address
//                                     (auth required; lazily generates secret)
//   POST  /api/inbound/regenerate   — rotate the secret (auth)
//   POST  /api/inbound/email        — Mailgun webhook (auth via signature)
//
// Mailgun signature format: HMAC-SHA256 of (timestamp + token) with the
// webhook signing key. See https://documentation.mailgun.com/en/latest/
// user_manual.html#securing-webhooks
//
// Activation: set MAILGUN_WEBHOOK_SIGNING_KEY in env. With it unset, the
// webhook 401s (intentional — the secret-only address still lets users
// preview their alias before going through Mailgun setup).

const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { get, all, insert, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { captureException } = require('../lib/errorReporter');
const { parseInboundEmail } = require('../lib/inbound/parsers');
const { isValidPlatform } = require('../lib/platforms');

const router = express.Router();

const inboundLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // Mailgun delivers in bursts; modest limit
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateSecret() {
  // 16 bytes = 32 hex chars. Long enough that brute-forcing aliases is
  // computationally infeasible; short enough to fit in a Gmail forwarding
  // rule without wrapping.
  return crypto.randomBytes(16).toString('hex');
}

function ensureUserSecret(userId) {
  let user = get('SELECT id, inbound_email_secret FROM users WHERE id = ?', [userId]);
  if (!user) return null;
  if (!user.inbound_email_secret) {
    const secret = generateSecret();
    run('UPDATE users SET inbound_email_secret = ? WHERE id = ?', [secret, userId]);
    user = { ...user, inbound_email_secret: secret };
  }
  return user.inbound_email_secret;
}

function buildForwardingAddress(secret) {
  const domain = process.env.INBOUND_EMAIL_DOMAIN || 'reviewhub.review';
  return `reviews+${secret}@${domain}`;
}

// Verify Mailgun's HMAC signature on the inbound webhook. Skipped if no
// signing key is configured (intentional: we want the routes to exist for
// schema/UI even before the user wires up Mailgun).
function verifyMailgunSignature(req) {
  const key = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!key) return { ok: false, reason: 'mailgun-not-configured' };
  const { timestamp, token, signature } = req.body || {};
  if (!timestamp || !token || !signature) return { ok: false, reason: 'missing-fields' };
  // Reject replay attacks: signature timestamp must be within 5 minutes.
  // Mailgun normally sends timestamp as a string, but a future SDK / proxy
  // could marshal it as a JSON number — coerce via Number() so both work
  // (parseInt on a number returns the number; on a numeric string returns
  // the parsed int; on anything else NaN, which the !isFinite gate catches).
  const tsNum = Number(timestamp);
  const age = Math.abs(Date.now() / 1000 - tsNum);
  if (!Number.isFinite(age) || age > 300) return { ok: false, reason: 'stale-timestamp' };
  // The HMAC payload must be the EXACT bytes Mailgun signed — they sign the
  // string-form timestamp, so coerce to string for the HMAC even if the
  // request came in as a number.
  const expected = crypto
    .createHmac('sha256', key)
    .update(String(timestamp) + String(token))
    .digest('hex');
  // Constant-time compare to avoid timing side-channels.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(signature), 'hex');
  if (a.length !== b.length) return { ok: false, reason: 'sig-length' };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'sig-mismatch' };
  return { ok: true };
}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /api/inbound/address — show forwarding address (auth)
router.get('/address', authMiddleware, inboundLimiter, (req, res) => {
  try {
    const secret = ensureUserSecret(req.user.id);
    if (!secret) return res.status(404).json({ error: 'User not found' });
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({
      address: buildForwardingAddress(secret),
      mailgun_configured: !!process.env.MAILGUN_WEBHOOK_SIGNING_KEY,
    });
  } catch (err) {
    captureException(err, { route: 'inbound.address' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inbound/regenerate — rotate secret (auth)
router.post('/regenerate', authMiddleware, inboundLimiter, (req, res) => {
  try {
    const secret = generateSecret();
    run('UPDATE users SET inbound_email_secret = ? WHERE id = ?', [secret, req.user.id]);
    res.json({ address: buildForwardingAddress(secret) });
  } catch (err) {
    captureException(err, { route: 'inbound.regenerate' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inbound/email — Mailgun webhook receiver
//
// Body fields (Mailgun "Stored Message" or "Forwarded Message" events):
//   - recipient: full address the email was sent to
//   - sender: outermost From: header (the user's own email, since they forwarded)
//   - subject
//   - body-plain (and/or stripped-text, body-html)
//   - timestamp, token, signature (for HMAC)
//   - Message-Headers (JSON-encoded array of [name, value] tuples — sometimes)
router.post('/email', inboundLimiter, (req, res) => {
  try {
    // 1. Verify signature (or 401 if Mailgun isn't configured)
    const sig = verifyMailgunSignature(req);
    if (!sig.ok) {
      return res.status(401).json({ error: 'Signature verification failed', reason: sig.reason });
    }

    // 2. Parse the recipient to find the user secret
    const recipient = String(req.body.recipient || '').toLowerCase();
    const localPart = recipient.split('@')[0] || '';
    const m = localPart.match(/^reviews\+([a-f0-9]{8,64})$/);
    if (!m) {
      return res.status(400).json({ error: 'Invalid recipient address format' });
    }
    const secret = m[1];
    const user = get(
      'SELECT id, active_business_id FROM users WHERE inbound_email_secret = ?',
      [secret]
    );
    if (!user) {
      // 200 so Mailgun doesn't retry; just log silently.
      return res.json({ ignored: true, reason: 'unknown-secret' });
    }

    // 3. Find the user's business to attach the review to
    let business = null;
    if (user.active_business_id) {
      business = get('SELECT id FROM businesses WHERE id = ? AND user_id = ?', [user.active_business_id, user.id]);
    }
    if (!business) {
      business = get('SELECT id FROM businesses WHERE user_id = ? ORDER BY id ASC LIMIT 1', [user.id]);
    }
    if (!business) {
      return res.json({ ignored: true, reason: 'no-business' });
    }

    // 4. Reconstruct headers from Mailgun's Message-Headers JSON if present
    let headers = {};
    try {
      const raw = req.body['Message-Headers'] || req.body['message-headers'];
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          for (const [k, v] of parsed) headers[k] = v;
        }
      }
    } catch { /* malformed headers — proceed without them */ }

    const subject = req.body.subject || req.body.Subject || '';
    const body = req.body['body-plain'] || req.body['stripped-text'] || req.body['body-html'] || '';

    // 5. Run the parser
    const parsed = parseInboundEmail({ headers, subject, body });

    // Validate platform — fall back to 'manual' if parser returned something
    // we don't recognize (defense against future drift).
    const platform = isValidPlatform(parsed.platform) ? parsed.platform : 'manual';
    const rating = (parsed.rating && parsed.rating >= 1 && parsed.rating <= 5)
      ? parsed.rating
      : 3; // neutral default when rating couldn't be extracted
    const reviewerName = (parsed.reviewer_name || 'Anonymous').slice(0, 200);
    const reviewText = (parsed.review_text || subject || '').slice(0, 5000);
    const sentiment = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';

    const id = insert(
      `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [business.id, platform, reviewerName, rating, reviewText, sentiment]
    );

    res.json({ ok: true, review_id: id, platform, rating });
  } catch (err) {
    captureException(err, { route: 'inbound.email' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
