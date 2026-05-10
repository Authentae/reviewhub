// Integration tests for the admin-only routes.
//
// Critical security invariants:
//   - Without ADMIN_EMAIL set, the surface is 404 regardless of auth.
//   - With ADMIN_EMAIL set, non-admin callers get 404 (not 403, to avoid
//     enumeration of the admin endpoint).
//   - Admin endpoints return useful data to the matching caller.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request, cleanupTempDb } = require('./helpers');

describe('admin routes', () => {
  let app;
  before(async () => { app = await getAgent(); });
  after(() => {
    delete process.env.ADMIN_EMAIL;
    cleanupTempDb();
  });

  test('returns 404 when ADMIN_EMAIL is unset', async () => {
    delete process.env.ADMIN_EMAIL;
    const u = await makeUser();
    const res = await request(app).get('/api/admin/stats')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 404);
  });

  test('non-admin caller gets 404 (enumeration-resistant)', async () => {
    const u = await makeUser();
    // Set admin to a different email than the caller
    process.env.ADMIN_EMAIL = `different-${Date.now()}@admin.co`;
    const res = await request(app).get('/api/admin/stats')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 404);
    delete process.env.ADMIN_EMAIL;
  });

  test('unauth caller gets 401 before the admin gate', async () => {
    process.env.ADMIN_EMAIL = 'x@x.co';
    const res = await request(app).get('/api/admin/stats');
    assert.strictEqual(res.status, 401);
    delete process.env.ADMIN_EMAIL;
  });

  test('admin caller sees stats, audit, and users', async () => {
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;

    const statsRes = await request(app).get('/api/admin/stats')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(statsRes.status, 200);
    assert.ok(typeof statsRes.body.stats.users === 'number');
    assert.ok(statsRes.body.stats.subs_by_plan);
    // Enriched fields from the late-pass admin stats update
    assert.ok(typeof statsRes.body.stats.users_verified === 'number');
    assert.ok(typeof statsRes.body.stats.signups_24h === 'number');
    assert.ok(typeof statsRes.body.stats.subs_paying === 'number');
    assert.ok(typeof statsRes.body.stats.reviews_unresponded === 'number');

    const auditRes = await request(app).get('/api/admin/audit?limit=10')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(auditRes.status, 200);
    assert.ok(Array.isArray(auditRes.body.rows));

    const usersRes = await request(app).get('/api/admin/users?limit=5')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(usersRes.status, 200);
    assert.ok(Array.isArray(usersRes.body.rows));
    // The just-registered admin should appear
    assert.ok(usersRes.body.rows.some(r => r.email === u.email));

    delete process.env.ADMIN_EMAIL;
  });

  test('admin gate works when JWT carries id only (no email) — regression for silent-404 bug', async () => {
    // Magic-link sign-in and password-reset re-issue mint JWTs with only
    // {id, iat, exp} — no email field — for minimal-payload reasons. Before
    // commit 8ce7e81, the admin gate compared req.user.email (undefined →
    // empty string) to ADMIN_EMAIL and silently 404'd to every caller,
    // including the legitimate admin. This test pins down the contract:
    // the admin gate MUST resolve email by user_id when req.user.email
    // is missing.
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;

    // Mint a JWT with id only — same shape as magic-link / pwd-reset issues.
    const { signToken } = require('../src/middleware/auth');
    const idOnlyToken = signToken({ id: u.userId });

    const res = await request(app).get('/api/admin/stats')
      .set('Authorization', `Bearer ${idOnlyToken}`);
    assert.strictEqual(res.status, 200, 'admin gate must resolve email from DB when JWT lacks email field');
    assert.ok(typeof res.body.stats.users === 'number');

    delete process.env.ADMIN_EMAIL;
  });

  test('admin outreach-stats: returns summary + audits, omits share_token', async () => {
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;

    const res = await request(app).get('/api/admin/outreach-stats')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.summary, 'summary present');
    assert.ok(typeof res.body.summary.total === 'number', 'total is number');
    assert.ok(typeof res.body.summary.opened === 'number', 'opened is number');
    assert.ok(typeof res.body.summary.not_opened === 'number', 'not_opened is number');
    assert.ok(typeof res.body.summary.replied === 'number', 'replied is number');
    assert.ok(typeof res.body.summary.total_views === 'number', 'total_views is number');
    assert.ok(Array.isArray(res.body.audits), 'audits is array');
    assert.strictEqual(typeof res.body.audits_truncated, 'boolean', 'audits_truncated flag present');
    // Security invariant: share_token MUST NOT appear in any row.
    for (const row of res.body.audits) {
      assert.strictEqual(row.share_token, undefined, 'share_token leaked into row');
    }

    delete process.env.ADMIN_EMAIL;
  });

  test('admin __whoami: reports env + match status without leaking values', async () => {
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;

    const res = await request(app).get('/api/admin/__whoami')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.admin_email_set, true);
    assert.strictEqual(typeof res.body.admin_email_length, 'number');
    assert.strictEqual(res.body.caller_email_present, true);
    assert.strictEqual(res.body.match, true);
    // Doesn't leak the actual values
    assert.strictEqual(res.body.admin_email, undefined);
    assert.strictEqual(res.body.caller_email, undefined);

    delete process.env.ADMIN_EMAIL;
  });

  test('admin metrics exposes request counts + latency percentiles', async () => {
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;
    // Generate some traffic so counters have something to report
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);

    const res = await request(app).get('/api/admin/metrics')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.metrics.requests.total >= 2);
    assert.ok(res.body.metrics.requests.by_status['2xx'] >= 1);
    assert.ok(typeof res.body.metrics.latency_ms.sample_size === 'number');
    assert.ok(res.body.metrics.memory_mb.rss > 0);
    assert.ok(res.body.metrics.uptime_seconds >= 0);
    delete process.env.ADMIN_EMAIL;
  });

  test('admin audit filter by event works', async () => {
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;
    const res = await request(app)
      .get('/api/admin/audit?event=user.register&limit=5')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    // Every returned row must match the requested event
    for (const row of res.body.rows) {
      assert.strictEqual(row.event, 'user.register');
    }
    delete process.env.ADMIN_EMAIL;
  });

  test('admin audit pagination via before=<id> returns next_before cursor', async () => {
    // Register a handful of users so there are 3+ user.register rows
    await makeUser(); await makeUser(); await makeUser();
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;

    // Page 1: limit=2
    const p1 = await request(app)
      .get('/api/admin/audit?event=user.register&limit=2')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(p1.status, 200);
    assert.strictEqual(p1.body.rows.length, 2);
    // next_before should be set because we asked for exactly `limit` rows
    assert.ok(Number.isInteger(p1.body.next_before) && p1.body.next_before > 0);

    // Page 2: using the cursor
    const p2 = await request(app)
      .get(`/api/admin/audit?event=user.register&limit=2&before=${p1.body.next_before}`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(p2.status, 200);
    // Returned rows must all have id < cursor
    for (const row of p2.body.rows) {
      assert.ok(row.id < p1.body.next_before);
    }
    // And must not overlap with page 1
    const p1Ids = new Set(p1.body.rows.map(r => r.id));
    for (const row of p2.body.rows) {
      assert.ok(!p1Ids.has(row.id));
    }
    delete process.env.ADMIN_EMAIL;
  });

  test('admin audit since= filter returns only events after the cutoff', async () => {
    const u1 = await makeUser();
    // Capture a cutoff between u1's register and u2's register. Sleep a beat
    // so SQLite's second-resolution timestamps differ.
    await new Promise((r) => setTimeout(r, 1100));
    const cutoffIso = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 1100));
    const u2 = await makeUser();

    const admin = await makeUser();
    process.env.ADMIN_EMAIL = admin.email;
    const res = await request(app)
      .get(`/api/admin/audit?event=user.register&since=${encodeURIComponent(cutoffIso)}&limit=50`)
      .set('Authorization', `Bearer ${admin.token}`);
    assert.strictEqual(res.status, 200);
    const userIds = res.body.rows.map(r => r.user_id);
    // u2 registered after the cutoff → must be in the results
    assert.ok(userIds.includes(u2.userId), 'u2 registered after cutoff — should be present');
    // u1 registered before the cutoff → must NOT be in the results
    assert.ok(!userIds.includes(u1.userId), 'u1 registered before cutoff — should be filtered out');
    delete process.env.ADMIN_EMAIL;
  });

  test('admin audit user_id filter returns only that user\'s events', async () => {
    const target = await makeUser(); // the user we want events for
    const other  = await makeUser();
    const admin  = await makeUser();
    process.env.ADMIN_EMAIL = admin.email;
    const res = await request(app)
      .get(`/api/admin/audit?user_id=${target.userId}&limit=50`)
      .set('Authorization', `Bearer ${admin.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.rows.length >= 1, 'should return at least the register event');
    for (const row of res.body.rows) {
      assert.strictEqual(row.user_id, target.userId);
    }
    // `other` user's events must NOT appear
    const otherEvents = res.body.rows.filter(r => r.user_id === other.userId);
    assert.strictEqual(otherEvents.length, 0);
    delete process.env.ADMIN_EMAIL;
  });
});
