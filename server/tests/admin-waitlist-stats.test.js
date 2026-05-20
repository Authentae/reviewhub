// Tests for GET /api/admin/waitlist-stats — the founder-brief endpoint
// that surfaces Pro/Business demand signal from waitlist_signups.
//
// Critical invariants:
//   - Admin-gated: non-admin gets 404 (not 403, per the enumeration
//     resistance pattern in admin.js).
//   - Unauth gets 401.
//   - Shape contract: { ok, by_plan: [...], recent: [...], ts }.
//   - by_plan rows have plan, total, last_30d, last_7d, latest_at.
//   - recent NEVER includes the email column (PII excluded by design).
//   - Response is no-store / private (operator dashboard data).
//   - Empty DB returns empty arrays, not 500.
//
// Shipped 2026-05-20 per overnight queue item 13. Endpoint itself
// shipped earlier in the 2026-05-19 overnight session (cycle 39 of
// that loop) but never got a direct test.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request, cleanupTempDb } = require('./helpers');

describe('GET /api/admin/waitlist-stats', () => {
  let app;
  before(async () => { app = await getAgent(); });
  after(() => {
    delete process.env.ADMIN_EMAIL;
    cleanupTempDb();
  });

  test('returns 401 to unauthenticated requests', async () => {
    process.env.ADMIN_EMAIL = 'x@x.co';
    const res = await request(app).get('/api/admin/waitlist-stats');
    assert.strictEqual(res.status, 401);
    delete process.env.ADMIN_EMAIL;
  });

  test('returns 404 to non-admin authenticated users (enumeration-resistant)', async () => {
    const u = await makeUser();
    process.env.ADMIN_EMAIL = `someone-else-${Date.now()}@admin.co`;
    const res = await request(app)
      .get('/api/admin/waitlist-stats')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 404);
    delete process.env.ADMIN_EMAIL;
  });

  test('returns 404 when ADMIN_EMAIL is unset', async () => {
    delete process.env.ADMIN_EMAIL;
    const u = await makeUser();
    const res = await request(app)
      .get('/api/admin/waitlist-stats')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 404);
  });

  test('admin caller gets 200 with the documented shape', async () => {
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;

    const res = await request(app)
      .get('/api/admin/waitlist-stats')
      .set('Authorization', `Bearer ${u.token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.ok(Array.isArray(res.body.by_plan), 'by_plan should be an array');
    assert.ok(Array.isArray(res.body.recent), 'recent should be an array');
    assert.strictEqual(typeof res.body.ts, 'string', 'ts should be ISO string');

    delete process.env.ADMIN_EMAIL;
  });

  test('admin response sets Cache-Control: no-store', async () => {
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;

    const res = await request(app)
      .get('/api/admin/waitlist-stats')
      .set('Authorization', `Bearer ${u.token}`);
    const cc = res.headers['cache-control'] || '';
    assert.match(cc, /no-store/);
    assert.match(cc, /private/);

    delete process.env.ADMIN_EMAIL;
  });

  test('by_plan rows have the full shape after a signup', async () => {
    // Insert a real waitlist signup so by_plan has at least one row.
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;

    const signupRes = await request(app)
      .post('/api/waitlist')
      .send({ email: `stats-test-${Date.now()}@test.local`, plan: 'pro' });
    assert.strictEqual(signupRes.status, 200);

    const res = await request(app)
      .get('/api/admin/waitlist-stats')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);

    const pro = res.body.by_plan.find((r) => r.plan === 'pro');
    assert.ok(pro, 'pro plan row should exist after pro signup');
    assert.strictEqual(typeof pro.total, 'number');
    assert.strictEqual(typeof pro.last_30d, 'number');
    assert.strictEqual(typeof pro.last_7d, 'number');
    assert.strictEqual(typeof pro.latest_at, 'string');
    assert.ok(pro.total >= 1, 'total should reflect the new signup');
    assert.ok(pro.last_7d >= 1, 'last_7d should include the just-inserted row');

    delete process.env.ADMIN_EMAIL;
  });

  test('recent rows NEVER include the email column (PII excluded)', async () => {
    // Insert two signups, then verify the API response doesn't echo
    // their email addresses. This is a real data-leak regression guard:
    // if someone naively does SELECT * in the future, this catches it.
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;

    const secretEmail = `pii-leak-canary-${Date.now()}@test.local`;
    await request(app).post('/api/waitlist').send({ email: secretEmail, plan: 'business' });

    const res = await request(app)
      .get('/api/admin/waitlist-stats')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);

    // Check every recent row — none should have `email` key, none should
    // include the canary email anywhere in their serialized form.
    for (const row of res.body.recent) {
      assert.strictEqual(row.email, undefined, 'recent rows must not expose email');
    }
    // Defensive: full body should not contain the canary email anywhere.
    const bodyJson = JSON.stringify(res.body);
    assert.ok(
      !bodyJson.includes(secretEmail),
      `response body must not contain the canary email; found in: ${bodyJson.slice(0, 200)}…`
    );

    delete process.env.ADMIN_EMAIL;
  });

  test('handles empty waitlist table without 500', async () => {
    // Even with no data, the endpoint should return ok:true with empty arrays
    // (a 500 here would silently break /admin/brief). The DB starts with rows
    // from earlier tests in this suite, so we can't get a truly empty table —
    // but the shape contract must hold either way.
    const u = await makeUser();
    process.env.ADMIN_EMAIL = u.email;

    const res = await request(app)
      .get('/api/admin/waitlist-stats')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.ok(Array.isArray(res.body.by_plan));
    assert.ok(Array.isArray(res.body.recent));

    delete process.env.ADMIN_EMAIL;
  });
});
