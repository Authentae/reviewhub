// Tests for GET /api/webhooks/:id/deliveries

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('webhook deliveries', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function createWebhook(token) {
    const res = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/hook', events: ['review.created'] });
    return res.body;
  }

  test('returns empty deliveries for new webhook', async () => {
    const u = await makeUserWithBusiness();
    const hook = await createWebhook(u.token);

    const res = await request(app).get(`/api/webhooks/${hook.id}/deliveries`)
      .set('Authorization', `Bearer ${u.token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.deliveries));
    assert.strictEqual(res.body.deliveries.length, 0);
  });

  test('requires auth', async () => {
    const u = await makeUserWithBusiness();
    const hook = await createWebhook(u.token);

    const res = await request(app).get(`/api/webhooks/${hook.id}/deliveries`);
    assert.strictEqual(res.status, 401);
  });

  test('returns 404 for another user webhook', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const hook = await createWebhook(u1.token);

    const res = await request(app).get(`/api/webhooks/${hook.id}/deliveries`)
      .set('Authorization', `Bearer ${u2.token}`);
    assert.strictEqual(res.status, 404);
  });

  test('returns 400 for invalid webhook ID', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).get('/api/webhooks/abc/deliveries')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 400);
  });

  test('delivery log entry has expected shape', async () => {
    const u = await makeUserWithBusiness();
    const hook = await createWebhook(u.token);

    // Manually insert a delivery log entry
    const { run } = require('../src/db/schema');
    run(
      'INSERT INTO webhook_deliveries (webhook_id, event, status, response_snippet) VALUES (?, ?, ?, ?)',
      [hook.id, 'review.created', 200, 'OK']
    );

    const res = await request(app).get(`/api/webhooks/${hook.id}/deliveries`)
      .set('Authorization', `Bearer ${u.token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.deliveries.length, 1);
    const d = res.body.deliveries[0];
    assert.strictEqual(d.event, 'review.created');
    assert.strictEqual(d.status, 200);
    assert.strictEqual(d.response_snippet, 'OK');
    assert.ok(d.triggered_at);
  });

  test('returns at most 50 entries', async () => {
    const u = await makeUserWithBusiness();
    const hook = await createWebhook(u.token);

    const { run } = require('../src/db/schema');
    for (let i = 0; i < 60; i++) {
      run(
        'INSERT INTO webhook_deliveries (webhook_id, event, status) VALUES (?, ?, ?)',
        [hook.id, 'review.created', 200]
      );
    }

    const res = await request(app).get(`/api/webhooks/${hook.id}/deliveries`)
      .set('Authorization', `Bearer ${u.token}`);

    assert.strictEqual(res.body.deliveries.length, 50);
  });
});
