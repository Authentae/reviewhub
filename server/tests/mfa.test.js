// Integration tests for the email-OTP two-factor-auth flow.
//
// Patterns follow auth.test.js: rather than parsing console-logged emails,
// we inject a known plaintext code by overwriting the hash in the DB
// directly. The only path that parses emails would be "round-trip the code
// the route generated", which is covered incidentally by the integration
// with /login (we inject-then-verify that endpoint returns mfaRequired).

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { getAgent, makeUser, request } = require('./helpers');
const { run, get, all } = require('../src/db/schema');
const { hashOtp, hashRecoveryCode } = require('../src/lib/mfa');

// Helper: set a known OTP hash on a user, valid for 10 minutes.
function setOtp(userId, plaintext) {
  const expires = new Date(Date.now() + 10 * 60_000).toISOString().slice(0, 19).replace('T', ' ');
  run(
    `UPDATE users SET mfa_code_hash = ?, mfa_code_expires_at = ? WHERE id = ?`,
    [hashOtp(plaintext), expires, userId]
  );
}

// Helper: mark user as MFA-enabled with a given recovery code (plaintext).
function enableMfaDirectly(userId, recoveryCodes = []) {
  run('UPDATE users SET mfa_enabled = 1 WHERE id = ?', [userId]);
  for (const code of recoveryCodes) {
    run(
      'INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES (?, ?)',
      [userId, hashRecoveryCode(code)]
    );
  }
}

describe('mfa: enable flow', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('POST /mfa/enable rejects when already enabled', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId);
    const res = await request(app).post('/api/auth/mfa/enable')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ password: u.password });
    assert.strictEqual(res.status, 409);
  });

  test('POST /mfa/enable requires password', async () => {
    const u = await makeUser();
    const res = await request(app).post('/api/auth/mfa/enable')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /password/i);
  });

  test('POST /mfa/enable rejects wrong password', async () => {
    const u = await makeUser();
    const res = await request(app).post('/api/auth/mfa/enable')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ password: 'wrong-password' });
    assert.strictEqual(res.status, 401);
  });

  test('POST /mfa/enable writes a pending hash to the user row', async () => {
    const u = await makeUser();
    const res = await request(app).post('/api/auth/mfa/enable')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ password: u.password });
    assert.strictEqual(res.status, 200);
    const row = get('SELECT mfa_code_hash, mfa_code_expires_at FROM users WHERE id = ?', [u.userId]);
    assert.ok(row.mfa_code_hash, 'code hash should be set');
    assert.ok(row.mfa_code_expires_at, 'expiry should be set');
  });

  test('POST /mfa/enable/confirm turns MFA on and returns 10 recovery codes', async () => {
    const u = await makeUser();
    const code = '123456';
    setOtp(u.userId, code);
    const res = await request(app)
      .post('/api/auth/mfa/enable/confirm')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ code });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.recovery_codes.length, 10);
    // Shape check: "XXXX-XXXX" with uppercase-alphanumeric (no 0/1/O/I)
    for (const rc of res.body.recovery_codes) {
      assert.match(rc, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
    // DB state: enabled, pending hash cleared, 10 recovery rows inserted
    const row = get('SELECT mfa_enabled, mfa_code_hash FROM users WHERE id = ?', [u.userId]);
    assert.strictEqual(row.mfa_enabled, 1);
    assert.strictEqual(row.mfa_code_hash, null);
    const count = get('SELECT COUNT(*) AS n FROM mfa_recovery_codes WHERE user_id = ?', [u.userId]);
    assert.strictEqual(count.n, 10);
  });

  test('POST /mfa/enable/confirm rejects wrong code', async () => {
    const u = await makeUser();
    setOtp(u.userId, '111111');
    const res = await request(app)
      .post('/api/auth/mfa/enable/confirm')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ code: '999999' });
    assert.strictEqual(res.status, 400);
  });

  test('POST /mfa/enable/confirm rejects malformed code shape', async () => {
    const u = await makeUser();
    setOtp(u.userId, '123456');
    const res = await request(app)
      .post('/api/auth/mfa/enable/confirm')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ code: 'abc' });
    assert.strictEqual(res.status, 400);
  });

  test('POST /mfa/enable/confirm rejects expired code', async () => {
    const u = await makeUser();
    const expired = new Date(Date.now() - 1000).toISOString().slice(0, 19).replace('T', ' ');
    run(`UPDATE users SET mfa_code_hash = ?, mfa_code_expires_at = ? WHERE id = ?`,
      [hashOtp('123456'), expired, u.userId]);
    const res = await request(app)
      .post('/api/auth/mfa/enable/confirm')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ code: '123456' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /expired/i);
  });
});

describe('mfa: disable flow', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('disable requires password', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId, ['ABCD-EFGH']);
    const res = await request(app)
      .post('/api/auth/mfa/disable')
      .set('Authorization', `Bearer ${u.token}`)
      .send({}); // no password
    assert.strictEqual(res.status, 400);
  });

  test('disable rejects wrong password', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId, ['ABCD-EFGH']);
    const res = await request(app)
      .post('/api/auth/mfa/disable')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ password: 'wrongpass' });
    assert.strictEqual(res.status, 401);
  });

  test('disable with correct password clears MFA state + recovery codes', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId, ['AAAA-BBBB', 'CCCC-DDDD']);
    const res = await request(app)
      .post('/api/auth/mfa/disable')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ password: u.password });
    assert.strictEqual(res.status, 200);
    const row = get('SELECT mfa_enabled FROM users WHERE id = ?', [u.userId]);
    assert.strictEqual(row.mfa_enabled, 0);
    const codes = all('SELECT id FROM mfa_recovery_codes WHERE user_id = ?', [u.userId]);
    assert.strictEqual(codes.length, 0);
  });

  test('disable rejects when MFA not enabled', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/auth/mfa/disable')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ password: u.password });
    assert.strictEqual(res.status, 409);
  });
});

describe('mfa: login flow', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('login with MFA enabled returns mfaRequired + mfaPendingToken', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: u.password });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.mfaRequired, true);
    assert.ok(res.body.mfaPendingToken);
    // Should NOT include a full access token
    assert.strictEqual(res.body.token, undefined);
  });

  test('mfa-pending token cannot access protected routes', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: u.password });
    const pendingToken = login.body.mfaPendingToken;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${pendingToken}`);
    assert.strictEqual(res.status, 401);
    assert.match(res.body.error, /MFA required/);
  });

  test('POST /login/mfa with correct code returns full token', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: u.password });
    const pendingToken = login.body.mfaPendingToken;

    // Inject a known code
    setOtp(u.userId, '654321');

    const res = await request(app)
      .post('/api/auth/login/mfa')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({ code: '654321' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.mfa_enabled, true);

    // New token works for /me
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.body.user.mfa_enabled, true);
  });

  test('POST /login/mfa consumes the code (reuse fails)', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId);
    const login = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    const pendingToken = login.body.mfaPendingToken;
    setOtp(u.userId, '111222');
    const first = await request(app).post('/api/auth/login/mfa')
      .set('Authorization', `Bearer ${pendingToken}`).send({ code: '111222' });
    assert.strictEqual(first.status, 200);
    const second = await request(app).post('/api/auth/login/mfa')
      .set('Authorization', `Bearer ${pendingToken}`).send({ code: '111222' });
    assert.strictEqual(second.status, 400);
  });

  test('POST /login/mfa rejects a full access token (only pending accepted)', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId);
    // u.token is the full access token from register
    const res = await request(app).post('/api/auth/login/mfa')
      .set('Authorization', `Bearer ${u.token}`).send({ code: '123456' });
    assert.strictEqual(res.status, 401);
  });

  test('POST /login/recovery accepts a valid recovery code and marks it used', async () => {
    const u = await makeUser();
    const recoveryCode = 'WXYZ-ABCD';
    enableMfaDirectly(u.userId, [recoveryCode]);
    const login = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    const pendingToken = login.body.mfaPendingToken;

    const res = await request(app)
      .post('/api/auth/login/recovery')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({ recovery_code: recoveryCode });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.recovery_codes_remaining, 0);

    // Reuse must fail
    const retry = await request(app)
      .post('/api/auth/login/recovery')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({ recovery_code: recoveryCode });
    assert.strictEqual(retry.status, 400);
  });

  test('recovery code input is normalised (lowercase, with spaces, without dash)', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId, ['AB12-CD34']);
    const login = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    const pendingToken = login.body.mfaPendingToken;

    const res = await request(app)
      .post('/api/auth/login/recovery')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({ recovery_code: 'ab 12cd34' }); // same code, mangled
    assert.strictEqual(res.status, 200);
  });

  test('normal (non-MFA) login still returns a full token as before', async () => {
    const u = await makeUser(); // MFA not enabled
    const res = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.mfaRequired, undefined);
    assert.strictEqual(res.body.user.mfa_enabled, false);
  });

  test('POST /login/mfa/resend generates a fresh code', async () => {
    const u = await makeUser();
    enableMfaDirectly(u.userId);
    const login = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    const pendingToken = login.body.mfaPendingToken;

    const before = get('SELECT mfa_code_hash FROM users WHERE id = ?', [u.userId]);
    const res = await request(app).post('/api/auth/login/mfa/resend')
      .set('Authorization', `Bearer ${pendingToken}`);
    assert.strictEqual(res.status, 200);
    const after = get('SELECT mfa_code_hash FROM users WHERE id = ?', [u.userId]);
    assert.notStrictEqual(before.mfa_code_hash, after.mfa_code_hash,
      'resend should generate a new code');
  });
});

describe('mfa: unit helpers', () => {
  const { generateOtp, generateRecoveryCode, normaliseRecoveryCode } = require('../src/lib/mfa');

  test('generateOtp produces a 6-digit string', () => {
    for (let i = 0; i < 10; i++) {
      assert.match(generateOtp(), /^[0-9]{6}$/);
    }
  });

  test('generateRecoveryCode uses the safe alphabet (no 0/1/O/I)', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateRecoveryCode();
      assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  test('normaliseRecoveryCode strips whitespace/dashes and uppercases', () => {
    assert.strictEqual(normaliseRecoveryCode('ab-12 cd-34'), 'AB12CD34');
    assert.strictEqual(normaliseRecoveryCode('ABCD-EFGH'), 'ABCDEFGH');
    assert.strictEqual(normaliseRecoveryCode(''), '');
  });
});
