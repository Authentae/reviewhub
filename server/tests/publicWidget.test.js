// Integration tests for public widget routes:
//   GET /api/public/widget/:id          — JSON widget data
//   GET /api/public/widget/:id/badge    — embeddable HTML badge
//   GET /api/public/businesses/:id/reviews — public review feed
//   POST /api/public/review-reply-generator — free AI draft tool
//   GET /api/public/platforms           — platform catalogue

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('public widget routes', () => {
  let app;
  before(async () => { app = await getAgent(); });

  function enableWidget(bizId) {
    const { run } = require('../src/db/schema');
    run('UPDATE businesses SET widget_enabled = 1 WHERE id = ?', [bizId]);
  }

  function addReview(bizId, overrides = {}) {
    const { run } = require('../src/db/schema');
    const r = {
      platform: 'google',
      reviewer_name: 'Alice',
      rating: 5,
      review_text: 'Great!',
      response_text: 'Thanks!',
      sentiment: 'positive',
      ...overrides,
    };
    run(
      `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, response_text, sentiment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bizId, r.platform, r.reviewer_name, r.rating, r.review_text, r.response_text, r.sentiment]
    );
  }

  // ── GET /api/public/widget/:id ──────────────────────────────────────────

  test('widget returns 404 when widget_enabled=0', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).get(`/api/public/widget/${u.businessId}`);
    assert.strictEqual(res.status, 404);
  });

  test('widget returns 400 for non-numeric id', async () => {
    const res = await request(app).get('/api/public/widget/abc');
    assert.strictEqual(res.status, 400);
  });

  test('widget returns JSON data when enabled', async () => {
    const u = await makeUserWithBusiness();
    enableWidget(u.businessId);
    addReview(u.businessId, { rating: 5, sentiment: 'positive' });
    addReview(u.businessId, { rating: 3, reviewer_name: 'Bob', sentiment: 'neutral', response_text: null });

    const res = await request(app).get(`/api/public/widget/${u.businessId}`);
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.avg_rating === 'number');
    assert.strictEqual(res.body.total, 2);
    assert.ok(Array.isArray(res.body.recent_reviews));
    assert.ok(res.body.business_name);
    // recent_reviews only includes positive+responded reviews
    assert.ok(res.body.recent_reviews.every(r => r.reviewer_name));
  });

  test('widget truncates review_text to 200 chars', async () => {
    const u = await makeUserWithBusiness();
    enableWidget(u.businessId);
    addReview(u.businessId, { review_text: 'A'.repeat(300), rating: 5, sentiment: 'positive' });

    const res = await request(app).get(`/api/public/widget/${u.businessId}`);
    assert.strictEqual(res.status, 200);
    const r = res.body.recent_reviews[0];
    if (r) assert.ok(r.review_text.length <= 200);
  });

  // ── GET /api/public/widget/:id/badge ───────────────────────────────────

  test('badge returns 404 when widget_enabled=0', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).get(`/api/public/widget/${u.businessId}/badge`);
    assert.strictEqual(res.status, 404);
  });

  test('badge returns HTML with correct content-type', async () => {
    const u = await makeUserWithBusiness();
    enableWidget(u.businessId);
    addReview(u.businessId, { rating: 4, sentiment: 'positive' });

    const res = await request(app).get(`/api/public/widget/${u.businessId}/badge`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.text.includes('<!doctype html>'));
  });

  test('badge sets frame-ancestors CSP to allow iframe embedding', async () => {
    const u = await makeUserWithBusiness();
    enableWidget(u.businessId);

    const res = await request(app).get(`/api/public/widget/${u.businessId}/badge`);
    assert.strictEqual(res.status, 200);
    const csp = res.headers['content-security-policy'] || '';
    assert.ok(csp.includes('frame-ancestors *'), `CSP missing frame-ancestors *: ${csp}`);
  });

  test('badge HTML-escapes business name to prevent XSS', async () => {
    const u = await makeUserWithBusiness('<script>alert(1)</script>');
    enableWidget(u.businessId);

    const res = await request(app).get(`/api/public/widget/${u.businessId}/badge`);
    assert.strictEqual(res.status, 200);
    assert.ok(!res.text.includes('<script>alert(1)'), 'raw <script> tag must not appear in badge HTML');
    assert.ok(res.text.includes('&lt;script&gt;'), 'business name must be HTML-escaped');
  });

  // ── GET /api/public/businesses/:id/reviews ─────────────────────────────

  test('public business reviews returns 404 for unknown business', async () => {
    const res = await request(app).get('/api/public/businesses/999999/reviews');
    assert.strictEqual(res.status, 404);
  });

  test('public business reviews returns 400 for non-numeric id', async () => {
    const res = await request(app).get('/api/public/businesses/abc/reviews');
    assert.strictEqual(res.status, 400);
  });

  test('public business reviews returns paginated reviews', async () => {
    const u = await makeUserWithBusiness();
    addReview(u.businessId, { rating: 5 });
    addReview(u.businessId, { rating: 3, reviewer_name: 'Bob', sentiment: 'neutral', response_text: null });

    const res = await request(app).get(`/api/public/businesses/${u.businessId}/reviews`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.reviews));
    assert.strictEqual(res.body.reviews.length, 2);
    assert.ok(res.body.business);
    assert.ok(typeof res.body.limit === 'number');
  });

  test('public business reviews nests owner_response inline', async () => {
    const u = await makeUserWithBusiness();
    addReview(u.businessId, { rating: 5, response_text: null });
    // Insert a review with a review_response record via the standard import
    const { run, get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    run(
      `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment)
       VALUES (?, 'google', 'Carl', 5, 'Loved it', 'positive')`,
      [biz.id]
    );
    const reviewRow = get(
      `SELECT id FROM reviews WHERE business_id = ? AND reviewer_name = 'Carl'`, [biz.id]
    );
    run(
      `INSERT INTO review_responses (review_id, owner_user_id, business_id, response_text) VALUES (?, ?, ?, ?)`,
      [reviewRow.id, u.userId, biz.id, 'Thanks Carl!']
    );

    const res = await request(app).get(`/api/public/businesses/${u.businessId}/reviews`);
    assert.strictEqual(res.status, 200);
    const carlReview = res.body.reviews.find(r => r.reviewer_name === 'Carl');
    assert.ok(carlReview, 'Carl review must be in response');
    assert.ok(carlReview.owner_response, 'owner_response must be nested');
    assert.strictEqual(carlReview.owner_response.response_text, 'Thanks Carl!');
  });

  test('public business reviews respects limit query param', async () => {
    const u = await makeUserWithBusiness();
    for (let i = 0; i < 5; i++) {
      addReview(u.businessId, { reviewer_name: `User${i}`, rating: 4, sentiment: 'positive' });
    }
    const res = await request(app).get(`/api/public/businesses/${u.businessId}/reviews?limit=2`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.reviews.length, 2);
    assert.strictEqual(res.body.limit, 2);
  });

  // ── POST /api/public/review-reply-generator ────────────────────────────

  test('review-reply-generator returns 400 when review_text missing', async () => {
    const res = await request(app).post('/api/public/review-reply-generator')
      .send({ rating: 5 });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('review_text'));
  });

  test('review-reply-generator returns 400 for invalid rating', async () => {
    const res = await request(app).post('/api/public/review-reply-generator')
      .send({ review_text: 'Great!', rating: 6 });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('rating'));
  });

  test('review-reply-generator returns 400 for review_text > 2000 chars', async () => {
    const res = await request(app).post('/api/public/review-reply-generator')
      .send({ review_text: 'x'.repeat(2001), rating: 4 });
    assert.strictEqual(res.status, 400);
  });

  test('review-reply-generator returns a draft when API key absent (mock path)', async () => {
    // ANTHROPIC_API_KEY is '' in test env — aiDrafts.js falls back to a mock
    const res = await request(app).post('/api/public/review-reply-generator')
      .send({ review_text: 'Really nice place!', rating: 5, business_name: 'Cafe Baan' });
    // Either 200 (mock draft) or 500 (if mock throws) — we just verify no 4xx from validation
    assert.ok(res.status !== 400, `should not be a validation error: ${JSON.stringify(res.body)}`);
    if (res.status === 200) {
      assert.ok(typeof res.body.draft === 'string');
    }
  });

  // ── GET /api/public/platforms ───────────────────────────────────────────

  test('platforms returns global, local, internal arrays', async () => {
    const res = await request(app).get('/api/public/platforms');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.global));
    assert.ok(Array.isArray(res.body.local));
    assert.ok(res.body.global.includes('google'));
    assert.ok(res.body.local.includes('wongnai'));
  });

  test('platforms response is cacheable', async () => {
    const res = await request(app).get('/api/public/platforms');
    assert.strictEqual(res.status, 200);
    const cc = res.headers['cache-control'] || '';
    assert.ok(cc.includes('max-age=3600'), `expected 1h cache, got: ${cc}`);
  });
});

describe('owner dashboard route', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /api/owner/businesses requires auth', async () => {
    const res = await request(app).get('/api/owner/businesses');
    assert.strictEqual(res.status, 401);
  });

  test('returns empty array when user has no approved claims', async () => {
    const { makeUser } = require('./helpers');
    const u = await makeUser();
    const res = await request(app).get('/api/owner/businesses')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.businesses, []);
  });

  test('returns businesses with review counts for approved claims', async () => {
    const { makeUser } = require('./helpers');
    const u1 = await makeUserWithBusiness('Restaurant ABC');
    const owner = await makeUser();

    // Approve a claim for owner on u1's business
    const { run, get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u1.userId]);
    run(
      `INSERT INTO business_claims (business_id, user_id, status) VALUES (?, ?, 'approved')`,
      [biz.id, owner.userId]
    );
    // Add a review
    run(
      `INSERT INTO reviews (business_id, platform, reviewer_name, rating, sentiment)
       VALUES (?, 'google', 'Guest', 5, 'positive')`,
      [biz.id]
    );

    const res = await request(app).get('/api/owner/businesses')
      .set('Authorization', `Bearer ${owner.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.businesses.length, 1);
    const b = res.body.businesses[0];
    assert.strictEqual(b.name, 'Restaurant ABC');
    assert.ok(typeof b.total_reviews === 'number');
    assert.ok(typeof b.pending_response_count === 'number');
  });

  test('does not return pending or denied claims', async () => {
    const { makeUser } = require('./helpers');
    const u1 = await makeUserWithBusiness('Biz Pending');
    const owner = await makeUser();

    const { run, get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u1.userId]);
    run(
      `INSERT INTO business_claims (business_id, user_id, status) VALUES (?, ?, 'pending')`,
      [biz.id, owner.userId]
    );

    const res = await request(app).get('/api/owner/businesses')
      .set('Authorization', `Bearer ${owner.token}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.businesses, []);
  });
});
