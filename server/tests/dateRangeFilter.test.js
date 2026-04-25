// Integration tests for date_from / date_to filter on GET /api/reviews

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');
const { insert, get } = require('../src/db/schema');

describe('date range filter', () => {
  let app;
  before(async () => { app = await getAgent(); });

  // Helper: insert a review with a specific created_at
  function insertWithDate(businessId, reviewerName, date) {
    return insert(
      'INSERT INTO reviews (business_id, platform, reviewer_name, rating, sentiment, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [businessId, 'google', reviewerName, 4, 'positive', date]
    );
  }

  test('date_from filters out older reviews', async () => {
    const u = await makeUserWithBusiness();
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    insertWithDate(biz.id, 'OldAlice', '2023-01-15 10:00:00');
    insertWithDate(biz.id, 'NewBob',   '2024-06-01 10:00:00');

    const res = await request(app).get('/api/reviews?date_from=2024-01-01')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    const names = res.body.reviews.map(r => r.reviewer_name);
    assert.ok(names.includes('NewBob'));
    assert.ok(!names.includes('OldAlice'));
  });

  test('date_to filters out newer reviews', async () => {
    const u = await makeUserWithBusiness();
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    insertWithDate(biz.id, 'OldCarol', '2022-03-10 10:00:00');
    insertWithDate(biz.id, 'NewDave',  '2025-01-20 10:00:00');

    const res = await request(app).get('/api/reviews?date_to=2023-01-01')
      .set('Authorization', `Bearer ${u.token}`);
    const names = res.body.reviews.map(r => r.reviewer_name);
    assert.ok(names.includes('OldCarol'));
    assert.ok(!names.includes('NewDave'));
  });

  test('date_from and date_to together narrow to a range', async () => {
    const u = await makeUserWithBusiness();
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    insertWithDate(biz.id, 'Before', '2022-01-01 00:00:00');
    insertWithDate(biz.id, 'Inside', '2023-06-15 12:00:00');
    insertWithDate(biz.id, 'After',  '2024-12-31 23:59:59');

    const res = await request(app).get('/api/reviews?date_from=2023-01-01&date_to=2023-12-31')
      .set('Authorization', `Bearer ${u.token}`);
    const names = res.body.reviews.map(r => r.reviewer_name);
    assert.ok(names.includes('Inside'));
    assert.ok(!names.includes('Before'));
    assert.ok(!names.includes('After'));
  });

  test('rejects non-ISO date strings (ignored, not error)', async () => {
    const u = await makeUserWithBusiness();
    // Invalid date format is silently ignored — returns all reviews
    const res = await request(app).get('/api/reviews?date_from=not-a-date')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
  });

  test('date filter works alongside platform filter', async () => {
    const u = await makeUserWithBusiness();
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    insertWithDate(biz.id, 'GoogleOld', '2022-05-01 00:00:00');
    insert(
      'INSERT INTO reviews (business_id, platform, reviewer_name, rating, sentiment, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [biz.id, 'yelp', 'YelpNew', 4, 'positive', '2024-05-01 00:00:00']
    );
    insertWithDate(biz.id, 'GoogleNew', '2024-05-01 00:00:00');

    const res = await request(app).get('/api/reviews?platform=google&date_from=2023-01-01')
      .set('Authorization', `Bearer ${u.token}`);
    const names = res.body.reviews.map(r => r.reviewer_name);
    assert.ok(names.includes('GoogleNew'));
    assert.ok(!names.includes('GoogleOld'));
    assert.ok(!names.includes('YelpNew'));
  });

  test('date filter affects filteredStats count', async () => {
    const u = await makeUserWithBusiness();
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    insertWithDate(biz.id, 'A', '2022-01-01 00:00:00');
    insertWithDate(biz.id, 'B', '2023-01-01 00:00:00');
    insertWithDate(biz.id, 'C', '2024-01-01 00:00:00');

    const res = await request(app).get('/api/reviews?date_from=2023-01-01')
      .set('Authorization', `Bearer ${u.token}`);
    assert.ok(res.body.filteredStats);
    assert.strictEqual(res.body.filteredStats.total, 2);
  });
});
