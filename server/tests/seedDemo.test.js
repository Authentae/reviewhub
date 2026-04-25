// Integration tests for POST /api/reviews/seed — the onboarding "Try demo data" path.
//
// Critical invariant: the endpoint must work in production for users with no
// existing reviews (new users onboarding). The previous gate refused ALL
// production traffic unless SEED_DEMO=1 was set globally, which silently
// broke the onboarding "Try demo data" button for every real customer.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('POST /reviews/seed — onboarding demo data', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('allows seeding when the user has zero reviews (onboarding case)', async () => {
    const u = await makeUserWithBusiness('Empty Co');
    const res = await request(app).post('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.reviews_added > 0, 'should add demo reviews on empty account');
  });

  test('blocks seeding on an account that already has reviews', async () => {
    const u = await makeUserWithBusiness('Has Reviews Co');
    // First seed succeeds
    const first = await request(app).post('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(first.status, 200);
    // Second seed should 403 — not an empty account anymore
    const second = await request(app).post('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(second.status, 403);
    assert.match(second.body.error, /empty/i);
  });

  test('requires auth', async () => {
    const res = await request(app).post('/api/reviews/seed');
    assert.strictEqual(res.status, 401);
  });

  test('respects SEED_DEMO=1 operator override even with existing reviews', async () => {
    const u = await makeUserWithBusiness('Staging Co');
    await request(app).post('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
    const prev = process.env.SEED_DEMO;
    process.env.SEED_DEMO = '1';
    try {
      const res = await request(app).post('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
      assert.strictEqual(res.status, 200, 'SEED_DEMO=1 should bypass the empty-account gate');
    } finally {
      if (prev === undefined) delete process.env.SEED_DEMO; else process.env.SEED_DEMO = prev;
    }
  });
});
