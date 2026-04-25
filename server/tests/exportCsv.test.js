// Tests for GET /api/reviews/export/csv — CSV format integrity.
// Plan gating is covered by planEnforcement.test.js; this covers format.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, setPlan, request } = require('./helpers');

describe('CSV export format', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function addReview(u, body) {
    return request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`).send({
      platform: 'google',
      reviewer_name: 'Alice',
      rating: 5,
      ...body,
    });
  }

  test('returns Content-Type text/csv and Content-Disposition attachment', async () => {
    const u = await makeUserWithBusiness('CSV Co', 'pro');
    await addReview(u, { review_text: 'Great!' });
    const res = await request(app).get('/api/reviews/export/csv').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.headers['content-disposition'], /attachment/);
    assert.match(res.headers['content-disposition'], /\.csv/);
  });

  test('CSV contains a header row', async () => {
    const u = await makeUserWithBusiness('CSV Co', 'pro');
    await addReview(u, { review_text: 'A' });
    const res = await request(app).get('/api/reviews/export/csv').set('Authorization', `Bearer ${u.token}`);
    const firstLine = res.text.split(/\r?\n/)[0].toLowerCase();
    assert.ok(firstLine.includes('platform'));
    assert.ok(firstLine.includes('rating'));
    assert.ok(firstLine.includes('review'));
  });

  test('CSV escapes quotes and commas in review text', async () => {
    const u = await makeUserWithBusiness('Escape Co', 'pro');
    await addReview(u, { review_text: 'He said "hello", which was nice, indeed' });
    const res = await request(app).get('/api/reviews/export/csv').set('Authorization', `Bearer ${u.token}`);
    // Quotes must be doubled per RFC 4180; commas inside the quoted field are preserved literally
    assert.match(res.text, /""hello""/);
    // The full field must be wrapped in quotes since it contains a comma
    assert.match(res.text, /"[^"]*He said ""hello"", which was nice, indeed[^"]*"/);
  });

  test('CSV honors the platform filter', async () => {
    const u = await makeUserWithBusiness('Filter Co', 'pro');
    await addReview(u, { platform: 'google', reviewer_name: 'G1', review_text: 'google one' });
    await addReview(u, { platform: 'yelp', reviewer_name: 'Y1', review_text: 'yelp one' });
    const res = await request(app).get('/api/reviews/export/csv?platform=yelp').set('Authorization', `Bearer ${u.token}`);
    assert.ok(res.text.includes('yelp one'));
    assert.ok(!res.text.includes('google one'));
  });

  test('CSV requires auth', async () => {
    const res = await request(app).get('/api/reviews/export/csv');
    assert.strictEqual(res.status, 401);
  });

  test('JSON export has the same filter semantics as CSV', async () => {
    const u = await makeUserWithBusiness('JSON Co', 'pro');
    await addReview(u, { platform: 'google', reviewer_name: 'G', review_text: 'google review' });
    await addReview(u, { platform: 'yelp', reviewer_name: 'Y', review_text: 'yelp review' });
    const res = await request(app).get('/api/reviews/export/json?platform=yelp').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    const body = JSON.parse(res.text);
    assert.ok(Array.isArray(body.reviews));
    assert.ok(body.reviews.every(r => r.platform === 'yelp'));
  });
});
