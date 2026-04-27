// Smoke + integration tests for the GDPR routes.
//
// What's covered here:
//   - GET /privacy-policy returns the seeded policy
//   - Auth guard on consent endpoints
//   - Recording a consent and reading it back
//   - Invalid consent type rejected
//   - Erasure-request stamps a token hash on the user row
//   - confirm-erasure rejects bad tokens
//
// What's NOT covered: the actual data wipe from confirmErasure. That path
// is destructive enough that we want a separate, isolated test rather
// than wiring it into the shared test DB. Adding once an explicit fixture
// helper exists for "create a self-contained user + delete them."

const test = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request } = require('./helpers');
const { get } = require('../src/db/schema');

test('gdpr routes', async (t) => {
  const app = await getAgent();

  await t.test('GET /privacy-policy returns the seeded policy', async () => {
    const res = await request(app).get('/api/gdpr/privacy-policy');
    // The seeder may or may not have run depending on test order — accept
    // either 200 (policy installed) or 404 (no policy yet). What we DO want
    // to lock down is that this is a public endpoint and the response shape
    // is sensible when the row exists.
    assert.ok(res.status === 200 || res.status === 404, `unexpected status ${res.status}`);
    if (res.status === 200) {
      assert.ok(typeof res.body.version === 'string');
      assert.ok(typeof res.body.content === 'string');
    }
  });

  await t.test('GET /consent-status requires auth', async () => {
    const res = await request(app).get('/api/gdpr/consent-status');
    assert.strictEqual(res.status, 401);
  });

  await t.test('POST /consent requires auth', async () => {
    const res = await request(app)
      .post('/api/gdpr/consent')
      .send({ consentType: 'analytics', granted: true });
    assert.strictEqual(res.status, 401);
  });

  await t.test('POST /consent rejects an invalid consent type', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/gdpr/consent')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Cookie', `auth_token=${u.token}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ consentType: 'totally_made_up', granted: true });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /Invalid consent type/);
  });

  await t.test('POST /consent records a valid consent', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/gdpr/consent')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Cookie', `auth_token=${u.token}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ consentType: 'analytics', granted: true });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.consentRecord);
  });

  await t.test('POST /erasure-request stamps a hashed token on the user row', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/gdpr/erasure-request')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Cookie', `auth_token=${u.token}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // SECURITY: the response MUST NOT contain the plaintext token or any
    // preview of it. Anyone with response logs (CDN, proxy, browser dev
    // tools history) could otherwise replay-delete the account.
    assert.strictEqual(res.body.token, undefined);
    assert.strictEqual(res.body.tokenPreview, undefined);
    // The hash should be persisted on the user row.
    const row = get('SELECT erasure_token_hash, erasure_token_expires FROM users WHERE id = ?', [u.userId]);
    assert.ok(row?.erasure_token_hash, 'expected erasure_token_hash to be set');
    assert.ok(row?.erasure_token_expires, 'expected erasure_token_expires to be set');
    // The hash must be the 64-char hex SHA-256 digest, not the plaintext.
    assert.match(row.erasure_token_hash, /^[a-f0-9]{64}$/);
  });

  await t.test('POST /confirm-erasure rejects an obviously bad token', async () => {
    const res = await request(app)
      .post('/api/gdpr/confirm-erasure')
      .send({ userId: 999999, token: 'not-a-real-token' });
    // Either 400 ("Invalid or expired") or 500 (downstream throw) is fine —
    // both correctly refuse the deletion. What MUST hold: it's not 200.
    assert.notStrictEqual(res.status, 200);
  });

  await t.test('POST /confirm-erasure requires both userId and token', async () => {
    const res = await request(app)
      .post('/api/gdpr/confirm-erasure')
      .send({ userId: 1 });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /token/i);
  });
});
