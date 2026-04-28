// Admin-only routes.
//
// "Admin" here is a single operator: the person whose email matches the
// ADMIN_EMAIL env var. No role system — for a solo-founder SaaS, a one-env-
// var gate is appropriate and doesn't lock us out of a future role table
// (the column could be added later and the gate updated in one place).
//
// Every endpoint here reads audit/ops data only. There are NO admin actions
// that modify customer data — for those the operator should use SQL directly
// (SQLite file is on the server). Minimizing admin write surface minimizes
// blast radius if ADMIN_EMAIL is ever leaked.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { captureException } = require('../lib/errorReporter');

const router = express.Router();
router.use(authMiddleware);

// Belt-and-braces: tight rate limit on admin endpoints. Even with env-gating
// it's good hygiene — an ops engineer tailing logs accidentally shouldn't
// spam the DB.
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(adminLimiter);

// Gate: reject if ADMIN_EMAIL isn't set OR doesn't match the caller. The
// check uses the email on the validated JWT (authMiddleware already ran),
// not any request body field.
router.use((req, res, next) => {
  // Trim + lowercase so accidental whitespace in the env var (common when
  // pasting into .env files) doesn't silently disable admin access.
  const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!admin) return res.status(404).json({ error: 'Not found' });
  const callerEmail = (req.user?.email || '').trim().toLowerCase();
  if (callerEmail !== admin) {
    // Return 404 rather than 403 so non-admins can't enumerate the admin
    // surface via HTTP status codes.
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

// GET /api/admin/stats — high-level counts for ops visibility
router.get('/stats', (req, res) => {
  try {
    const counts = {
      users:        get('SELECT COUNT(*) AS n FROM users')?.n ?? 0,
      users_verified: get("SELECT COUNT(*) AS n FROM users WHERE email_verified_at IS NOT NULL")?.n ?? 0,
      users_mfa:    get("SELECT COUNT(*) AS n FROM users WHERE mfa_enabled = 1")?.n ?? 0,
      // New signups in the last 24h / 7d — useful activity signal.
      signups_24h:  get("SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now', '-24 hours')")?.n ?? 0,
      signups_7d:   get("SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now', '-7 days')")?.n ?? 0,
      businesses:   get('SELECT COUNT(*) AS n FROM businesses')?.n ?? 0,
      reviews:      get('SELECT COUNT(*) AS n FROM reviews')?.n ?? 0,
      reviews_unresponded: get("SELECT COUNT(*) AS n FROM reviews WHERE response_text IS NULL OR response_text = ''")?.n ?? 0,
      subs_active:  get("SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'active'")?.n ?? 0,
      // Paying = active AND plan is not 'free' — the real revenue count.
      subs_paying:  get("SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'active' AND plan != 'free' AND plan IS NOT NULL")?.n ?? 0,
      subs_by_plan: {},
      templates:    get('SELECT COUNT(*) AS n FROM templates')?.n ?? 0,
      platform_connections: get('SELECT COUNT(*) AS n FROM platform_connections')?.n ?? 0,
      platform_connections_with_errors: get("SELECT COUNT(*) AS n FROM platform_connections WHERE last_sync_error IS NOT NULL AND last_sync_error != ''")?.n ?? 0,
    };
    const planRows = all(
      "SELECT plan, COUNT(*) AS n FROM subscriptions GROUP BY plan"
    );
    for (const r of planRows) counts.subs_by_plan[r.plan || 'unknown'] = r.n;
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ ok: true, stats: counts, ts: new Date().toISOString() });
  } catch (err) {
    captureException(err, { route: 'admin.stats' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/audit?event=user.login&limit=100&before=<id>&user_id=N&ip=1.2.3.4&since=<iso>
// Cursor-based pagination: pass `before=<id>` from the previous page's
// last row to fetch the next page. Older-first-rows would be ambiguous
// under duplicate created_at timestamps, so we paginate on id DESC which
// is monotonic. Also accepts user_id/ip/since filters for forensics.
router.get('/audit', (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const event = typeof req.query.event === 'string' ? req.query.event.slice(0, 100) : null;
    const before = parseInt(req.query.before, 10);
    const userId = parseInt(req.query.user_id, 10);
    const ip = typeof req.query.ip === 'string' ? req.query.ip.slice(0, 64) : null;
    // `since` must be an ISO-8601 date/datetime. Invalid inputs are silently
    // ignored (no error) so typoed URLs don't 400.
    const sinceRaw = typeof req.query.since === 'string' ? req.query.since : null;
    let sinceIso = null;
    if (sinceRaw) {
      const d = new Date(sinceRaw);
      if (!isNaN(d.getTime())) {
        // Convert JS Date to the SQLite string format `YYYY-MM-DD HH:MM:SS`
        sinceIso = d.toISOString().slice(0, 19).replace('T', ' ');
      }
    }

    const conds = [];
    const params = [];
    if (event) { conds.push('event = ?'); params.push(event); }
    if (Number.isInteger(before) && before > 0) { conds.push('id < ?'); params.push(before); }
    if (Number.isInteger(userId) && userId > 0) { conds.push('user_id = ?'); params.push(userId); }
    if (ip) { conds.push('ip = ?'); params.push(ip); }
    if (sinceIso) { conds.push('created_at >= ?'); params.push(sinceIso); }

    let sql = `SELECT id, user_id, event, ip, user_agent, metadata, created_at FROM audit_log`;
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);
    const rows = all(sql, params);

    // Cursor for the next page (or null if this page is the end).
    const nextBefore = rows.length === limit ? rows[rows.length - 1].id : null;

    res.setHeader('Cache-Control', 'no-store, private');
    res.json({
      rows,
      limit,
      event,
      user_id: Number.isInteger(userId) ? userId : null,
      ip,
      since: sinceIso,
      next_before: nextBefore,
    });
  } catch (err) {
    captureException(err, { route: 'admin.audit' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/metrics — in-memory request counters + latency percentiles
router.get('/metrics', (req, res) => {
  try {
    const { snapshot } = require('../lib/metrics');
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ ok: true, metrics: snapshot(), ts: new Date().toISOString() });
  } catch (err) {
    captureException(err, { route: 'admin.metrics' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/users?q=<email-prefix>&limit=50 — look up accounts
router.get('/users', (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase().slice(0, 100) : '';
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    let sql = `SELECT u.id, u.email, u.created_at, u.email_verified_at, u.mfa_enabled,
                      s.plan, s.status AS sub_status, s.renewal_date
               FROM users u
               LEFT JOIN subscriptions s ON s.user_id = u.id`;
    const params = [];
    if (q) { sql += ' WHERE LOWER(u.email) LIKE ?'; params.push(`%${q}%`); }
    sql += ' ORDER BY u.created_at DESC LIMIT ?';
    params.push(limit);
    const rows = all(sql, params);
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ rows, limit, q });
  } catch (err) {
    captureException(err, { route: 'admin.users' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
