// Integration tests for onboarding-dismiss endpoint + /me onboarding_dismissed field

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request } = require('./helpers');

describe('onboarding dismiss', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /auth/me exposes onboarding_dismissed=false by default', async () => {
    const u = await makeUser();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.onboarding_dismissed, false);
  });

  test('POST /auth/onboarding/dismiss sets the flag', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/auth/onboarding/dismiss')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.dismissed, true);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(me.body.user.onboarding_dismissed, true);
  });

  test('POST /auth/onboarding/dismiss is idempotent', async () => {
    const u = await makeUser();
    const res1 = await request(app)
      .post('/api/auth/onboarding/dismiss')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res1.status, 200);

    const res2 = await request(app)
      .post('/api/auth/onboarding/dismiss')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.dismissed, true);

    // Flag remains set (the column holds the first dismiss timestamp, not overwritten)
    const { get } = require('../src/db/schema');
    const row = get('SELECT onboarding_dismissed_at FROM users WHERE id = ?', [u.userId]);
    assert.ok(row.onboarding_dismissed_at, 'dismissed_at should be populated');
  });

  test('POST /auth/onboarding/dismiss requires auth', async () => {
    const res = await request(app).post('/api/auth/onboarding/dismiss');
    assert.strictEqual(res.status, 401);
  });
});
