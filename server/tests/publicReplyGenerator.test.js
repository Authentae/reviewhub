// Tests for the free no-signup AI reply generator at
// POST /api/public/review-reply-generator.
//
// This is the PLG top-of-funnel — must work without any auth, must reject
// obvious garbage, must rate-limit.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request } = require('./helpers');

describe('public review-reply-generator endpoint', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('returns a draft for a valid unauthenticated request', async () => {
    const res = await request(app).post('/api/public/review-reply-generator').send({
      reviewer_name: 'Alice',
      rating: 5,
      review_text: 'Amazing food, will definitely come back!',
      business_name: 'Corner Bistro',
      platform: 'google',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.draft === 'string');
    assert.ok(res.body.draft.length > 0);
    assert.ok(['ai', 'template'].includes(res.body.source));
  });

  test('does not require auth', async () => {
    // No Authorization header
    const res = await request(app).post('/api/public/review-reply-generator').send({
      rating: 3, review_text: 'It was fine.',
    });
    assert.strictEqual(res.status, 200);
  });

  test('requires review_text', async () => {
    const res = await request(app).post('/api/public/review-reply-generator').send({
      rating: 5,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /review_text/);
  });

  test('requires rating 1-5', async () => {
    const r1 = await request(app).post('/api/public/review-reply-generator').send({
      rating: 0, review_text: 'x',
    });
    assert.strictEqual(r1.status, 400);
    const r2 = await request(app).post('/api/public/review-reply-generator').send({
      rating: 10, review_text: 'x',
    });
    assert.strictEqual(r2.status, 400);
    const r3 = await request(app).post('/api/public/review-reply-generator').send({
      rating: 'bad', review_text: 'x',
    });
    assert.strictEqual(r3.status, 400);
  });

  test('rejects review_text over 2000 chars', async () => {
    const huge = 'x'.repeat(2001);
    const res = await request(app).post('/api/public/review-reply-generator').send({
      rating: 3, review_text: huge,
    });
    assert.strictEqual(res.status, 400);
  });

  test('accepts missing optional fields (reviewer_name, business_name, platform)', async () => {
    const res = await request(app).post('/api/public/review-reply-generator').send({
      rating: 4, review_text: 'Pretty good experience overall.',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.draft.length > 0);
  });
});
