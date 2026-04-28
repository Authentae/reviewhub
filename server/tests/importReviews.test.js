// Integration tests for POST /api/reviews/import (CSV bulk import)

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('CSV import', () => {
  let app;
  before(async () => { app = await getAgent(); });

  function csv(...lines) {
    return lines.join('\r\n');
  }

  const HEADER = 'platform,reviewer_name,rating,review_text,response_text,created_at';

  test('imports valid reviews', async () => {
    const u = await makeUserWithBusiness();
    const body = csv(
      HEADER,
      'google,Alice,5,"Great place!","Thank you Alice!",',
      'yelp,Bob,3,Average,,2024-01-15T10:00:00Z'
    );
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.imported, 2);
    assert.strictEqual(res.body.skipped, 0);
    assert.strictEqual(res.body.errors.length, 0);
  });

  test('requires auth', async () => {
    const body = csv(HEADER, 'google,Alice,5,,');
    const res = await request(app).post('/api/reviews/import')
      .set('Content-Type', 'text/plain')
      .send(body);
    assert.strictEqual(res.status, 401);
  });

  test('rejects empty body', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send('');
    assert.strictEqual(res.status, 400);
  });

  test('rejects missing required columns', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(csv('reviewer_name,rating', 'Alice,5'));
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('platform'));
  });

  test('skips rows with unknown platform', async () => {
    const u = await makeUserWithBusiness();
    const body = csv(HEADER, 'twitter,Alice,5,,', 'google,Bob,4,,');
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.imported, 1);
    assert.strictEqual(res.body.skipped, 1);
    assert.ok(res.body.errors[0].error.includes('twitter'));
  });

  test('skips rows with invalid rating', async () => {
    const u = await makeUserWithBusiness();
    const body = csv(HEADER, 'google,Alice,6,,', 'google,Bob,0,,', 'google,Carol,3,,');
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);
    assert.strictEqual(res.body.imported, 1);
    assert.strictEqual(res.body.skipped, 2);
  });

  test('skips rows with missing reviewer_name', async () => {
    const u = await makeUserWithBusiness();
    const body = csv(HEADER, 'google,,4,,');
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);
    assert.strictEqual(res.body.skipped, 1);
  });

  test('persists created_at from CSV when provided', async () => {
    const u = await makeUserWithBusiness();
    const body = csv(HEADER, 'google,Dave,5,Nice!,,2023-06-01T00:00:00Z');
    await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);

    const { all } = require('../src/db/schema');
    const { get } = require('../src/db/schema');
    const { get: getDb } = require('../src/db/schema');
    const biz = getDb('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    const rows = all('SELECT * FROM reviews WHERE business_id = ? AND reviewer_name = ?', [biz.id, 'Dave']);
    assert.strictEqual(rows.length, 1);
    assert.ok(rows[0].created_at.startsWith('2023-06-01'));
  });

  test('uses default created_at when not provided', async () => {
    const u = await makeUserWithBusiness();
    const body = csv(HEADER, 'yelp,Eve,4,Good,,');
    await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);

    const { all, get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    const rows = all('SELECT created_at FROM reviews WHERE business_id = ? AND reviewer_name = ?', [biz.id, 'Eve']);
    assert.strictEqual(rows.length, 1);
    assert.ok(rows[0].created_at); // set to DB default (now)
  });

  test('handles quoted fields with commas', async () => {
    const u = await makeUserWithBusiness();
    const body = 'platform,reviewer_name,rating,review_text\r\ngoogle,"Smith, John",5,"Good food, great service"';
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);
    assert.strictEqual(res.body.imported, 1);

    const { all, get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    const rows = all('SELECT * FROM reviews WHERE business_id = ?', [biz.id]);
    assert.strictEqual(rows[0].reviewer_name, 'Smith, John');
    assert.strictEqual(rows[0].review_text, 'Good food, great service');
  });

  test('handles quoted fields with escaped quotes', async () => {
    const u = await makeUserWithBusiness();
    const body = 'platform,reviewer_name,rating,review_text\r\ngoogle,Alice,5,"She said ""amazing!"""';
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);
    assert.strictEqual(res.body.imported, 1);
  });

  test('imports response_text from CSV', async () => {
    const u = await makeUserWithBusiness();
    const body = csv(HEADER, 'google,Frank,5,Loved it.,Thanks Frank!,');
    await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);

    const { all, get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    const rows = all("SELECT * FROM reviews WHERE business_id = ? AND reviewer_name = 'Frank'", [biz.id]);
    assert.strictEqual(rows[0].response_text, 'Thanks Frank!');
  });

  test('assigns correct sentiment', async () => {
    const u = await makeUserWithBusiness();
    const body = csv('platform,reviewer_name,rating', 'google,Alice,5', 'yelp,Bob,1');
    await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);

    const { all, get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    const rows = all('SELECT * FROM reviews WHERE business_id = ? ORDER BY rating DESC', [biz.id]);
    assert.strictEqual(rows[0].sentiment, 'positive');
    assert.strictEqual(rows[1].sentiment, 'negative');
  });

  test('rejects more than 500 rows', async () => {
    const u = await makeUserWithBusiness();
    const dataRows = Array.from({ length: 501 }, (_, i) => `google,User${i},${(i%5)+1},,`);
    const body = [HEADER, ...dataRows].join('\r\n');
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('500'));
  });

  test('cross-user isolation — cannot import to another user business', async () => {
    // Each user gets their own business; importing goes to the authenticated user's business only
    const u1 = await makeUserWithBusiness('Biz1');
    const u2 = await makeUserWithBusiness('Biz2');
    const body = csv(HEADER, 'google,Alice,5,,');
    await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u1.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);

    const { all, get } = require('../src/db/schema');
    const biz2 = get('SELECT id FROM businesses WHERE user_id = ?', [u2.userId]);
    const rows = all('SELECT * FROM reviews WHERE business_id = ?', [biz2.id]);
    assert.strictEqual(rows.length, 0);
  });

  test('skips rows with unparseable created_at and reports error', async () => {
    const u = await makeUserWithBusiness();
    const body = csv(
      HEADER,
      'google,Valid,5,Good,,2026-04-15T09:30:00Z',
      'yelp,Bad Date,4,Ok,,not-a-date'
    );
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.imported, 1);
    assert.strictEqual(res.body.skipped, 1);
    assert.ok(res.body.errors[0].error.includes('Invalid date'));
  });

  test('accepts locale-specific platforms (tabelog, naver, dianping, wongnai)', async () => {
    // Lock in that the centralized platform registry covers the locale
    // platforms a Thai/Japanese/Korean/Chinese SMB would actually paste in.
    const u = await makeUserWithBusiness();
    const body = csv(
      HEADER,
      'wongnai,Som,5,อร่อยมาก,,',
      'tabelog,Tanaka,4,おいしかったです,,',
      'naver,Kim,5,맛집!,,',
      'dianping,Wang,3,一般般,,',
      'reclameaqui,Silva,2,Atendimento ruim,,'
    );
    const res = await request(app).post('/api/reviews/import')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/plain')
      .send(body);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.imported, 5);
    assert.strictEqual(res.body.skipped, 0);
  });
});
