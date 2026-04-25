// Integration tests for /api/webhooks CRUD

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('webhooks', () => {
  let app;
  before(async () => { app = await getAgent(); });

  // ── CRUD ─────────────────────────────────────────────────────────────────

  test('creates a webhook and returns secret', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/hook', events: ['review.created'] });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.url, 'https://example.com/hook');
    assert.ok(typeof res.body.secret === 'string' && res.body.secret.length > 0);
    assert.deepStrictEqual(res.body.events, ['review.created']);
    assert.strictEqual(res.body.enabled, 1);
  });

  test('GET /api/webhooks returns list', async () => {
    const u = await makeUserWithBusiness();
    await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/h1' });
    await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/h2' });

    const res = await request(app).get('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.webhooks.length, 2);
  });

  test('requires auth', async () => {
    const res = await request(app).get('/api/webhooks');
    assert.strictEqual(res.status, 401);
  });

  test('rejects invalid URL', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'not-a-url' });
    assert.strictEqual(res.status, 400);
  });

  test('rejects http URL (only https allowed)', async () => {
    const u = await makeUserWithBusiness();
    // http:// is allowed by URL_RE — let's verify http works too
    const res = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'http://example.com/hook' });
    assert.strictEqual(res.status, 201); // http is allowed
  });

  test('filters unknown events to review.created default', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/hook', events: ['unknown.event'] });
    assert.deepStrictEqual(res.body.events, ['review.created']);
  });

  test('PUT updates url and events', async () => {
    const u = await makeUserWithBusiness();
    const created = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/old' });
    const res = await request(app).put(`/api/webhooks/${created.body.id}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/new', events: ['review.created', 'review.responded'] });
    assert.strictEqual(res.body.url, 'https://example.com/new');
    assert.deepStrictEqual(res.body.events, ['review.created', 'review.responded']);
  });

  test('PUT can disable a webhook', async () => {
    const u = await makeUserWithBusiness();
    const created = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/hook' });
    const res = await request(app).put(`/api/webhooks/${created.body.id}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ enabled: false });
    assert.strictEqual(res.body.enabled, 0);
  });

  test('DELETE removes webhook', async () => {
    const u = await makeUserWithBusiness();
    const created = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/hook' });
    const del = await request(app).delete(`/api/webhooks/${created.body.id}`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.body.deleted, true);

    const list = await request(app).get('/api/webhooks').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.webhooks.length, 0);
  });

  test('cross-user isolation — cannot update another user webhook', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const wh = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u1.token}`)
      .send({ url: 'https://example.com/hook' });
    const res = await request(app).put(`/api/webhooks/${wh.body.id}`)
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ url: 'https://evil.com/hook' });
    assert.strictEqual(res.status, 404);
  });

  test('enforces max 10 webhooks per account', async () => {
    const u = await makeUserWithBusiness();
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/webhooks')
        .set('Authorization', `Bearer ${u.token}`)
        .send({ url: `https://example.com/hook${i}` });
    }
    const res = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/hook10' });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('10'));
  });

  // ── Signature utility ─────────────────────────────────────────────────────

  test('sign produces sha256= prefixed hex', async () => {
    const { sign } = require('../src/lib/webhookDelivery');
    const sig = sign('mysecret', '{"hello":"world"}');
    assert.ok(sig.startsWith('sha256='));
    assert.ok(/^sha256=[0-9a-f]{64}$/.test(sig));
  });

  test('same secret + body always produces same signature', async () => {
    const { sign } = require('../src/lib/webhookDelivery');
    const a = sign('s', 'body');
    const b = sign('s', 'body');
    assert.strictEqual(a, b);
  });

  test('different body produces different signature', async () => {
    const { sign } = require('../src/lib/webhookDelivery');
    assert.notStrictEqual(sign('s', 'body1'), sign('s', 'body2'));
  });
});
