// Integration tests for GDPR data export + weekly digest job.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('data export', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /auth/me/export returns a JSON attachment', async () => {
    const u = await makeUserWithBusiness('Export Test Co');
    const res = await request(app).get('/api/auth/me/export').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.match(res.headers['content-disposition'], /attachment;/);
    assert.strictEqual(res.headers['cache-control'], 'no-store, private');
    const body = JSON.parse(res.text);
    assert.strictEqual(body.user.email, u.email);
    assert.strictEqual(body.business.business_name, 'Export Test Co');
    assert.ok(Array.isArray(body.reviews));
    assert.ok(Array.isArray(body.templates));
    assert.ok(Array.isArray(body.platform_connections));
    assert.ok(Array.isArray(body.review_requests), 'v3: review_requests included');
    assert.ok(Array.isArray(body.tags), 'v3: tags included');
    assert.ok(Array.isArray(body.auto_rules), 'v3: auto_rules included');
    assert.ok(Array.isArray(body.onboarding_emails), 'v4: onboarding_emails included');
    assert.strictEqual(body.schema_version, 4);
    assert.ok(Array.isArray(body.audit_log));
    // v4 also adds preferred_lang + notif_onboarding to user.* — these
    // can be null/0 for a freshly-created test user but the keys must
    // be present so users can see their stored locale preference.
    assert.ok('preferred_lang' in body.user, 'v4: user.preferred_lang included');
    assert.ok('notif_onboarding' in body.user, 'v4: user.notif_onboarding included');
    // The user.register event must be present from the signup in makeUser()
    assert.ok(body.audit_log.some((e) => e.event === 'user.register'),
      'expected user.register audit entry');
  });

  test('export never includes secret token columns', async () => {
    const u = await makeUserWithBusiness();
    // Add a platform connection so we have a row that COULD leak tokens if misexposed
    await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ google_place_id: 'ChIJ_export_test' });
    const res = await request(app).get('/api/auth/me/export').set('Authorization', `Bearer ${u.token}`);
    const body = JSON.parse(res.text);
    assert.ok(body.platform_connections.length > 0);
    const conn = body.platform_connections[0];
    assert.ok(!('access_token' in conn));
    assert.ok(!('refresh_token' in conn));
    assert.ok(!('token_expires_at' in conn));
    // And it should never include the user's password hash
    assert.ok(!('password_hash' in body.user));
  });

  test('review_requests in export include customer PII but never the token_hash', async () => {
    const u = await makeUserWithBusiness();
    const { run } = require('../src/db/schema');
    run(`UPDATE businesses SET google_place_id = 'ChIJ_export' WHERE user_id = ?`, [u.userId]);
    // Send a review request so the export has something to include
    const sent = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'Exported Customer', customer_email: 'ec@example.com', platform: 'google' });
    assert.strictEqual(sent.status, 201);

    const res = await request(app).get('/api/auth/me/export').set('Authorization', `Bearer ${u.token}`);
    const body = JSON.parse(res.text);
    assert.ok(body.review_requests.length >= 1);
    const rr = body.review_requests[0];
    assert.strictEqual(rr.customer_name, 'Exported Customer');
    assert.strictEqual(rr.customer_email, 'ec@example.com');
    // token_hash is security material and must not leak via export
    assert.ok(!('token_hash' in rr), 'token_hash must NOT be in export');
  });

  test('auto_rules and tags in export honour the user scope', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    // u1 creates a tag + rule; they must appear only in u1's export, not u2's.
    const tagRes = await request(app).post('/api/tags').set('Authorization', `Bearer ${u1.token}`)
      .send({ name: 'export-tag', color: '#123456' });
    assert.strictEqual(tagRes.status, 201);
    await request(app).post('/api/auto-rules').set('Authorization', `Bearer ${u1.token}`)
      .send({ name: 'Exported Rule', response_text: 'Hi', min_rating: 5, max_rating: 5 });

    const exp1 = JSON.parse((await request(app).get('/api/auth/me/export').set('Authorization', `Bearer ${u1.token}`)).text);
    const exp2 = JSON.parse((await request(app).get('/api/auth/me/export').set('Authorization', `Bearer ${u2.token}`)).text);

    assert.ok(exp1.tags.some(t => t.name === 'export-tag'));
    assert.ok(exp1.auto_rules.some(r => r.name === 'Exported Rule'));
    assert.strictEqual(exp2.tags.length, 0);
    assert.strictEqual(exp2.auto_rules.length, 0);
  });

  test('export requires auth', async () => {
    const res = await request(app).get('/api/auth/me/export');
    assert.strictEqual(res.status, 401);
  });
});

describe('weekly digest job', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('runWeeklyDigest skips users with no activity', async () => {
    const { runWeeklyDigest } = require('../src/jobs/weeklyDigest');
    // Fresh user, opted in, no reviews → should NOT get an email
    const u = await makeUserWithBusiness();
    // Mark verified + opted in directly
    const { run } = require('../src/db/schema');
    run('UPDATE users SET email_verified_at = datetime(\'now\'), notif_weekly_summary = 1 WHERE id = ?', [u.userId]);
    const result = await runWeeklyDigest();
    assert.ok(!result.recipients.includes(u.email),
      'user with zero reviews should be skipped');
  });

  test('runWeeklyDigest emails users with activity (on a plan that includes digests)', async () => {
    const { runWeeklyDigest } = require('../src/jobs/weeklyDigest');
    const u = await makeUserWithBusiness();
    const { run } = require('../src/db/schema');
    // Pro+ includes the weekly_digest feature — Free/Starter don't.
    run(
      `UPDATE users SET email_verified_at = datetime('now'), notif_weekly_summary = 1 WHERE id = ?`,
      [u.userId]
    );
    run(`UPDATE subscriptions SET plan = 'pro' WHERE user_id = ?`, [u.userId]);
    // Create a review so the digest has something to report
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Recent', rating: 5, review_text: 'great' });
    const result = await runWeeklyDigest();
    assert.ok(result.recipients.includes(u.email),
      `expected digest recipient to include ${u.email}, got ${JSON.stringify(result.recipients)}`);
  });

  test('runWeeklyDigest skips users on Free/Starter plans (weekly_digest is paid)', async () => {
    const { runWeeklyDigest } = require('../src/jobs/weeklyDigest');
    const u = await makeUserWithBusiness();
    const { run } = require('../src/db/schema');
    // Opted in AND verified, but still on Free plan where weekly_digest isn't a feature.
    run(
      `UPDATE users SET email_verified_at = datetime('now'), notif_weekly_summary = 1 WHERE id = ?`,
      [u.userId]
    );
    // (plan stays 'free' — the default from register)
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Recent', rating: 5, review_text: 'great' });
    const result = await runWeeklyDigest();
    assert.ok(!result.recipients.includes(u.email),
      'Free-plan user with digest toggle on should still be skipped — feature is Pro+ only');
  });

  test('runWeeklyDigest skips users who have opted out', async () => {
    const { runWeeklyDigest } = require('../src/jobs/weeklyDigest');
    const u = await makeUserWithBusiness();
    const { run } = require('../src/db/schema');
    // Verified but NOT opted in
    run('UPDATE users SET email_verified_at = datetime(\'now\'), notif_weekly_summary = 0 WHERE id = ?', [u.userId]);
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Recent', rating: 5, review_text: 'great' });
    const result = await runWeeklyDigest();
    assert.ok(!result.recipients.includes(u.email),
      'opted-out user should be skipped');
  });

  test('runWeeklyDigest skips unverified users even when opted in', async () => {
    const { runWeeklyDigest } = require('../src/jobs/weeklyDigest');
    const u = await makeUserWithBusiness();
    const { run } = require('../src/db/schema');
    // Opted in, but NOT verified — email_verified_at stays NULL
    run('UPDATE users SET notif_weekly_summary = 1 WHERE id = ?', [u.userId]);
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Recent', rating: 5, review_text: 'great' });
    const result = await runWeeklyDigest();
    assert.ok(!result.recipients.includes(u.email),
      'unverified user should be skipped');
  });

  test('runWeeklyDigest is idempotent — second call within 6.5d skips the user', async () => {
    const { runWeeklyDigest } = require('../src/jobs/weeklyDigest');
    const u = await makeUserWithBusiness();
    const { run } = require('../src/db/schema');
    run(`UPDATE users SET email_verified_at = datetime('now'), notif_weekly_summary = 1 WHERE id = ?`, [u.userId]);
    run(`UPDATE subscriptions SET plan = 'pro' WHERE user_id = ?`, [u.userId]);
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Recent', rating: 5, review_text: 'great' });
    const first = await runWeeklyDigest();
    assert.ok(first.recipients.includes(u.email), 'first run should send');
    const second = await runWeeklyDigest();
    assert.ok(!second.recipients.includes(u.email),
      'second run within the window should skip (idempotency guard)');
  });
});
