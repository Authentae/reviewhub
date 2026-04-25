// Tests for the referral-code endpoint + signup attribution.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request } = require('./helpers');
const crypto = require('crypto');

describe('referral code lifecycle', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /auth/referral-code lazily assigns a code on first call', async () => {
    const u = await makeUser();
    const res = await request(app).get('/api/auth/referral-code').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(/^[A-Z2-9]{8}$/.test(res.body.code), `code ${res.body.code} should be 8 A-Z/2-9 chars`);
    assert.ok(res.body.referral_link.includes(res.body.code));
    assert.strictEqual(res.body.referred_count, 0);
  });

  test('subsequent calls return the same code (not regenerated)', async () => {
    const u = await makeUser();
    const first = await request(app).get('/api/auth/referral-code').set('Authorization', `Bearer ${u.token}`);
    const second = await request(app).get('/api/auth/referral-code').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(first.body.code, second.body.code);
  });

  test('requires auth', async () => {
    const res = await request(app).get('/api/auth/referral-code');
    assert.strictEqual(res.status, 401);
  });
});

describe('signup referral attribution', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function getReferralCode(user) {
    const res = await request(app).get('/api/auth/referral-code').set('Authorization', `Bearer ${user.token}`);
    return res.body.code;
  }

  test('signup with valid ?ref=CODE attributes the new user to the referrer', async () => {
    const referrer = await makeUser();
    const code = await getReferralCode(referrer);

    const newEmail = `referred-${crypto.randomBytes(4).toString('hex')}@example.com`;
    const signup = await request(app).post('/api/auth/register').send({
      email: newEmail,
      password: 'TestPass-9f2A!xQ',
      acceptedTerms: true,
      ageConfirmed: true,
      ref: code,
    });
    assert.strictEqual(signup.status, 200);

    // Verify the new user's row has referred_by_user_id set
    const { get } = require('../src/db/schema');
    const row = get('SELECT referred_by_user_id FROM users WHERE email = ?', [newEmail]);
    assert.strictEqual(row.referred_by_user_id, referrer.userId);

    // And the referrer's count goes up
    const stats = await request(app).get('/api/auth/referral-code').set('Authorization', `Bearer ${referrer.token}`);
    assert.strictEqual(stats.body.referred_count, 1);
  });

  test('signup with invalid ?ref=... is silently ignored (not an error)', async () => {
    const newEmail = `no-referrer-${crypto.randomBytes(4).toString('hex')}@example.com`;
    const signup = await request(app).post('/api/auth/register').send({
      email: newEmail,
      password: 'TestPass-9f2A!xQ',
      acceptedTerms: true,
      ageConfirmed: true,
      ref: 'TOTALLYFAKE',
    });
    assert.strictEqual(signup.status, 200);

    const { get } = require('../src/db/schema');
    const row = get('SELECT referred_by_user_id FROM users WHERE email = ?', [newEmail]);
    assert.strictEqual(row.referred_by_user_id, null);
  });

  test('signup without ref works normally', async () => {
    const newEmail = `plain-${crypto.randomBytes(4).toString('hex')}@example.com`;
    const signup = await request(app).post('/api/auth/register').send({
      email: newEmail,
      password: 'TestPass-9f2A!xQ',
      acceptedTerms: true,
      ageConfirmed: true,
    });
    assert.strictEqual(signup.status, 200);

    const { get } = require('../src/db/schema');
    const row = get('SELECT referred_by_user_id FROM users WHERE email = ?', [newEmail]);
    assert.strictEqual(row.referred_by_user_id, null);
  });
});
