// Integration tests for AI draft quota fields in /auth/me response.
//
// The client reads these fields to show a proactive "N AI drafts left" badge
// in the review card editor BEFORE the user hits the limit, and an inline
// upgrade card when the quota is exhausted. The values must:
//   - Reflect current-month usage (not last month's stale counter)
//   - Return null for unlimited plans (Starter+)
//   - Correctly reset when the stored period is out of date

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, setPlan, request } = require('./helpers');

describe('auth/me AI quota exposure', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('Free plan: exposes max=3, used=0, remaining=3 initially', async () => {
    const u = await makeUser();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.subscription.ai_drafts_max_per_month, 3);
    assert.strictEqual(res.body.subscription.ai_drafts_used_this_month, 0);
    assert.strictEqual(res.body.subscription.ai_drafts_remaining, 3);
  });

  test('Starter plan: remaining is null (unlimited)', async () => {
    const u = await makeUser();
    setPlan(u.userId, 'starter');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.subscription.ai_drafts_max_per_month, null);
    assert.strictEqual(res.body.subscription.ai_drafts_remaining, null);
  });

  test('Free plan: stale period_start from last month means remaining=3', async () => {
    const u = await makeUser();
    const { run } = require('../src/db/schema');
    // Simulate: user drafted 2 times last month, period_start is stale
    run("UPDATE subscriptions SET ai_drafts_used = 2, ai_drafts_period_start = '2020-01' WHERE user_id = ?", [u.userId]);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.subscription.ai_drafts_used_this_month, 0,
      'stale period should read as 0 used for the current month');
    assert.strictEqual(res.body.subscription.ai_drafts_remaining, 3);
  });

  test('Free plan: current-month usage is reflected correctly', async () => {
    const u = await makeUser();
    const { run } = require('../src/db/schema');
    const currentPeriod = new Date().toISOString().slice(0, 7);
    run('UPDATE subscriptions SET ai_drafts_used = ?, ai_drafts_period_start = ? WHERE user_id = ?',
      [2, currentPeriod, u.userId]);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.subscription.ai_drafts_used_this_month, 2);
    assert.strictEqual(res.body.subscription.ai_drafts_remaining, 1);
  });

  test('Free plan: exhausted quota returns remaining=0', async () => {
    const u = await makeUser();
    const { run } = require('../src/db/schema');
    const currentPeriod = new Date().toISOString().slice(0, 7);
    run('UPDATE subscriptions SET ai_drafts_used = ?, ai_drafts_period_start = ? WHERE user_id = ?',
      [3, currentPeriod, u.userId]);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.subscription.ai_drafts_remaining, 0);
  });
});
