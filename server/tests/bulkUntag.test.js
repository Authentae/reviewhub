// Tests for POST /api/reviews/bulk-untag

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('bulk untag', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function createReview(token) {
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'google', reviewer_name: 'Bob', rating: 5, review_text: 'Great!' });
    return res.body.review;
  }

  async function createTag(token, name = 'TestTag') {
    const res = await request(app).post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, color: '#4f46e5' });
    return res.body;
  }

  async function applyTag(token, reviewId, tagId) {
    return request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${token}`)
      .send({ review_ids: [reviewId], tag_id: tagId });
  }

  test('removes tag from multiple reviews', async () => {
    const u = await makeUserWithBusiness();
    const [r1, r2] = await Promise.all([createReview(u.token), createReview(u.token)]);
    const tag = await createTag(u.token);
    await applyTag(u.token, r1.id, tag.id);
    await applyTag(u.token, r2.id, tag.id);

    const res = await request(app).post('/api/reviews/bulk-untag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r1.id, r2.id], tag_id: tag.id });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.untagged, 2);
  });

  test('is idempotent — removing tag that is not applied does not error', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    const tag = await createTag(u.token, 'Idempotent');

    const res = await request(app).post('/api/reviews/bulk-untag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id], tag_id: tag.id });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.untagged, 1);
  });

  test('tag no longer appears on review after bulk-untag', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    const tag = await createTag(u.token, 'RemoveMe');
    await applyTag(u.token, r.id, tag.id);

    await request(app).post('/api/reviews/bulk-untag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id], tag_id: tag.id });

    const list = await request(app).get('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`);
    const found = list.body.reviews.find(rv => rv.id === r.id);
    assert.ok(found, 'review should still exist');
    const tagIds = (found.tags || []).map(t => t.id);
    assert.ok(!tagIds.includes(tag.id), 'tag should be removed');
  });

  test('requires auth', async () => {
    const res = await request(app).post('/api/reviews/bulk-untag')
      .send({ review_ids: [1], tag_id: 1 });
    assert.strictEqual(res.status, 401);
  });

  test('returns 400 for missing review_ids', async () => {
    const u = await makeUserWithBusiness();
    const tag = await createTag(u.token, 'Missing');
    const res = await request(app).post('/api/reviews/bulk-untag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ tag_id: tag.id });
    assert.strictEqual(res.status, 400);
  });

  test('returns 400 for more than 50 IDs', async () => {
    const u = await makeUserWithBusiness();
    const tag = await createTag(u.token, 'TooMany');
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    const res = await request(app).post('/api/reviews/bulk-untag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: ids, tag_id: tag.id });
    assert.strictEqual(res.status, 400);
  });

  test('returns 404 for tag not owned by user', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const r = await createReview(u1.token);
    const tag = await createTag(u2.token, 'OtherOwner');

    const res = await request(app).post('/api/reviews/bulk-untag')
      .set('Authorization', `Bearer ${u1.token}`)
      .send({ review_ids: [r.id], tag_id: tag.id });
    assert.strictEqual(res.status, 404);
  });

  test('cross-user isolation — silently skips foreign reviews', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const r = await createReview(u1.token);
    const tag = await createTag(u2.token, 'IsolationTag');

    const res = await request(app).post('/api/reviews/bulk-untag')
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ review_ids: [r.id], tag_id: tag.id });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.untagged, 0);
  });
});
