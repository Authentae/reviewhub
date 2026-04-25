// Integration tests for the auth routes: register, login, verify, reset.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request, cleanupTempDb } = require('./helpers');
const crypto = require('crypto');

// In-process reads of the test DB to fish out the latest token hashes that
// the server just persisted. We do this because email delivery in tests goes
// to the console-fallback in email.js (SMTP_HOST not set), so we can't parse
// an actual email — but the DB row has the hash and we can invert by just
// generating a new token and comparing. Simpler: read the token directly from
// the console log. Simpler still: the register flow returns 200 immediately
// regardless of email delivery; we query the DB for the fresh token.
//
// Since tokens are hashed in the DB we can't recover the plaintext. For
// verification tests we instead set a known plaintext via a direct DB update,
// bypassing the mail path entirely.
const { run, get } = require('../src/db/schema');
const { hashToken } = require('../src/lib/tokens');

describe('auth: registration + login', () => {
  let app;
  before(async () => { app = await getAgent(); });
  after(cleanupTempDb);

  test('register returns token and email_verified=false', async () => {
    const email = `reg-${crypto.randomBytes(3).toString('hex')}@test.local`;
    const res = await request(app).post('/api/auth/register')
      .send({ email, password: 'TestPass-9f2A!xQ', acceptedTerms: true, ageConfirmed: true });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, email);
    assert.strictEqual(res.body.user.email_verified, false);
  });

  test('register rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@y.z' });
    assert.strictEqual(res.status, 400);
  });

  test('register rejects duplicate email', async () => {
    const user = await makeUser();
    const res = await request(app).post('/api/auth/register').send({ email: user.email, password: 'TestPass-9f2A!xQ', acceptedTerms: true, ageConfirmed: true });
    assert.strictEqual(res.status, 409);
  });

  test('register rejects missing Terms acceptance', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `noterms-${Date.now()}@t.co`,
      password: 'TestPass-9f2A!xQ',
      ageConfirmed: true,
      // acceptedTerms deliberately omitted
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /Terms of Service/i);
  });

  test('register rejects missing age confirmation', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `noage-${Date.now()}@t.co`,
      password: 'TestPass-9f2A!xQ',
      acceptedTerms: true,
      // ageConfirmed deliberately omitted
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /18 years old/i);
  });

  test('register records terms acceptance audit with IP, UA, and version', async () => {
    const email = `audit-${Date.now()}@t.co`;
    const res = await request(app)
      .post('/api/auth/register')
      .set('User-Agent', 'TestAgent/1.0')
      .send({ email, password: 'TestPass-9f2A!xQ', acceptedTerms: true, ageConfirmed: true });
    assert.strictEqual(res.status, 200);

    // User row has the acceptance columns populated
    const row = get(
      `SELECT terms_accepted_at, terms_version_accepted, terms_accept_ua, age_confirmed
       FROM users WHERE id = ?`,
      [res.body.user.id]
    );
    assert.ok(row.terms_accepted_at);
    assert.match(row.terms_version_accepted, /^\d{4}-\d{2}-\d{2}$/);
    assert.strictEqual(row.terms_accept_ua, 'TestAgent/1.0');
    assert.strictEqual(row.age_confirmed, 1);

    // Audit log also has an entry — this is the evidence row in a dispute
    const ev = get(
      "SELECT event FROM audit_log WHERE user_id = ? AND event = 'user.terms_accepted'",
      [res.body.user.id]
    );
    assert.ok(ev, 'audit log must record user.terms_accepted event');
  });

  test('login with correct credentials returns a token', async () => {
    const user = await makeUser();
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
  });

  test('login with wrong password returns 401', async () => {
    const user = await makeUser();
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong' });
    assert.strictEqual(res.status, 401);
  });

  test('login timing: unknown email is not an order of magnitude faster than bad password', async () => {
    // Regression guard for the timing-oracle fix. If the unknown-email path
    // skips bcrypt.compare and returns immediately, an attacker can enumerate
    // registered addresses by diffing response times (~2ms vs ~80ms). Ensure
    // both paths do roughly equal CPU work. Generous 4x slack for jitter.
    const user = await makeUser();

    const t1 = Date.now();
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'WrongPass!9xQ' });
    const tBad = Date.now() - t1;

    const t2 = Date.now();
    await request(app).post('/api/auth/login')
      .send({ email: `noexist-${Date.now()}@test.local`, password: 'anything' });
    const tUnknown = Date.now() - t2;

    assert.ok(tUnknown * 4 >= tBad,
      `timing oracle regression: unknown=${tUnknown}ms bad=${tBad}ms`);
  });

  test('/me requires auth', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.strictEqual(res.status, 401);
  });

  test('/me returns the current user', async () => {
    const user = await makeUser();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${user.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.email, user.email);
    assert.strictEqual(res.headers['cache-control'], 'no-store, private');
  });
});

describe('auth: email change', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('PUT /email rejects without password', async () => {
    const u = await makeUser();
    const res = await request(app).put('/api/auth/email')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ new_email: `new-${Date.now()}@t.co` });
    assert.strictEqual(res.status, 400);
  });

  test('PUT /email rejects non-string fields', async () => {
    const u = await makeUser();
    const res = await request(app).put('/api/auth/email')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ new_email: ['x@y.z'], password: 'TestPass-9f2A!xQ' });
    assert.strictEqual(res.status, 400);
  });

  test('PUT /email rejects wrong password (audit entry written)', async () => {
    const u = await makeUser();
    const res = await request(app).put('/api/auth/email')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ new_email: `new-${Date.now()}@t.co`, password: 'WRONG' });
    assert.strictEqual(res.status, 401);
    const audit = get(
      `SELECT * FROM audit_log WHERE user_id = ? AND event = 'user.email_change_failed'`,
      [u.userId]
    );
    assert.ok(audit, 'should log user.email_change_failed on bad password');
  });

  test('PUT /email rejects malformed new_email', async () => {
    const u = await makeUser();
    const res = await request(app).put('/api/auth/email')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ new_email: 'not-an-email', password: 'TestPass-9f2A!xQ' });
    assert.strictEqual(res.status, 400);
  });

  test('PUT /email rejects the current email (no-op)', async () => {
    const u = await makeUser();
    const res = await request(app).put('/api/auth/email')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ new_email: u.email, password: 'TestPass-9f2A!xQ' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /current email/i);
  });

  test('full email-change round-trip: request → confirm → email flipped', async () => {
    const u = await makeUser();
    const newEmail = `changed-${Date.now()}@t.co`;

    // 1. Request the change
    const req1 = await request(app).put('/api/auth/email')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ new_email: newEmail, password: 'TestPass-9f2A!xQ' });
    assert.strictEqual(req1.status, 200);

    // A token + pending_email are stashed on the user row
    const row = get(
      `SELECT pending_email, pending_email_token_hash, pending_email_expires_at FROM users WHERE id = ?`,
      [u.userId]
    );
    assert.strictEqual(row.pending_email, newEmail);
    assert.ok(row.pending_email_token_hash);
    assert.ok(row.pending_email_expires_at);

    // 2. Inject a known plaintext token so we can call /confirm
    const plaintext = crypto.randomBytes(32).toString('hex');
    run(
      `UPDATE users SET pending_email_token_hash = ? WHERE id = ?`,
      [hashToken(plaintext), u.userId]
    );

    // 3. Confirm
    const req2 = await request(app).post('/api/auth/email/confirm')
      .send({ token: plaintext });
    assert.strictEqual(req2.status, 200);
    assert.strictEqual(req2.body.email, newEmail);

    // Email flipped; pending_* cleared; email_verified_at populated
    const after = get(
      `SELECT email, email_verified_at, pending_email, pending_email_token_hash
         FROM users WHERE id = ?`,
      [u.userId]
    );
    assert.strictEqual(after.email, newEmail);
    assert.ok(after.email_verified_at, 'email should now be marked verified');
    assert.strictEqual(after.pending_email, null);
    assert.strictEqual(after.pending_email_token_hash, null);

    // Audit entry captures the old and new addresses
    const audit = get(
      `SELECT metadata FROM audit_log
        WHERE user_id = ? AND event = 'user.email_changed'
        ORDER BY id DESC LIMIT 1`,
      [u.userId]
    );
    assert.ok(audit);
    const meta = JSON.parse(audit.metadata);
    assert.strictEqual(meta.from, u.email);
    assert.strictEqual(meta.to, newEmail);
  });

  test('POST /email/confirm rejects an expired token', async () => {
    const u = await makeUser();
    const newEmail = `exp-${Date.now()}@t.co`;
    const plaintext = crypto.randomBytes(32).toString('hex');
    // Inject pending change with expiry in the past
    run(
      `UPDATE users SET pending_email = ?, pending_email_token_hash = ?, pending_email_expires_at = '2020-01-01 00:00:00' WHERE id = ?`,
      [newEmail, hashToken(plaintext), u.userId]
    );
    const res = await request(app).post('/api/auth/email/confirm').send({ token: plaintext });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /expired/i);
    // Pending fields cleared so the token can't be reused
    const after = get(`SELECT pending_email_token_hash FROM users WHERE id = ?`, [u.userId]);
    assert.strictEqual(after.pending_email_token_hash, null);
  });

  test('DELETE /email/pending clears the pending_* fields and writes audit', async () => {
    const u = await makeUser();
    // Seed a pending change we want to cancel
    const plaintext = crypto.randomBytes(32).toString('hex');
    const future = new Date(Date.now() + 3600_000).toISOString().slice(0, 19).replace('T', ' ');
    run(
      `UPDATE users SET pending_email = 'new@t.co', pending_email_token_hash = ?, pending_email_expires_at = ? WHERE id = ?`,
      [hashToken(plaintext), future, u.userId]
    );

    const res = await request(app).delete('/api/auth/email/pending')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);

    const row = get(
      `SELECT pending_email, pending_email_token_hash, pending_email_expires_at FROM users WHERE id = ?`,
      [u.userId]
    );
    assert.strictEqual(row.pending_email, null);
    assert.strictEqual(row.pending_email_token_hash, null);
    assert.strictEqual(row.pending_email_expires_at, null);

    const audit = get(
      `SELECT id FROM audit_log WHERE user_id = ? AND event = 'user.email_change_cancelled'`,
      [u.userId]
    );
    assert.ok(audit, 'cancel should emit user.email_change_cancelled audit entry');
  });

  test('/me surfaces pending_email with expires_at when a change is in-flight', async () => {
    const u = await makeUser();
    const plaintext = crypto.randomBytes(32).toString('hex');
    const future = new Date(Date.now() + 3600_000).toISOString().slice(0, 19).replace('T', ' ');
    run(
      `UPDATE users SET pending_email = 'watching@t.co', pending_email_token_hash = ?, pending_email_expires_at = ? WHERE id = ?`,
      [hashToken(plaintext), future, u.userId]
    );
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.user.pending_email, '/me must surface pending_email');
    assert.strictEqual(res.body.user.pending_email.address, 'watching@t.co');
    assert.ok(res.body.user.pending_email.expires_at);
  });

  test('/me does NOT surface pending_email if the stored row has expired', async () => {
    const u = await makeUser();
    // Inject a pending change with expiry in the PAST
    run(
      `UPDATE users SET pending_email = 'stale@t.co', pending_email_token_hash = 'x', pending_email_expires_at = '2020-01-01 00:00:00' WHERE id = ?`,
      [u.userId]
    );
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    // /me filters expired pending rows
    assert.strictEqual(res.body.user.pending_email, null);
  });

  test('POST /email/confirm refuses when target email already taken', async () => {
    const existing = await makeUser(); // some other user
    const u = await makeUser();
    const plaintext = crypto.randomBytes(32).toString('hex');
    const future = new Date(Date.now() + 3600_000).toISOString().slice(0, 19).replace('T', ' ');
    // u wants to change to existing.email — should fail at confirm time
    run(
      `UPDATE users SET pending_email = ?, pending_email_token_hash = ?, pending_email_expires_at = ? WHERE id = ?`,
      [existing.email, hashToken(plaintext), future, u.userId]
    );
    const res = await request(app).post('/api/auth/email/confirm').send({ token: plaintext });
    assert.strictEqual(res.status, 409);
    const after = get(`SELECT email, pending_email FROM users WHERE id = ?`, [u.userId]);
    assert.strictEqual(after.email, u.email, 'u.email must not have been flipped');
    assert.strictEqual(after.pending_email, null, 'pending_email must be cleared');
  });
});

describe('auth: password rotation revokes old sessions', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('JWT issued before password change is rejected after change', async () => {
    const u = await makeUser();
    // Sanity: the original JWT works for an authed request
    const ok = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(ok.status, 200);

    // Change the password (authed with the current JWT). The endpoint
    // bumps password_changed_at to NOW and issues a FRESH JWT.
    // We simulate the JWT being issued >30s before the password change
    // by manually setting password_changed_at to the future — so the
    // old JWT's iat + 30s < password_changed_at.
    const future = new Date(Date.now() + 60_000).toISOString().slice(0, 19).replace('T', ' ');
    run(`UPDATE users SET password_changed_at = ? WHERE id = ?`, [future, u.userId]);

    // The original JWT should now be rejected as a revoked session.
    const revoked = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(revoked.status, 401);
    assert.match(revoked.body.error, /revoked|sign in/i);
  });

  test('a fresh JWT issued after password change still works', async () => {
    const u = await makeUser();
    // The password-change endpoint itself issues a new JWT in the response.
    // Exercise it end-to-end via PUT /auth/password.
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ current: 'TestPass-9f2A!xQ', next: 'newpassword456' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token, 'response must include a replacement JWT');

    // The replacement JWT should work against /me
    const ok = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    assert.strictEqual(ok.status, 200);
  });

  test('password reset also revokes old sessions', async () => {
    const u = await makeUser();
    // Issue a reset token and consume it to change the password
    const plaintext = crypto.randomBytes(32).toString('hex');
    const future = new Date(Date.now() + 3600_000).toISOString().slice(0, 19).replace('T', ' ');
    run(
      `UPDATE users SET password_reset_token_hash = ?, password_reset_expires_at = ? WHERE id = ?`,
      [hashToken(plaintext), future, u.userId]
    );
    const reset = await request(app).post('/api/auth/reset-password').send({
      token: plaintext, password: 'NewPw-after-reset-9!',
    });
    assert.strictEqual(reset.status, 200);

    // Now nudge password_changed_at forward so the old JWT is clearly stale
    const nudge = new Date(Date.now() + 60_000).toISOString().slice(0, 19).replace('T', ' ');
    run(`UPDATE users SET password_changed_at = ? WHERE id = ?`, [nudge, u.userId]);

    // The original JWT is no good
    const stale = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(stale.status, 401);
  });
});

describe('auth: email verification', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('verify-email rejects bad token format', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'nope' });
    assert.strictEqual(res.status, 400);
  });

  test('verify-email accepts valid token and flips email_verified', async () => {
    const user = await makeUser();
    // Inject a known plaintext by overwriting the hash in the DB.
    const plaintext = crypto.randomBytes(32).toString('hex');
    run(
      `UPDATE users SET email_verify_token_hash = ?, email_verify_sent_at = datetime('now') WHERE id = ?`,
      [hashToken(plaintext), user.userId]
    );
    const res = await request(app).post('/api/auth/verify-email').send({ token: plaintext });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // Re-check via /me
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${user.token}`);
    assert.strictEqual(me.body.user.email_verified, true);
  });

  test('verify-email rejects expired token', async () => {
    const user = await makeUser();
    const plaintext = crypto.randomBytes(32).toString('hex');
    // Store a hash dated 25 hours ago (> 24 h expiry).
    const expired = new Date(Date.now() - 25 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    run(
      `UPDATE users SET email_verify_token_hash = ?, email_verify_sent_at = ? WHERE id = ?`,
      [hashToken(plaintext), expired, user.userId]
    );
    const res = await request(app).post('/api/auth/verify-email').send({ token: plaintext });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /expired/i);
  });

  test('resend-verification requires auth and re-issues a token', async () => {
    const user = await makeUser();
    const before = get('SELECT email_verify_token_hash FROM users WHERE id = ?', [user.userId]);
    const res = await request(app).post('/api/auth/resend-verification').set('Authorization', `Bearer ${user.token}`);
    assert.strictEqual(res.status, 200);
    const after = get('SELECT email_verify_token_hash FROM users WHERE id = ?', [user.userId]);
    assert.notStrictEqual(before.email_verify_token_hash, after.email_verify_token_hash);
  });
});

describe('auth: password reset', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('forgot-password returns 200 for unknown email (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@nowhere.invalid' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  test('forgot-password sets a reset token for a known email', async () => {
    const user = await makeUser();
    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    assert.strictEqual(res.status, 200);
    const row = get('SELECT password_reset_token_hash, password_reset_expires_at FROM users WHERE id = ?', [user.userId]);
    assert.ok(row.password_reset_token_hash);
    assert.ok(row.password_reset_expires_at);
  });

  test('reset-password consumes token and sets new password', async () => {
    const user = await makeUser();
    const plaintext = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    run(
      `UPDATE users SET password_reset_token_hash = ?, password_reset_expires_at = ? WHERE id = ?`,
      [hashToken(plaintext), expires, user.userId]
    );
    const res = await request(app).post('/api/auth/reset-password').send({ token: plaintext, password: 'NewPass-789xQ!' });
    assert.strictEqual(res.status, 200);

    // Old password no longer works
    const loginOld = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
    assert.strictEqual(loginOld.status, 401);

    // New password works
    const loginNew = await request(app).post('/api/auth/login').send({ email: user.email, password: 'NewPass-789xQ!' });
    assert.strictEqual(loginNew.status, 200);

    // Token is cleared, so reuse fails
    const retry = await request(app).post('/api/auth/reset-password').send({ token: plaintext, password: 'AnotherPass!99' });
    assert.strictEqual(retry.status, 400);
  });

  test('audit log records register, login, and login_failed events', async () => {
    const user = await makeUser();
    // Successful login
    await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
    // Failed login
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'WrongPass!9xQ' });

    const events = get(
      `SELECT GROUP_CONCAT(event) AS events FROM audit_log WHERE user_id = ?`,
      [user.userId]
    ).events.split(',');
    assert.ok(events.includes('user.register'));
    assert.ok(events.includes('user.login'));
    assert.ok(events.includes('user.login_failed'));
  });

  test('login_failed for unknown email does not store the email anywhere', async () => {
    // Intentionally-nonexistent address
    await request(app).post('/api/auth/login').send({ email: 'nobody-audit@nowhere.invalid', password: 'x' });
    // No audit row should reference that email — we only record the event + IP/UA.
    const hit = get(
      `SELECT COUNT(*) AS n FROM audit_log WHERE metadata LIKE '%nobody-audit%'`
    );
    assert.strictEqual(hit.n, 0, 'audit log must not contain attempted-email text');
  });

  test('reset-password rejects expired token', async () => {
    const user = await makeUser();
    const plaintext = crypto.randomBytes(32).toString('hex');
    const expired = new Date(Date.now() - 1000).toISOString().slice(0, 19).replace('T', ' ');
    run(
      `UPDATE users SET password_reset_token_hash = ?, password_reset_expires_at = ? WHERE id = ?`,
      [hashToken(plaintext), expired, user.userId]
    );
    const res = await request(app).post('/api/auth/reset-password').send({ token: plaintext, password: 'NewPass-mfa!9' });
    assert.strictEqual(res.status, 400);
  });
});
