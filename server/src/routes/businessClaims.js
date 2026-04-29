// Business owner claim flow.
//
// A logged-in user posts a claim against a business listing. The claim sits
// in `pending` until an admin reviews it. On approval the user becomes a
// verified owner and gains the right to post public responses on that
// business's reviews (gated additionally by paid plan tier — see
// reviewResponses.js).
//
// Routes:
//   POST   /api/businesses/:id/claim   — submit a claim (auth)
//   GET    /api/businesses/:id/claim   — see the caller's claim status
//   GET    /api/admin/claims           — list pending claims (admin)
//   POST   /api/admin/claims/:id/approve  — approve (admin)
//   POST   /api/admin/claims/:id/deny     — deny with reason (admin)

const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all, insert, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');

const { captureException } = require('../lib/errorReporter');
const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

const claimMutateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many claim requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const claimReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

function parseId(param) {
  const n = parseInt(param, 10);
  return (isFinite(n) && n > 0 && String(n) === String(param)) ? n : null;
}

function asTrimmedString(value, field, { maxLen = 2000, allowEmpty = false } = {}) {
  if (value === undefined || value === null) {
    return allowEmpty ? { ok: true, value: '' } : { ok: false, error: `${field} is required` };
  }
  if (typeof value !== 'string') return { ok: false, error: `${field} must be a string` };
  return { ok: true, value: value.trim().slice(0, maxLen) };
}

// POST /api/businesses/:id/claim
router.post('/:id/claim', claimMutateLimiter, (req, res) => {
  try {
    const bizId = parseId(req.params.id);
    if (!bizId) return res.status(400).json({ error: 'Invalid business ID' });

    const biz = get('SELECT id FROM businesses WHERE id = ?', [bizId]);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    // Evidence is optional free-text (URL, position title, anything supporting
    // ownership). Capped at 2000 chars; will be displayed in admin queue.
    const r = asTrimmedString(req.body?.evidence, 'evidence', { maxLen: 2000, allowEmpty: true });
    if (!r.ok) return res.status(400).json({ error: r.error });

    // Existing active claim? (pending or approved) → 409 with current state.
    const existing = get(
      `SELECT id, status, created_at FROM business_claims
       WHERE user_id = ? AND business_id = ? AND status IN ('pending','approved')`,
      [req.user.id, bizId]
    );
    if (existing) {
      return res.status(409).json({
        error: existing.status === 'approved'
          ? 'You already own this business'
          : 'A claim is already pending for this business',
        claim: existing,
      });
    }

    const id = insert(
      `INSERT INTO business_claims (user_id, business_id, status, evidence)
       VALUES (?, ?, 'pending', ?)`,
      [req.user.id, bizId, r.value || null]
    );
    res.status(201).json({
      id,
      user_id: req.user.id,
      business_id: bizId,
      status: 'pending',
      evidence: r.value || null,
    });
  } catch (err) {
    captureException(err, { route: 'businessClaims' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/businesses/:id/claim — caller's claim status for this business
router.get('/:id/claim', claimReadLimiter, (req, res) => {
  try {
    const bizId = parseId(req.params.id);
    if (!bizId) return res.status(400).json({ error: 'Invalid business ID' });

    const claim = get(
      `SELECT id, user_id, business_id, status, evidence, denial_reason, reviewed_at, created_at
       FROM business_claims
       WHERE user_id = ? AND business_id = ?
       ORDER BY id DESC LIMIT 1`,
      [req.user.id, bizId]
    );
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ claim: claim || null });
  } catch (err) {
    captureException(err, { route: 'businessClaims' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Admin sub-router ────────────────────────────────────────────────────
//
// Mounted separately under /api/admin/claims by app.js. Reuses the same
// admin-email gate as the rest of /api/admin/*.

const adminRouter = express.Router();
adminRouter.use(authMiddleware);
adminRouter.use((req, res, next) => {
  const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!admin) return res.status(404).json({ error: 'Not found' });
  const callerEmail = (req.user?.email || '').trim().toLowerCase();
  if (callerEmail !== admin) return res.status(404).json({ error: 'Not found' });
  next();
});

// Bound admin write traffic. Even with the email gate above, a leaked
// admin token shouldn't be able to spam approve/deny for thousands of
// claims in a few seconds — and a buggy admin UI shouldn't either.
const adminMutateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// GET /api/admin/claims?status=pending&limit=50
adminRouter.get('/', (req, res) => {
  try {
    const status = ['pending', 'approved', 'denied'].includes(req.query.status)
      ? req.query.status : 'pending';
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const rows = all(
      `SELECT c.id, c.user_id, u.email AS user_email,
              c.business_id, b.business_name,
              c.status, c.evidence, c.denial_reason,
              c.reviewed_by_user_id, c.reviewed_at, c.created_at
       FROM business_claims c
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN businesses b ON b.id = c.business_id
       WHERE c.status = ?
       ORDER BY c.created_at DESC LIMIT ?`,
      [status, limit]
    );
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ rows, status, limit });
  } catch (err) {
    captureException(err, { route: 'admin.claims.list' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/claims/:id/approve
adminRouter.post('/:id/approve', adminMutateLimiter, (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid claim ID' });
    const claim = get('SELECT id, status FROM business_claims WHERE id = ?', [id]);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'pending') {
      return res.status(409).json({ error: `Claim is already ${claim.status}` });
    }
    run(
      `UPDATE business_claims
       SET status = 'approved', reviewed_by_user_id = ?, reviewed_at = datetime('now'),
           denial_reason = NULL
       WHERE id = ?`,
      [req.user.id, id]
    );
    res.json({ id, status: 'approved' });
  } catch (err) {
    captureException(err, { route: 'admin.claims.approve' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/claims/:id/deny
adminRouter.post('/:id/deny', adminMutateLimiter, (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid claim ID' });
    const claim = get('SELECT id, status FROM business_claims WHERE id = ?', [id]);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'pending') {
      return res.status(409).json({ error: `Claim is already ${claim.status}` });
    }
    const r = asTrimmedString(req.body?.reason, 'reason', { maxLen: 1000, allowEmpty: true });
    if (!r.ok) return res.status(400).json({ error: r.error });
    run(
      `UPDATE business_claims
       SET status = 'denied', reviewed_by_user_id = ?, reviewed_at = datetime('now'),
           denial_reason = ?
       WHERE id = ?`,
      [req.user.id, r.value || null, id]
    );
    res.json({ id, status: 'denied', denial_reason: r.value || null });
  } catch (err) {
    captureException(err, { route: 'admin.claims.deny' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.adminRouter = adminRouter;
