// Tests for POST /api/waitlist — the Pro/Business demand-signal endpoint
// in routes/waitlist.js. Public no-auth endpoint that captures email +
// plan + source for gated tiers that aren't sellable yet.
//
// Critical to test because:
//   1. Validation (email format, plan allowlist) — silently accepting
//      garbage corrupts the demand signal we use for build-vs-kill calls
//   2. Idempotency via UNIQUE(email, plan) — double-submit must not
//      double-count or 500
//   3. The endpoint never mutates an active customer's state (it's purely
//      a marketing-page lead capture), but it DOES email the founder on
//      every signup; failures must be silent on the founder side, not
//      block the user-facing 200
//   4. Rate limit guards a public endpoint — should reject after N
//      submissions per IP

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request } = require('./helpers');

describe('POST /api/waitlist', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('accepts a valid pro signup', async () => {
    const r = await request(app)
      .post('/api/waitlist')
      .send({ email: `wl-${Date.now()}-1@test.local`, plan: 'pro' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.ok, true);
  });

  test('accepts a valid business signup', async () => {
    const r = await request(app)
      .post('/api/waitlist')
      .send({ email: `wl-${Date.now()}-2@test.local`, plan: 'business' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.ok, true);
  });

  test('idempotent on same email+plan: returns already=true on resubmit', async () => {
    const email = `wl-idem-${Date.now()}@test.local`;
    const first = await request(app).post('/api/waitlist').send({ email, plan: 'pro' });
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.ok, true);
    assert.ok(!first.body.already, 'first submit should not be marked already');

    const second = await request(app).post('/api/waitlist').send({ email, plan: 'pro' });
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.body.ok, true);
    assert.strictEqual(second.body.already, true, 'resubmit should be marked already');
  });

  test('same email on a different plan creates a separate row', async () => {
    const email = `wl-multi-${Date.now()}@test.local`;
    const pro = await request(app).post('/api/waitlist').send({ email, plan: 'pro' });
    const business = await request(app).post('/api/waitlist').send({ email, plan: 'business' });
    assert.strictEqual(pro.status, 200);
    assert.strictEqual(business.status, 200);
    // Neither should report `already` — they're different (email, plan) tuples
    assert.ok(!pro.body.already);
    assert.ok(!business.body.already);
  });

  test('rejects invalid email format', async () => {
    const r = await request(app)
      .post('/api/waitlist')
      .send({ email: 'not-an-email', plan: 'pro' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /email/i);
  });

  test('rejects email that is just a dot', async () => {
    const r = await request(app)
      .post('/api/waitlist')
      .send({ email: '.', plan: 'pro' });
    assert.strictEqual(r.status, 400);
  });

  test('rejects missing email', async () => {
    const r = await request(app)
      .post('/api/waitlist')
      .send({ plan: 'pro' });
    assert.strictEqual(r.status, 400);
  });

  test('rejects empty plan', async () => {
    const r = await request(app)
      .post('/api/waitlist')
      .send({ email: 'a@b.co', plan: '' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /plan/i);
  });

  test('rejects plan outside the allowlist (e.g. "starter")', async () => {
    // 'starter' is a real plan but it's NOT gated — it's sellable. Waitlist
    // is exclusively for gated tiers. Sending starter here is either a
    // client bug or a probe; either way reject so the table stays clean.
    const r = await request(app)
      .post('/api/waitlist')
      .send({ email: 'a@b.co', plan: 'starter' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /plan/i);
  });

  test('rejects plan with arbitrary string (no SQL injection signal)', async () => {
    const r = await request(app)
      .post('/api/waitlist')
      .send({ email: 'a@b.co', plan: "'; DROP TABLE waitlist_signups; --" });
    assert.strictEqual(r.status, 400);
  });

  test('truncates source field to 32 chars without erroring', async () => {
    // source is a free-text attribution field ('pricing', 'audit', etc.).
    // We slice(0, 32) defensively rather than reject — a long source is
    // a client-side mistake, not a security issue, and rejecting would
    // silently lose a real waitlist signup. Test verifies the 200 path.
    const r = await request(app)
      .post('/api/waitlist')
      .send({
        email: `wl-src-${Date.now()}@test.local`,
        plan: 'pro',
        source: 'a'.repeat(500),
      });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.ok, true);
  });

  test('email gets normalized to lowercase before uniqueness check', async () => {
    // 'X@TEST.local' and 'x@test.local' should be treated as the same signup.
    // Without normalization, attackers could pollute the demand signal by
    // submitting case variants.
    const stamp = Date.now();
    const upper = await request(app)
      .post('/api/waitlist')
      .send({ email: `WL-CASE-${stamp}@TEST.LOCAL`, plan: 'pro' });
    const lower = await request(app)
      .post('/api/waitlist')
      .send({ email: `wl-case-${stamp}@test.local`, plan: 'pro' });
    assert.strictEqual(upper.status, 200);
    assert.strictEqual(lower.status, 200);
    assert.strictEqual(lower.body.already, true, 'case variant should dedup');
  });
});
