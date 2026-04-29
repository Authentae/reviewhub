// Tests for GET /api/auth/notifications + the round-trip with PUT.
// PUT was already covered by followUpRequests.test.js + sessionCookie.test.js,
// but the GET-side normalization (DB integer 0/1 → JSON boolean, NULL
// follow_up_after_days → 0, no-store cache header) had no direct coverage.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request } = require('./helpers');
const { run } = require('../src/db/schema');

describe('GET /api/auth/notifications', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('requires auth', async () => {
    const res = await request(app).get('/api/auth/notifications');
    assert.strictEqual(res.status, 401);
  });

  test('returns booleans, not raw 0/1 from DB', async () => {
    const u = await makeUser();
    const res = await request(app).get('/api/auth/notifications')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.body.notif_new_review, 'boolean');
    assert.strictEqual(typeof res.body.notif_negative_alert, 'boolean');
    assert.strictEqual(typeof res.body.notif_weekly_summary, 'boolean');
    assert.strictEqual(typeof res.body.follow_up_after_days, 'number');
  });

  test('round-trips PUT → GET correctly', async () => {
    const u = await makeUser();
    await request(app).put('/api/auth/notifications')
      .set('Authorization', `Bearer ${u.token}`)
      .send({
        notif_new_review: false,
        notif_negative_alert: true,
        notif_weekly_summary: false,
        follow_up_after_days: 7,
      });
    const res = await request(app).get('/api/auth/notifications')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.notif_new_review, false);
    assert.strictEqual(res.body.notif_negative_alert, true);
    assert.strictEqual(res.body.notif_weekly_summary, false);
    assert.strictEqual(res.body.follow_up_after_days, 7);
  });

  test('emits Cache-Control: no-store, private (privacy)', async () => {
    const u = await makeUser();
    const res = await request(app).get('/api/auth/notifications')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.headers['cache-control'], 'no-store, private');
  });
});
