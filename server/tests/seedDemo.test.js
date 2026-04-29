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

describe('DELETE /reviews/seed — clear demo data', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('removes only is_demo=1 rows and reports the count', async () => {
    const u = await makeUserWithBusiness('Demo Cleanup Co');
    const seedRes = await request(app).post('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(seedRes.status, 200);
    const added = seedRes.body.reviews_added;
    assert.ok(added > 0);

    const del = await request(app).delete('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);
    assert.strictEqual(del.body.success, true);
    assert.strictEqual(del.body.removed, added);

    // After clear, the account is empty again, so re-seeding is allowed.
    const reseed = await request(app).post('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(reseed.status, 200, 'should be re-seedable after clearing');
    assert.ok(reseed.body.reviews_added > 0);
  });

  test('preserves real (non-demo) reviews when clearing', async () => {
    const u = await makeUserWithBusiness('Mixed Co');
    // Seed demo first
    await request(app).post('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
    // Add a real review on top
    const real = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Real User', rating: 5, review_text: 'Genuine feedback' });
    assert.ok(real.status === 200 || real.status === 201, `expected 2xx, got ${real.status}`);

    const del = await request(app).delete('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);

    const list = await request(app).get('/api/reviews').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.status, 200);
    const remaining = list.body.reviews || list.body;
    assert.strictEqual(remaining.length, 1, 'real review should survive demo clear');
    assert.strictEqual(remaining[0].reviewer_name, 'Real User');
  });

  test('requires auth', async () => {
    const res = await request(app).delete('/api/reviews/seed');
    assert.strictEqual(res.status, 401);
  });

  test('returns 0 removed when there is nothing to clear', async () => {
    const u = await makeUserWithBusiness('Never Seeded Co');
    const del = await request(app).delete('/api/reviews/seed').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);
    assert.strictEqual(del.body.removed, 0);
  });
});
