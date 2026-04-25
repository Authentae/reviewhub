// Integration tests for GET /api/reviews/keywords

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('keywords', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function seedReviews(token, reviews) {
    for (const r of reviews) {
      await request(app).post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send(r);
    }
  }

  test('returns empty keywords for user with no reviews', async () => {
    const u = await makeUserWithBusiness('Keywords Co', 'pro');
    const res = await request(app).get('/api/reviews/keywords')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.keywords, []);
  });

  test('requires auth', async () => {
    const res = await request(app).get('/api/reviews/keywords');
    assert.strictEqual(res.status, 401);
  });

  test('returns top keywords from review text', async () => {
    const u = await makeUserWithBusiness('Keywords Co', 'pro');
    await seedReviews(u.token, [
      { platform: 'google', reviewer_name: 'Alice', rating: 5, review_text: 'Great food great service amazing food' },
      { platform: 'google', reviewer_name: 'Bob', rating: 4, review_text: 'Great location amazing staff very friendly' },
      { platform: 'google', reviewer_name: 'Carol', rating: 5, review_text: 'Amazing food and great atmosphere' },
    ]);
    const res = await request(app).get('/api/reviews/keywords')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    const words = res.body.keywords.map(k => k.word);
    assert.ok(words.includes('great'), 'expected "great" in keywords');
    assert.ok(words.includes('amazing'), 'expected "amazing" in keywords');
    // Stop words should not appear
    assert.ok(!words.includes('and'), '"and" should be filtered');
    assert.ok(!words.includes('the'), '"the" should be filtered');
  });

  test('keywords have word and count fields', async () => {
    const u = await makeUserWithBusiness('Keywords Co', 'pro');
    await seedReviews(u.token, [
      { platform: 'google', reviewer_name: 'Alice', rating: 5, review_text: 'wonderful service wonderful place wonderful food' },
      { platform: 'google', reviewer_name: 'Bob', rating: 5, review_text: 'wonderful experience' },
    ]);
    const res = await request(app).get('/api/reviews/keywords')
      .set('Authorization', `Bearer ${u.token}`);
    const kw = res.body.keywords.find(k => k.word === 'wonderful');
    assert.ok(kw, 'expected "wonderful" in keywords');
    assert.ok(typeof kw.count === 'number' && kw.count >= 2);
  });

  test('sorted by count descending', async () => {
    const u = await makeUserWithBusiness('Keywords Co', 'pro');
    await seedReviews(u.token, [
      { platform: 'google', reviewer_name: 'A', rating: 5, review_text: 'perfect perfect perfect perfect service service' },
      { platform: 'google', reviewer_name: 'B', rating: 5, review_text: 'perfect service wonderful' },
      { platform: 'google', reviewer_name: 'C', rating: 5, review_text: 'perfect wonderful' },
    ]);
    const res = await request(app).get('/api/reviews/keywords')
      .set('Authorization', `Bearer ${u.token}`);
    const counts = res.body.keywords.map(k => k.count);
    for (let i = 1; i < counts.length; i++) {
      assert.ok(counts[i] <= counts[i - 1], 'keywords should be sorted descending');
    }
  });

  test('filters by platform', async () => {
    const u = await makeUserWithBusiness('Keywords Co', 'pro');
    await seedReviews(u.token, [
      { platform: 'google', reviewer_name: 'A', rating: 5, review_text: 'excellent google review excellent google excellent' },
      { platform: 'yelp', reviewer_name: 'B', rating: 4, review_text: 'decent yelp experience decent yelp decent' },
    ]);
    const res = await request(app).get('/api/reviews/keywords?platform=google')
      .set('Authorization', `Bearer ${u.token}`);
    const words = res.body.keywords.map(k => k.word);
    assert.ok(words.includes('excellent'), 'expected "excellent"');
    assert.ok(!words.includes('decent'), '"decent" should not appear when filtered to google');
  });

  test('filters by sentiment', async () => {
    const u = await makeUserWithBusiness('Keywords Co', 'pro');
    await seedReviews(u.token, [
      { platform: 'google', reviewer_name: 'A', rating: 5, review_text: 'brilliant brilliant brilliant service wonderful', sentiment: 'positive' },
      { platform: 'google', reviewer_name: 'B', rating: 1, review_text: 'terrible terrible terrible experience horrible', sentiment: 'negative' },
    ]);
    const res = await request(app).get('/api/reviews/keywords?sentiment=positive')
      .set('Authorization', `Bearer ${u.token}`);
    const words = res.body.keywords.map(k => k.word);
    assert.ok(words.includes('brilliant'), 'expected "brilliant"');
    assert.ok(!words.includes('terrible'), '"terrible" should not appear for positive filter');
  });

  test('words appearing only once are excluded', async () => {
    const u = await makeUserWithBusiness('Keywords Co', 'pro');
    await seedReviews(u.token, [
      { platform: 'google', reviewer_name: 'A', rating: 5, review_text: 'xyzunique once and repeated repeated repeated' },
    ]);
    const res = await request(app).get('/api/reviews/keywords')
      .set('Authorization', `Bearer ${u.token}`);
    const words = res.body.keywords.map(k => k.word);
    assert.ok(!words.includes('xyzunique'), 'hapax words should be excluded');
    assert.ok(words.includes('repeated'));
  });

  test('cross-user isolation — only returns keywords for own reviews', async () => {
    const u1 = await makeUserWithBusiness('Keywords Co', 'pro');
    const u2 = await makeUserWithBusiness('Keywords Co', 'pro');
    await seedReviews(u1.token, [
      { platform: 'google', reviewer_name: 'A', rating: 5, review_text: 'uniquewordfortestingonly uniquewordfortestingonly uniquewordfortestingonly' },
    ]);
    const res = await request(app).get('/api/reviews/keywords')
      .set('Authorization', `Bearer ${u2.token}`);
    const words = res.body.keywords.map(k => k.word);
    assert.ok(!words.includes('uniquewordfortestingonly'), 'should not see other user keywords');
  });

  test('filters by date_from and date_to', async () => {
    const u = await makeUserWithBusiness('Keywords Co', 'pro');
    // We can only test that the endpoint accepts these params without error
    const res = await request(app).get('/api/reviews/keywords?date_from=2020-01-01&date_to=2099-12-31')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.keywords));
  });
});
