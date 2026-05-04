// Business share-tokens — read-only links for accountants / agency
// staff. Owner mints a token, recipient opens
// /shared/<token> to see a read-only dashboard mirror.
//
// No account required for the recipient (vs. full team-membership
// architecture which would force them to register). Trade-off:
// anyone with the link can view, so leaks are uncontainable. Owner
// can revoke the token instantly to kill access.
//
// Tokens are 24-byte random hex (48 chars), shape-validated upstream
// before any DB lookup. Same validation pattern as audit-preview.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { randomBytes } = require('crypto');
const router = express.Router();
const { run, get, all, insert } = require('../db/schema');
const { captureException } = require('../lib/errorReporter');
const { authMiddleware } = require('../middleware/auth');

// Owner-side: list/create/revoke share tokens for one of their businesses.
const ownerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Public-side: rate limit per-IP on the unauthenticated read endpoint.
const publicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Helper — confirm the requesting user owns the business.
function ownsBusiness(userId, businessId) {
  const row = get(`SELECT id FROM businesses WHERE id = ? AND user_id = ?`, [businessId, userId]);
  return !!row;
}

// POST /api/businesses/:bizId/share-tokens — owner mints a new token.
router.post('/:bizId/share-tokens', ownerLimiter, authMiddleware, (req, res) => {
  try {
    const bizId = parseInt(req.params.bizId, 10);
    if (!Number.isFinite(bizId) || bizId <= 0) {
      return res.status(400).json({ error: 'Invalid business ID' });
    }
    if (!ownsBusiness(req.user.id, bizId)) {
      return res.status(404).json({ error: 'Business not found' });
    }
    const label = typeof req.body?.label === 'string'
      ? req.body.label.trim().slice(0, 80)
      : null;

    const share_token = randomBytes(24).toString('hex');
    const id = insert(
      `INSERT INTO business_share_tokens (business_id, share_token, label) VALUES (?, ?, ?)`,
      [bizId, share_token, label]
    );

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.json({
      id,
      share_token,
      share_url: `${baseUrl}/shared/${share_token}`,
      label,
    });
  } catch (err) {
    captureException(err, { route: 'business-share-tokens', op: 'create' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/businesses/:bizId/share-tokens — owner lists their tokens.
router.get('/:bizId/share-tokens', authMiddleware, (req, res) => {
  try {
    const bizId = parseInt(req.params.bizId, 10);
    if (!Number.isFinite(bizId) || bizId <= 0) {
      return res.status(400).json({ error: 'Invalid business ID' });
    }
    if (!ownsBusiness(req.user.id, bizId)) {
      return res.status(404).json({ error: 'Business not found' });
    }
    const rows = all(
      `SELECT id, share_token, label, created_at, expires_at, revoked_at,
              last_viewed_at, view_count
         FROM business_share_tokens
        WHERE business_id = ?
        ORDER BY created_at DESC
        LIMIT 50`,
      [bizId]
    );
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.json({
      tokens: rows.map(r => ({
        ...r,
        share_url: `${baseUrl}/shared/${r.share_token}`,
        active: !r.revoked_at && new Date(r.expires_at) > new Date(),
      })),
    });
  } catch (err) {
    captureException(err, { route: 'business-share-tokens', op: 'list' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/businesses/:bizId/share-tokens/:tokenId — revoke. Soft-
// revoke (sets revoked_at) so we keep the audit trail of "this token
// existed, was used N times, killed at this date." Hard-deleting would
// hide the history, which matters if a customer asks "wait, my
// accountant said they had access — what happened?"
router.delete('/:bizId/share-tokens/:tokenId', authMiddleware, (req, res) => {
  try {
    const bizId = parseInt(req.params.bizId, 10);
    const tokenId = parseInt(req.params.tokenId, 10);
    if (!Number.isFinite(bizId) || bizId <= 0 || !Number.isFinite(tokenId) || tokenId <= 0) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }
    if (!ownsBusiness(req.user.id, bizId)) {
      return res.status(404).json({ error: 'Business not found' });
    }
    run(
      `UPDATE business_share_tokens SET revoked_at = datetime('now')
        WHERE id = ? AND business_id = ? AND revoked_at IS NULL`,
      [tokenId, bizId]
    );
    res.json({ revoked: true });
  } catch (err) {
    captureException(err, { route: 'business-share-tokens', op: 'revoke' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/share/:token — public, no auth. Returns the read-only
// dashboard data: business info + recent reviews + responses + stats.
// Validation: shape-check the token before any DB query (same pattern
// as audit-preview) so garbage tokens get a fast 404 without revealing
// timing about which tokens are real.
router.get('/share/:token', publicLimiter, (req, res) => {
  try {
    const token = String(req.params.token || '');
    if (!/^[a-f0-9]{48}$/.test(token)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const row = get(
      `SELECT t.id, t.business_id, t.label, t.expires_at, t.revoked_at,
              b.business_name, b.created_at AS business_created_at
         FROM business_share_tokens t
         JOIN businesses b ON b.id = t.business_id
        WHERE t.share_token = ?`,
      [token]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.revoked_at) return res.status(404).json({ error: 'Revoked' });
    if (new Date(row.expires_at) < new Date()) {
      return res.status(404).json({ error: 'Expired' });
    }

    // Bump view stats. Best-effort; don't fail the response on error.
    try {
      run(
        `UPDATE business_share_tokens
            SET view_count = view_count + 1,
                last_viewed_at = datetime('now')
          WHERE id = ?`,
        [row.id]
      );
    } catch { /* swallow */ }

    // Pull recent reviews (capped) + summary stats. Read-only mirror —
    // no response_text editing is exposed because this endpoint isn't
    // called from any write path.
    const reviews = all(
      `SELECT id, platform, reviewer_name, rating, review_text, sentiment,
              response_text, response_posted_at, responded_at, created_at
         FROM reviews
        WHERE business_id = ?
        ORDER BY created_at DESC
        LIMIT 100`,
      [row.business_id]
    );
    const stats = get(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN response_text IS NOT NULL AND response_text != '' THEN 1 ELSE 0 END) AS responded,
              AVG(rating) AS avg_rating
         FROM reviews
        WHERE business_id = ?`,
      [row.business_id]
    );

    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      business_name: row.business_name,
      business_created_at: row.business_created_at,
      label: row.label,
      stats: {
        total: stats?.total || 0,
        responded: stats?.responded || 0,
        response_rate: stats?.total > 0 ? stats.responded / stats.total : 0,
        avg_rating: stats?.avg_rating ?? null,
      },
      reviews,
    });
  } catch (err) {
    captureException(err, { route: 'business-share-tokens', op: 'public-view' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
