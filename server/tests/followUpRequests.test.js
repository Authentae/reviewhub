// Integration tests for the auto-follow-up review request job.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('follow-up review requests job', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function setBizPlatformId(u, field, value) {
    const { run } = require('../src/db/schema');
    run(`UPDATE businesses SET ${field} = ? WHERE user_id = ?`, [value, u.userId]);
  }

  async function sendRequest(u) {
    return request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'FU Test', customer_email: 'futest@example.com', platform: 'google' });
  }

  test('runFollowUp skips users with follow_up_after_days = 0 (default)', async () => {
    const { runFollowUp } = require('../src/jobs/followUpRequests');
    const u = await makeUserWithBusiness('FU Co', 'starter');
    await setBizPlatformId(u, 'google_place_id', 'ChIJfu1');
    const sent = await sendRequest(u);
    assert.strictEqual(sent.status, 201);

    const result = await runFollowUp();
    // follow_up_after_days defaults to 0 → job should skip this user entirely
    const { get } = require('../src/db/schema');
    const rr = get('SELECT follow_up_sent_at FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.strictEqual(rr.follow_up_sent_at, null, 'follow_up_sent_at should remain null when disabled');
  });

  test('runFollowUp skips Free-plan users even with follow_up_after_days set', async () => {
    const { runFollowUp } = require('../src/jobs/followUpRequests');
    const { run, get } = require('../src/db/schema');
    const u = await makeUserWithBusiness('FU Free Co', 'free');
    await setBizPlatformId(u, 'google_place_id', 'ChIJfu2');
    // Enable follow-up + backdate the request to look old enough
    run('UPDATE users SET follow_up_after_days = 3 WHERE id = ?', [u.userId]);
    const sent = await sendRequest(u);
    assert.strictEqual(sent.status, 201);
    run("UPDATE review_requests SET sent_at = datetime('now', '-4 days') WHERE id = ?", [sent.body.id]);

    await runFollowUp();
    const rr = get('SELECT follow_up_sent_at FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.strictEqual(rr.follow_up_sent_at, null, 'Free plan should not receive follow-ups');
  });

  test('runFollowUp sends a follow-up for Starter+ user after window expires', async () => {
    const { runFollowUp } = require('../src/jobs/followUpRequests');
    const { run, get } = require('../src/db/schema');
    const u = await makeUserWithBusiness('FU Starter Co', 'starter');
    await setBizPlatformId(u, 'google_place_id', 'ChIJfu3');
    run('UPDATE users SET follow_up_after_days = 3 WHERE id = ?', [u.userId]);

    const sent = await sendRequest(u);
    assert.strictEqual(sent.status, 201);
    // Backdate to simulate 4 days having passed
    run("UPDATE review_requests SET sent_at = datetime('now', '-4 days') WHERE id = ?", [sent.body.id]);

    await runFollowUp();
    const rr = get('SELECT follow_up_sent_at, token_hash FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.ok(rr.follow_up_sent_at !== null, 'follow_up_sent_at should be set after job runs');
  });

  test('runFollowUp is idempotent — second run does not follow up again', async () => {
    const { runFollowUp } = require('../src/jobs/followUpRequests');
    const { run, get } = require('../src/db/schema');
    const u = await makeUserWithBusiness('FU Idempotent Co', 'starter');
    await setBizPlatformId(u, 'google_place_id', 'ChIJfu4');
    run('UPDATE users SET follow_up_after_days = 3 WHERE id = ?', [u.userId]);

    const sent = await sendRequest(u);
    run("UPDATE review_requests SET sent_at = datetime('now', '-4 days') WHERE id = ?", [sent.body.id]);

    const first = await runFollowUp();
    const rr1 = get('SELECT follow_up_sent_at FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.ok(rr1.follow_up_sent_at !== null, 'first run should send follow-up');

    const savedAt = rr1.follow_up_sent_at;
    await runFollowUp(); // second run
    const rr2 = get('SELECT follow_up_sent_at FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.strictEqual(rr2.follow_up_sent_at, savedAt, 'follow_up_sent_at should not change on second run');
  });

  test('runFollowUp skips already-clicked requests', async () => {
    const { runFollowUp } = require('../src/jobs/followUpRequests');
    const { run, get } = require('../src/db/schema');
    const u = await makeUserWithBusiness('FU Clicked Co', 'starter');
    await setBizPlatformId(u, 'google_place_id', 'ChIJfu5');
    run('UPDATE users SET follow_up_after_days = 3 WHERE id = ?', [u.userId]);

    const sent = await sendRequest(u);
    run("UPDATE review_requests SET sent_at = datetime('now', '-4 days'), clicked_at = datetime('now', '-1 days') WHERE id = ?", [sent.body.id]);

    await runFollowUp();
    const rr = get('SELECT follow_up_sent_at FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.strictEqual(rr.follow_up_sent_at, null, 'already-clicked requests should not get follow-ups');
  });

  test('runFollowUp skips requests not yet past the window', async () => {
    const { runFollowUp } = require('../src/jobs/followUpRequests');
    const { run, get } = require('../src/db/schema');
    const u = await makeUserWithBusiness('FU Early Co', 'starter');
    await setBizPlatformId(u, 'google_place_id', 'ChIJfu6');
    run('UPDATE users SET follow_up_after_days = 7 WHERE id = ?', [u.userId]);

    const sent = await sendRequest(u);
    // Only 2 days old — not yet past the 7-day window
    run("UPDATE review_requests SET sent_at = datetime('now', '-2 days') WHERE id = ?", [sent.body.id]);

    await runFollowUp();
    const rr = get('SELECT follow_up_sent_at FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.strictEqual(rr.follow_up_sent_at, null, 'requests inside the window should not be followed up yet');
  });

  test('runFollowUp skips requests older than 30 days (deploy-safety guard)', async () => {
    const { runFollowUp } = require('../src/jobs/followUpRequests');
    const { run, get } = require('../src/db/schema');
    const u = await makeUserWithBusiness('FU Ancient Co', 'starter');
    await setBizPlatformId(u, 'google_place_id', 'ChIJancient');
    run('UPDATE users SET follow_up_after_days = 3 WHERE id = ?', [u.userId]);

    const sent = await sendRequest(u);
    // Backdate to 6 months ago — must NOT trigger a retroactive follow-up even
    // though it matches the "older than follow_up_after_days" condition.
    run("UPDATE review_requests SET sent_at = datetime('now', '-180 days') WHERE id = ?", [sent.body.id]);

    await runFollowUp();
    const rr = get('SELECT follow_up_sent_at FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.strictEqual(rr.follow_up_sent_at, null,
      'ancient requests must not receive retroactive follow-ups');
  });

  // ── GET /review-requests includes follow_up_sent_at ──────────────────────

  test('GET /review-requests response includes follow_up_sent_at field', async () => {
    const u = await makeUserWithBusiness('FU List Co', 'starter');
    await setBizPlatformId(u, 'google_place_id', 'ChIJfu7');
    const sent = await sendRequest(u);
    assert.strictEqual(sent.status, 201);

    const res = await request(app).get('/api/review-requests').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.requests.length > 0);
    assert.ok('follow_up_sent_at' in res.body.requests[0], 'follow_up_sent_at should be in list response');
  });

  test('PUT /auth/notifications accepts follow_up_after_days', async () => {
    const u = await makeUserWithBusiness('FU Notif Co', 'starter');
    const res = await request(app)
      .put('/api/auth/notifications')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ follow_up_after_days: 7 });
    assert.strictEqual(res.status, 200);

    const { get } = require('../src/db/schema');
    const user = get('SELECT follow_up_after_days FROM users WHERE id = ?', [u.userId]);
    assert.strictEqual(user.follow_up_after_days, 7);
  });

  test('PUT /auth/notifications rejects invalid follow_up_after_days', async () => {
    const u = await makeUserWithBusiness('FU Invalid Co', 'starter');
    const res = await request(app)
      .put('/api/auth/notifications')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ follow_up_after_days: 99 });
    assert.strictEqual(res.status, 400);
  });

  // Regression: a non-boolean wire value (e.g. the JSON string "false") used
  // to silently flip the notification flag ON because non-empty strings are
  // truthy in JS. Now we require a real boolean (or 0/1 for forms).
  test('PUT /auth/notifications rejects non-boolean notif_new_review', async () => {
    const u = await makeUserWithBusiness('NotifBool Co', 'starter');
    const res = await request(app)
      .put('/api/auth/notifications')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ notif_new_review: 'false' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /boolean/i);
  });

  test('PUT /auth/notifications accepts true / false / 0 / 1', async () => {
    const u = await makeUserWithBusiness('NotifBool2 Co', 'starter');
    for (const v of [true, false, 0, 1]) {
      const res = await request(app)
        .put('/api/auth/notifications')
        .set('Authorization', `Bearer ${u.token}`)
        .send({ notif_new_review: v });
      assert.strictEqual(res.status, 200, `value ${JSON.stringify(v)} should be accepted`);
    }
  });
});
