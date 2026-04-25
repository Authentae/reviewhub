// Tests for response time stats in GET /api/reviews/analytics

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('response time analytics', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function getAnalytics(token) {
    return request(app).get('/api/reviews/analytics')
      .set('Authorization', `Bearer ${token}`);
  }

  function addReview(businessId, opts = {}) {
    const { run } = require('../src/db/schema');
    const createdAt = opts.created_at || '2024-01-01 10:00:00';
    const respondedAt = opts.responded_at || null;
    run(
      `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, created_at, responded_at, response_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [businessId, 'google', 'Tester', 5, 'Great!', createdAt, respondedAt,
        respondedAt ? 'Thank you!' : null]
    );
  }

  test('responseTime is null when no reviews have responded_at', async () => {
    const u = await makeUserWithBusiness('Response Time Co', 'pro');
    const res = await getAnalytics(u.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.responseTime, null);
  });

  test('responseTime has correct shape when reviews exist', async () => {
    const u = await makeUserWithBusiness('Response Time Co', 'pro');
    addReview(u.businessId, {
      created_at: '2024-01-01 10:00:00',
      responded_at: '2024-01-01 16:00:00',
    });

    const res = await getAnalytics(u.token);
    assert.strictEqual(res.status, 200);
    const rt = res.body.responseTime;
    assert.ok(rt, 'responseTime should not be null');
    assert.ok(typeof rt.avg_hours === 'number');
    assert.ok(typeof rt.pct_within_24h === 'number');
    assert.ok(typeof rt.pct_within_7d === 'number');
    assert.ok(typeof rt.responded_count === 'number');
    assert.strictEqual(rt.responded_count, 1);
  });

  test('avg_hours is computed correctly', async () => {
    const u = await makeUserWithBusiness('Response Time Co', 'pro');
    addReview(u.businessId, {
      created_at: '2024-01-01 00:00:00',
      responded_at: '2024-01-01 12:00:00', // exactly 12 hours
    });

    const res = await getAnalytics(u.token);
    const rt = res.body.responseTime;
    assert.strictEqual(rt.avg_hours, 12);
    assert.strictEqual(rt.pct_within_24h, 100);
    assert.strictEqual(rt.pct_within_7d, 100);
  });

  test('pct_within_24h is 0 when response is over 24h', async () => {
    const u = await makeUserWithBusiness('Response Time Co', 'pro');
    addReview(u.businessId, {
      created_at: '2024-01-01 00:00:00',
      responded_at: '2024-01-03 00:00:00', // 48 hours later
    });

    const res = await getAnalytics(u.token);
    const rt = res.body.responseTime;
    assert.strictEqual(rt.pct_within_24h, 0);
    assert.strictEqual(rt.pct_within_7d, 100);
  });

  test('pct_within_7d is 0 when response is over 7 days', async () => {
    const u = await makeUserWithBusiness('Response Time Co', 'pro');
    addReview(u.businessId, {
      created_at: '2024-01-01 00:00:00',
      responded_at: '2024-01-10 00:00:00', // 9 days later
    });

    const res = await getAnalytics(u.token);
    const rt = res.body.responseTime;
    assert.strictEqual(rt.pct_within_24h, 0);
    assert.strictEqual(rt.pct_within_7d, 0);
  });

  test('percentages are correct with mixed response times', async () => {
    const u = await makeUserWithBusiness('Response Time Co', 'pro');
    // 2 within 24h, 1 between 24h-7d, 1 over 7d = 4 total
    addReview(u.businessId, { created_at: '2024-01-01 00:00:00', responded_at: '2024-01-01 06:00:00' });
    addReview(u.businessId, { created_at: '2024-01-01 00:00:00', responded_at: '2024-01-01 20:00:00' });
    addReview(u.businessId, { created_at: '2024-01-01 00:00:00', responded_at: '2024-01-03 00:00:00' });
    addReview(u.businessId, { created_at: '2024-01-01 00:00:00', responded_at: '2024-01-10 00:00:00' });

    const res = await getAnalytics(u.token);
    const rt = res.body.responseTime;
    assert.strictEqual(rt.responded_count, 4);
    assert.strictEqual(rt.pct_within_24h, 50);  // 2/4
    assert.strictEqual(rt.pct_within_7d, 75);   // 3/4
  });

  test('unresponded reviews are excluded from stats', async () => {
    const u = await makeUserWithBusiness('Response Time Co', 'pro');
    addReview(u.businessId, { responded_at: null });
    addReview(u.businessId, { responded_at: null });

    const res = await getAnalytics(u.token);
    assert.strictEqual(res.body.responseTime, null);
  });

  test('requires auth', async () => {
    const res = await request(app).get('/api/reviews/analytics');
    assert.strictEqual(res.status, 401);
  });
});
