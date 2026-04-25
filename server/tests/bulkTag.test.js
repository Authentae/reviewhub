// Tests for bulk-tag endpoint

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('bulk tag', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function createReview(token) {
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'google', reviewer_name: 'Bob', rating: 5, review_text: 'Great!' });
    return res.body.review;
  }

  async function createTag(token, name = 'VIP') {
    const res = await request(app).post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, color: '#ff0000' });
    return res.body;
  }

  test('tags multiple reviews at once', async () => {
    const u = await makeUserWithBusiness();
    const [r1, r2] = await Promise.all([createReview(u.token), createReview(u.token)]);
    const tag = await createTag(u.token);

    const res = await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r1.id, r2.id], tag_id: tag.id });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tagged, 2);
  });

  test('is idempotent — applying same tag twice does not error', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    const tag = await createTag(u.token);

    await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id], tag_id: tag.id });

    const res = await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id], tag_id: tag.id });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tagged, 1);
  });

  test('requires auth', async () => {
    const res = await request(app).post('/api/reviews/bulk-tag')
      .send({ review_ids: [1], tag_id: 1 });
    assert.strictEqual(res.status, 401);
  });

  test('returns 400 for missing review_ids', async () => {
    const u = await makeUserWithBusiness();
    const tag = await createTag(u.token);
    const res = await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ tag_id: tag.id });
    assert.strictEqual(res.status, 400);
  });

  test('returns 400 for empty review_ids', async () => {
    const u = await makeUserWithBusiness();
    const tag = await createTag(u.token);
    const res = await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [], tag_id: tag.id });
    assert.strictEqual(res.status, 400);
  });

  test('returns 400 for more than 50 IDs', async () => {
    const u = await makeUserWithBusiness();
    const tag = await createTag(u.token);
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    const res = await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: ids, tag_id: tag.id });
    assert.strictEqual(res.status, 400);
  });

  test('returns 400 for invalid review ID', async () => {
    const u = await makeUserWithBusiness();
    const tag = await createTag(u.token);
    const res = await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: ['abc'], tag_id: tag.id });
    assert.strictEqual(res.status, 400);
  });

  test('returns 400 for invalid tag_id', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    const res = await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id], tag_id: 'bad' });
    assert.strictEqual(res.status, 400);
  });

  test('returns 404 for tag not owned by user', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const r = await createReview(u1.token);
    const tag = await createTag(u2.token, 'OtherTag');

    const res = await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u1.token}`)
      .send({ review_ids: [r.id], tag_id: tag.id });
    assert.strictEqual(res.status, 404);
  });

  test('cross-user isolation — silently skips reviews not owned by user', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const r = await createReview(u1.token);
    const tag = await createTag(u2.token, 'U2Tag');

    const res = await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ review_ids: [r.id], tag_id: tag.id });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tagged, 0);
  });

  test('tag appears on review after bulk-tag', async () => {
    const u = await makeUserWithBusiness();
    const r = await createReview(u.token);
    const tag = await createTag(u.token, 'CheckTag');

    await request(app).post('/api/reviews/bulk-tag')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id], tag_id: tag.id });

    const list = await request(app).get('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`);
    const found = list.body.reviews.find(rv => rv.id === r.id);
    assert.ok(found, 'review should be in list');
    const tagIds = (found.tags || []).map(tg => tg.id);
    assert.ok(tagIds.includes(tag.id), 'tag should appear on review');
  });
});
