// Tests for PUT /api/reviews/:id/status

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('review status', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function makeReview(u) {
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Alice', rating: 4 });
    return res.body.review;
  }

  test('review starts with null status', async () => {
    const u = await makeUserWithBusiness();
    const r = await makeReview(u);
    assert.strictEqual(r.status, null);
  });

  test('sets status to follow_up', async () => {
    const u = await makeUserWithBusiness();
    const r = await makeReview(u);
    const res = await request(app).put(`/api/reviews/${r.id}/status`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ status: 'follow_up' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'follow_up');
  });

  test('sets status to resolved', async () => {
    const u = await makeUserWithBusiness();
    const r = await makeReview(u);
    const res = await request(app).put(`/api/reviews/${r.id}/status`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ status: 'resolved' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'resolved');
  });

  test('sets status to escalated', async () => {
    const u = await makeUserWithBusiness();
    const r = await makeReview(u);
    const res = await request(app).put(`/api/reviews/${r.id}/status`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ status: 'escalated' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'escalated');
  });

  test('clears status with null', async () => {
    const u = await makeUserWithBusiness();
    const r = await makeReview(u);
    await request(app).put(`/api/reviews/${r.id}/status`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ status: 'follow_up' });
    const res = await request(app).put(`/api/reviews/${r.id}/status`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ status: null });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, null);
  });

  test('status persists in GET list', async () => {
    const u = await makeUserWithBusiness();
    const r = await makeReview(u);
    await request(app).put(`/api/reviews/${r.id}/status`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ status: 'resolved' });
    const list = await request(app).get('/api/reviews').set('Authorization', `Bearer ${u.token}`);
    const found = list.body.reviews.find(rv => rv.id === r.id);
    assert.ok(found, 'review in list');
    assert.strictEqual(found.status, 'resolved');
  });

  test('returns 400 for invalid status', async () => {
    const u = await makeUserWithBusiness();
    const r = await makeReview(u);
    const res = await request(app).put(`/api/reviews/${r.id}/status`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ status: 'bad_value' });
    assert.strictEqual(res.status, 400);
  });

  test('returns 400 for invalid review ID', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).put('/api/reviews/abc/status')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ status: 'resolved' });
    assert.strictEqual(res.status, 400);
  });

  test('requires auth', async () => {
    const u = await makeUserWithBusiness();
    const r = await makeReview(u);
    const res = await request(app).put(`/api/reviews/${r.id}/status`)
      .send({ status: 'resolved' });
    assert.strictEqual(res.status, 401);
  });

  test('cross-user isolation — cannot set status on another user review', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const r = await makeReview(u1);
    const res = await request(app).put(`/api/reviews/${r.id}/status`)
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ status: 'resolved' });
    assert.strictEqual(res.status, 404);
  });
});
