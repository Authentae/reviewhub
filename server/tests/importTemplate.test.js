// CSV import template download tests.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request } = require('./helpers');

describe('CSV import template', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /api/reviews/import/template returns CSV with proper headers', async () => {
    const u = await makeUser();
    const res = await request(app)
      .get('/api/reviews/import/template')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.headers['content-disposition'], /reviewhub-import-template\.csv/);
    // Header row + 7 example rows covering multiple platforms and locales
    const rows = res.text.split('\r\n').filter(Boolean);
    assert.strictEqual(rows.length, 8);
    assert.match(rows[0], /^platform,reviewer_name,rating,review_text,response_text,created_at$/);
  });

  test('template includes a Thai-language sample to demonstrate UTF-8', async () => {
    const u = await makeUser();
    const res = await request(app)
      .get('/api/reviews/import/template')
      .set('Authorization', `Bearer ${u.token}`);
    assert.match(res.text, /wongnai/);
    assert.match(res.text, /สมชาย/); // Thai reviewer name
  });

  test('template requires auth (router-level middleware)', async () => {
    const res = await request(app).get('/api/reviews/import/template');
    assert.strictEqual(res.status, 401);
  });
});
