// Tests for POST /api/newsletter — public newsletter signup endpoint.
//
// Mirrors the validation surface of waitlist.test.js: valid signup,
// idempotency on duplicate email, honeypot fake-200 with NO row, missing
// email, invalid email format, source truncation, NODE_ENV=test bypass
// of the rate limiter (so supertest doesn't 429 the 5th request).

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request } = require('./helpers');

describe('POST /api/newsletter', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('accepts a valid signup', async () => {
    const r = await request(app)
      .post('/api/newsletter')
      .send({ email: `nl-${Date.now()}-valid@test.local`, source: 'landing' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.ok, true);
  });

  test('idempotent on duplicate email: returns already=true on resubmit', async () => {
    const email = `nl-idem-${Date.now()}@test.local`;
    const first = await request(app).post('/api/newsletter').send({ email, source: 'landing' });
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.ok, true);
    assert.ok(!first.body.already, 'first submit should not be marked already');

    const second = await request(app).post('/api/newsletter').send({ email, source: 'blog-index' });
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.body.ok, true);
    assert.strictEqual(second.body.already, true, 'resubmit should be marked already');
  });

  test('honeypot field returns fake-200 and does NOT insert a row', async () => {
    const { all } = require('../src/db/schema');
    const email = `nl-honey-${Date.now()}@test.local`;
    const r = await request(app)
      .post('/api/newsletter')
      .send({ email, source: 'landing', website: 'http://spam.example' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.ok, true);
    const rows = all('SELECT id FROM newsletter_signups WHERE email = ?', [email]);
    assert.strictEqual(rows.length, 0, 'honeypot submission must not insert');
  });

  test('rejects missing email', async () => {
    const r = await request(app).post('/api/newsletter').send({ source: 'landing' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /email/i);
  });

  test('rejects invalid email format', async () => {
    const r = await request(app)
      .post('/api/newsletter')
      .send({ email: 'not-an-email', source: 'landing' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /email/i);
  });

  test('rejects email that is just a dot', async () => {
    const r = await request(app)
      .post('/api/newsletter')
      .send({ email: '.', source: 'landing' });
    assert.strictEqual(r.status, 400);
  });

  test('truncates source field to 64 chars without erroring', async () => {
    const { get } = require('../src/db/schema');
    const email = `nl-src-${Date.now()}@test.local`;
    const r = await request(app)
      .post('/api/newsletter')
      .send({ email, source: 'a'.repeat(500) });
    assert.strictEqual(r.status, 200);
    const row = get('SELECT source FROM newsletter_signups WHERE email = ?', [email]);
    assert.ok(row, 'row should exist');
    assert.ok(row.source.length <= 64, `source should be <=64, got ${row.source.length}`);
  });

  test('email gets normalized to lowercase before uniqueness check', async () => {
    const stamp = Date.now();
    const upper = await request(app)
      .post('/api/newsletter')
      .send({ email: `NL-CASE-${stamp}@TEST.LOCAL`, source: 'landing' });
    const lower = await request(app)
      .post('/api/newsletter')
      .send({ email: `nl-case-${stamp}@test.local`, source: 'blog-index' });
    assert.strictEqual(upper.status, 200);
    assert.strictEqual(lower.status, 200);
    assert.strictEqual(lower.body.already, true, 'case variant should dedup');
  });

  test('accepts source values used by the live widget surfaces', async () => {
    for (const source of ['landing', 'blog-index', 'blog-post:chatgpt-for-google-review-replies']) {
      const r = await request(app)
        .post('/api/newsletter')
        .send({ email: `nl-${source.replace(/[^a-z0-9]/g, '-')}-${Date.now()}@test.local`, source });
      assert.strictEqual(r.status, 200, `source ${source} should be accepted`);
    }
  });
});
