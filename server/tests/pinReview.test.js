// Integration tests for review pinning (PUT /api/reviews/:id/pin)

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('review pinning', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function makeReview(u, overrides = {}) {
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Alice', rating: 5, ...overrides });
    return res.body.review;
  }

  test('review starts unpinned', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u);
    assert.strictEqual(rev.pinned, 0);
  });

  test('PUT /:id/pin toggles pin on', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u);
    const res = await request(app).put(`/api/reviews/${rev.id}/pin`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.pinned, true);
  });

  test('PUT /:id/pin toggles pin off when already pinned', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u);
    // Pin it
    await request(app).put(`/api/reviews/${rev.id}/pin`)
      .set('Authorization', `Bearer ${u.token}`);
    // Unpin it
    const res = await request(app).put(`/api/reviews/${rev.id}/pin`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.pinned, false);
  });

  test('GET /reviews?pinned=true returns only pinned reviews', async () => {
    const u = await makeUserWithBusiness();
    const r1 = await makeReview(u, { reviewer_name: 'Alice' });
    const r2 = await makeReview(u, { reviewer_name: 'Bob' });
    // Pin r1 only
    await request(app).put(`/api/reviews/${r1.id}/pin`)
      .set('Authorization', `Bearer ${u.token}`);

    const res = await request(app).get('/api/reviews?pinned=true')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.reviews.length, 1);
    assert.strictEqual(res.body.reviews[0].id, r1.id);
  });

  test('pinned filter does not return unpinned reviews', async () => {
    const u = await makeUserWithBusiness();
    await makeReview(u); // unpinned
    const res = await request(app).get('/api/reviews?pinned=true')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.reviews.length, 0);
  });

  test('sort=pinned_first puts pinned reviews first', async () => {
    const u = await makeUserWithBusiness();
    const r1 = await makeReview(u, { reviewer_name: 'Alice' });
    const r2 = await makeReview(u, { reviewer_name: 'Bob' });
    const r3 = await makeReview(u, { reviewer_name: 'Carol' });
    // Pin r2 (the middle one)
    await request(app).put(`/api/reviews/${r2.id}/pin`)
      .set('Authorization', `Bearer ${u.token}`);

    const res = await request(app).get('/api/reviews?sort=pinned_first')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.reviews[0].id, r2.id);
  });

  test('requires auth', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u);
    const res = await request(app).put(`/api/reviews/${rev.id}/pin`);
    assert.strictEqual(res.status, 401);
  });

  test('cannot pin another user review', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const rev = await makeReview(u1);
    const res = await request(app).put(`/api/reviews/${rev.id}/pin`)
      .set('Authorization', `Bearer ${u2.token}`);
    assert.strictEqual(res.status, 404);
  });

  test('returns 400 for invalid review ID', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).put('/api/reviews/abc/pin')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 400);
  });

  test('persists pin state in DB', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u);
    await request(app).put(`/api/reviews/${rev.id}/pin`)
      .set('Authorization', `Bearer ${u.token}`);

    const { get } = require('../src/db/schema');
    const stored = get('SELECT pinned FROM reviews WHERE id = ?', [rev.id]);
    assert.strictEqual(stored.pinned, 1);
  });
});
