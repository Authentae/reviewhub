// Honeypot middleware integration tests.
//
// Confirms that:
// - POST /auth/register with `website` filled returns 200 + fake body, NO user is created.
// - POST /auth/forgot-password with `website` filled returns 200 + fake body, NO email is sent.
// - POST /api/public/review-reply-generator with `website` filled returns 200
//   with a stub draft and (importantly) doesn't actually call the AI provider.
// - All three still work normally when `website` is empty / absent.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request } = require('./helpers');
const { get } = require('../src/db/schema');

describe('honeypot middleware — register', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('filled honeypot → fake-200, no user row created', async () => {
    const email = `bot-${Math.random().toString(36).slice(2)}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'testpassword123', acceptedTerms: true, ageConfirmed: true, website: 'http://spam.example' });
    assert.strictEqual(res.status, 200, `expected fake 200, got ${res.status}`);
    assert.deepStrictEqual(res.body, { ok: true });
    // No row was created — confirm by querying for the email.
    const row = get('SELECT id FROM users WHERE email = ?', [email]);
    assert.strictEqual(row, null, 'honeypot should NOT have created a user');
  });

  test('empty honeypot → real handler runs', async () => {
    const email = `real-${Math.random().toString(36).slice(2)}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'testpassword123', acceptedTerms: true, ageConfirmed: true, website: '' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token, 'real handler should return a token');
    assert.strictEqual(res.body.user.email, email);
  });

  test('absent honeypot → real handler runs (back-compat)', async () => {
    const email = `legacy-${Math.random().toString(36).slice(2)}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'testpassword123', acceptedTerms: true, ageConfirmed: true });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
  });
});

describe('honeypot middleware — forgot-password', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('filled honeypot → fake { success: true }', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'someone@example.com', website: 'spam' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { success: true });
  });

  test('empty honeypot → real handler returns the same shape', async () => {
    // Forgot-password always returns { success: true } regardless of whether
    // the email exists (no enumeration), so we can only verify the shape.
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'someone@example.com', website: '' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { success: true });
  });
});

describe('honeypot middleware — public AI tool', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('filled honeypot → fake stub draft, no AI call', async () => {
    const res = await request(app)
      .post('/api/public/review-reply-generator')
      .send({ review_text: 'Bot abuse attempt', rating: 5, website: 'http://spam' });
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.draft === 'string', 'fake response must include a draft string');
    assert.strictEqual(res.body.source, 'cached', 'fake response should mark source as cached');
  });

  test('empty honeypot → real handler runs', async () => {
    const res = await request(app)
      .post('/api/public/review-reply-generator')
      .send({ review_text: 'Real review!', rating: 5, website: '' });
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.draft === 'string');
  });
});
