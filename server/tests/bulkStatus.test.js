// Tests for POST /api/reviews/bulk-status

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('bulk status', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function createReview(token) {
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'google', reviewer_name: 'Alice', rating: 4 });
    return res.body.review;
  }

  test('sets status on multiple reviews', async () => {
    const u = await makeUserWithBusiness();
    const [r1, r2] = await Promise.all([createReview(u.token), createReview(u.token)]);

    const res = await request(app).post('/api/reviews/bulk-status')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r1.id, r2.id], status: 'resolved' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.updated, 2);
  });

  test('clears status with null', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    await request(app).post('/api/reviews/bulk-status')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id], status: 'follow_up' });

    const res = await request(app).post('/api/reviews/bulk-status')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id], status: null });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.updated, 1);
  });

  test('status persists in GET list after bulk set', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    await request(app).post('/api/reviews/bulk-status')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id], status: 'escalated' });

    const list = await request(app).get('/api/reviews').set('Authorization', `Bearer ${u.token}`);
    const found = list.body.reviews.find(rv => rv.id === r.id);
    assert.ok(found, 'review in list');
    assert.strictEqual(found.status, 'escalated');
  });

  test('requires auth', async () => {
    const res = await request(app).post('/api/reviews/bulk-status')
      .send({ review_ids: [1], status: 'resolved' });
    assert.strictEqual(res.status, 401);
  });

  test('returns 400 for invalid status', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    const res = await request(app).post('/api/reviews/bulk-status')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id], status: 'invalid_status' });
    assert.strictEqual(res.status, 400);
  });

  test('returns 400 for empty review_ids', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/reviews/bulk-status')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [], status: 'resolved' });
    assert.strictEqual(res.status, 400);
  });

  test('returns 400 for more than 50 IDs', async () => {
    const u = await makeUserWithBusiness();
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    const res = await request(app).post('/api/reviews/bulk-status')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: ids, status: 'resolved' });
    assert.strictEqual(res.status, 400);
  });

  test('cross-user isolation — silently skips foreign reviews', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const r = await createReview(u1.token);

    const res = await request(app).post('/api/reviews/bulk-status')
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ review_ids: [r.id], status: 'resolved' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.updated, 0);
  });

  test('GET /reviews?status=follow_up returns only matching reviews', async () => {
    const u = await makeUserWithBusiness();
    const r1 = await createReview(u.token);
    const r2 = await createReview(u.token);
    await request(app).post('/api/reviews/bulk-status')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r1.id], status: 'follow_up' });

    const res = await request(app).get('/api/reviews?status=follow_up')
      .set('Authorization', `Bearer ${u.token}`);
    const ids = res.body.reviews.map(r => r.id);
    assert.ok(ids.includes(r1.id), 'follow_up review should be in filtered list');
    assert.ok(!ids.includes(r2.id), 'unset review should not be in filtered list');
  });
});
