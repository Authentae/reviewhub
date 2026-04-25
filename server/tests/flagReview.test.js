// Tests for review flagging feature

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('flag review', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function createReview(token) {
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'google', reviewer_name: 'Alice', rating: 4, review_text: 'Good service' });
    return res.body.review;
  }

  test('review starts unflagged', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    assert.strictEqual(r.flagged, 0);
  });

  test('PUT /flag toggles flag on', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    const res = await request(app).put(`/api/reviews/${r.id}/flag`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.flagged, true);
  });

  test('PUT /flag toggles flag off on second call', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    await request(app).put(`/api/reviews/${r.id}/flag`).set('Authorization', `Bearer ${u.token}`);
    const res = await request(app).put(`/api/reviews/${r.id}/flag`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.flagged, false);
  });

  test('flag state persists in GET list', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    await request(app).put(`/api/reviews/${r.id}/flag`).set('Authorization', `Bearer ${u.token}`);
    const list = await request(app).get('/api/reviews').set('Authorization', `Bearer ${u.token}`);
    const found = list.body.reviews.find(rv => rv.id === r.id);
    assert.ok(found, 'review should be in list');
    assert.strictEqual(found.flagged, 1);
  });

  test('GET /reviews?flagged=true returns only flagged reviews', async () => {
    const u = await makeUserWithBusiness();
    const r1 = await createReview(u.token);
    const r2 = await createReview(u.token);
    await request(app).put(`/api/reviews/${r1.id}/flag`).set('Authorization', `Bearer ${u.token}`);

    const res = await request(app).get('/api/reviews?flagged=true')
      .set('Authorization', `Bearer ${u.token}`);
    const ids = res.body.reviews.map(r => r.id);
    assert.ok(ids.includes(r1.id), 'flagged review should be in filtered list');
    assert.ok(!ids.includes(r2.id), 'unflagged review should not be in filtered list');
  });

  test('requires auth', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    const res = await request(app).put(`/api/reviews/${r.id}/flag`);
    assert.strictEqual(res.status, 401);
  });

  test('cross-user isolation — cannot flag another user review', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const r = await createReview(u1.token);
    const res = await request(app).put(`/api/reviews/${r.id}/flag`)
      .set('Authorization', `Bearer ${u2.token}`);
    assert.strictEqual(res.status, 404);
  });

  test('returns 400 for invalid review ID', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).put('/api/reviews/abc/flag')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 400);
  });

  test('returns 404 for non-existent review', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).put('/api/reviews/999999/flag')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 404);
  });
});
