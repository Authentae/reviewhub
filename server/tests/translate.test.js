// Tests for POST /api/reviews/:id/translate

const { test, describe, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');
const { insert, run } = require('../src/db/schema');

function seedReview(businessId, text = 'Great place!') {
  return insert(
    `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment)
     VALUES (?, 'google', 'Tester', 5, ?, 'positive')`,
    [businessId, text]
  );
}

describe('POST /api/reviews/:id/translate', () => {
  let app;
  before(async () => { app = await getAgent(); });

  beforeEach(() => {
    process.env.ANTHROPIC_MOCK = '1';
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_MOCK;
  });

  test('requires auth', async () => {
    const res = await request(app).post('/api/reviews/1/translate');
    assert.strictEqual(res.status, 401);
  });

  test('returns 404 for unknown review', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/reviews/9999/translate')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 404);
  });

  test('returns 400 when review has no text', async () => {
    const u = await makeUserWithBusiness();
    const id = seedReview(u.businessId, '');
    const res = await request(app)
      .post(`/api/reviews/${id}/translate`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 400);
  });

  test('returns translated_text + target', async () => {
    const u = await makeUserWithBusiness();
    const id = seedReview(u.businessId, 'Great service!');
    const res = await request(app)
      .post(`/api/reviews/${id}/translate?to=th`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.equal(typeof res.body.translated_text, 'string');
    assert.strictEqual(res.body.target, 'th');
  });

  test('rejects invalid target language by falling back to en', async () => {
    const u = await makeUserWithBusiness();
    const id = seedReview(u.businessId, 'Great service!');
    const res = await request(app)
      .post(`/api/reviews/${id}/translate?to=klingon`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.target, 'en');
  });

  test('cross-user review is not translatable (404)', async () => {
    const u1 = await makeUserWithBusiness('UserOne Co');
    const u2 = await makeUserWithBusiness('UserTwo Co');
    const id = seedReview(u1.businessId);
    const res = await request(app)
      .post(`/api/reviews/${id}/translate`)
      .set('Authorization', `Bearer ${u2.token}`);
    assert.strictEqual(res.status, 404);
  });

  test('response is uncacheable', async () => {
    const u = await makeUserWithBusiness();
    const id = seedReview(u.businessId);
    const res = await request(app)
      .post(`/api/reviews/${id}/translate`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.match(res.headers['cache-control'] || '', /no-store/);
  });
});
