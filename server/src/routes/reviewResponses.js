// Public business-owner responses to reviews.
//
// Feature gate: a verified owner (approved business_claim) on a paid plan
// ($14+ / starter+) may post ONE public response per review on their business,
// and may edit / delete their own response.
//
// Routes:
//   GET    /api/reviews/:id/response   — fetch the public response (if any)
//   POST   /api/reviews/:id/response   — create
//   PUT    /api/reviews/:id/response   — edit own response
//   DELETE /api/reviews/:id/response   — delete own response
//
// Response text:
//   * 10–2000 characters after trim
//   * HTML stripped — we sanitize by removing tag-like sequences. The content
//     is rendered as plain text on the public page, but defensive sanitization
//     here means even a buggy renderer can't produce stored XSS.
//
// Rate limit: 50 responses/day per owner — enforced via a count query against
// review_responses.created_at within a rolling 24h window. Edits don't count.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all, insert, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const responseMutateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const responseReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Plan tiers that unlock public responses. Free is excluded.
const RESPONSE_PLANS = new Set(['starter', 'pro', 'business']);
const DAILY_LIMIT = 50;
const MIN_LEN = 10;
const MAX_LEN = 2000;

function parseId(param) {
  const n = parseInt(param, 10);
  return (isFinite(n) && n > 0 && String(n) === String(param)) ? n : null;
}

// Strip any HTML-ish content. We don't allow markup of any kind in public
// responses — they render as plain text. The regex removes anything that
// looks like a tag (`<...>`) and decodes the leftovers via a basic
// entity-collapse so authors can't smuggle markup via &lt;script&gt;.
function sanitizeResponseText(raw) {
  if (typeof raw !== 'string') return '';
  // Remove tags
  let s = raw.replace(/<[^>]*>/g, '');
  // Collapse common entities back to their literal so we don't leave
  // half-encoded markup that a client could re-decode.
  s = s.replace(/&(?:amp|lt|gt|quot|#39|apos);/gi, (m) => {
    switch (m.toLowerCase()) {
      case '&amp;': return '&';
      case '&lt;': return '<';
      case '&gt;': return '>';
      case '&quot;': return '"';
      case '&#39;':
      case '&apos;': return "'";
      default: return '';
    }
  });
  // Now strip any leftover angle brackets (e.g. from `<<` or unbalanced)
  s = s.replace(/[<>]/g, '');
  return s.trim();
}

// Resolve the review + ownership context for the caller. Returns:
//   { ok: true, review, business, plan, claim }
// or { ok: false, status, error }
function resolveOwnerContext(userId, reviewId) {
  const review = get('SELECT id, business_id FROM reviews WHERE id = ?', [reviewId]);
  if (!review) return { ok: false, status: 404, error: 'Review not found' };

  // Two ownership paths: (1) user directly owns the business row
  // (businesses.user_id), OR (2) user has an approved business_claim on it.
  // Both are valid "verified owner" channels; the claim flow is the public
  // path, the direct-owner path is for users who created the listing.
  const business = get('SELECT id, user_id FROM businesses WHERE id = ?', [review.business_id]);
  if (!business) return { ok: false, status: 404, error: 'Business not found' };

  const isDirectOwner = business.user_id === userId;
  const claim = isDirectOwner ? null : get(
    `SELECT id FROM business_claims
     WHERE user_id = ? AND business_id = ? AND status = 'approved'`,
    [userId, business.id]
  );
  if (!isDirectOwner && !claim) {
    return { ok: false, status: 403, error: 'You are not a verified owner of this business' };
  }

  const sub = get('SELECT plan FROM subscriptions WHERE user_id = ?', [userId]);
  const planId = sub?.plan || 'free';
  if (!RESPONSE_PLANS.has(planId)) {
    return {
      ok: false,
      status: 402,
      error: 'Public review responses require the Starter plan or higher',
      upgradeTo: 'starter',
    };
  }

  return { ok: true, review, business, plan: planId };
}

// GET /api/reviews/:id/response
router.get('/:id/response', responseReadLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const review = get('SELECT id FROM reviews WHERE id = ?', [reviewId]);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    const row = get(
      `SELECT id, review_id, owner_user_id, business_id, response_text, created_at, updated_at
       FROM review_responses WHERE review_id = ?`,
      [reviewId]
    );
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ response: row || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reviews/:id/response
router.post('/:id/response', responseMutateLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });

    const ctx = resolveOwnerContext(req.user.id, reviewId);
    if (!ctx.ok) return res.status(ctx.status).json({
      error: ctx.error,
      ...(ctx.upgradeTo ? { upgradeTo: ctx.upgradeTo } : {}),
    });

    const text = sanitizeResponseText(req.body?.response_text);
    if (text.length < MIN_LEN) {
      return res.status(400).json({ error: `Response must be at least ${MIN_LEN} characters` });
    }
    if (text.length > MAX_LEN) {
      return res.status(400).json({ error: `Response must be ${MAX_LEN} characters or fewer` });
    }

    // Single response per review — DB UNIQUE(review_id) backs this up, but
    // we check first so we can return a clean 409 instead of a 500.
    const existing = get('SELECT id FROM review_responses WHERE review_id = ?', [reviewId]);
    if (existing) {
      return res.status(409).json({ error: 'A response already exists. Use PUT to edit it.' });
    }

    // Daily rate cap: count THIS owner's responses created in the last 24h.
    const cnt = get(
      `SELECT COUNT(*) AS n FROM review_responses
       WHERE owner_user_id = ? AND created_at >= datetime('now', '-1 day')`,
      [req.user.id]
    )?.n || 0;
    if (cnt >= DAILY_LIMIT) {
      return res.status(429).json({
        error: `Daily response limit reached (${DAILY_LIMIT}/day). Try again tomorrow.`,
        limit: DAILY_LIMIT,
      });
    }

    const id = insert(
      `INSERT INTO review_responses (review_id, owner_user_id, business_id, response_text)
       VALUES (?, ?, ?, ?)`,
      [reviewId, req.user.id, ctx.business.id, text]
    );
    const row = get(
      `SELECT id, review_id, owner_user_id, business_id, response_text, created_at, updated_at
       FROM review_responses WHERE id = ?`,
      [id]
    );
    res.status(201).json({ response: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/reviews/:id/response — edit own response
router.put('/:id/response', responseMutateLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });

    const ctx = resolveOwnerContext(req.user.id, reviewId);
    if (!ctx.ok) return res.status(ctx.status).json({
      error: ctx.error,
      ...(ctx.upgradeTo ? { upgradeTo: ctx.upgradeTo } : {}),
    });

    const existing = get(
      `SELECT id, owner_user_id FROM review_responses WHERE review_id = ?`,
      [reviewId]
    );
    if (!existing) return res.status(404).json({ error: 'No response to edit' });
    if (existing.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You may only edit your own response' });
    }

    const text = sanitizeResponseText(req.body?.response_text);
    if (text.length < MIN_LEN) {
      return res.status(400).json({ error: `Response must be at least ${MIN_LEN} characters` });
    }
    if (text.length > MAX_LEN) {
      return res.status(400).json({ error: `Response must be ${MAX_LEN} characters or fewer` });
    }

    run(
      `UPDATE review_responses SET response_text = ?, updated_at = datetime('now') WHERE id = ?`,
      [text, existing.id]
    );
    const row = get(
      `SELECT id, review_id, owner_user_id, business_id, response_text, created_at, updated_at
       FROM review_responses WHERE id = ?`,
      [existing.id]
    );
    res.json({ response: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/reviews/:id/response
router.delete('/:id/response', responseMutateLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });

    const existing = get(
      `SELECT id, owner_user_id FROM review_responses WHERE review_id = ?`,
      [reviewId]
    );
    if (!existing) return res.status(404).json({ error: 'No response to delete' });
    if (existing.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You may only delete your own response' });
    }
    run('DELETE FROM review_responses WHERE id = ?', [existing.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports._internal = { sanitizeResponseText, RESPONSE_PLANS, DAILY_LIMIT };
