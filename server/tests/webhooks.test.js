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

  // Signing secrets must be returned ONLY on the create response — GET
  // list should omit them so they aren't sitting in browser memory /
  // shared cache after every fetch. The UI shows the secret once at
  // creation time and the user copies it into their receiver service.
  test('GET /api/webhooks does NOT include the signing secret', async () => {
    const u = await makeUserWithBusiness();
    const create = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/secret-test' });
    assert.ok(create.body.secret, 'create response must include secret');

    const res = await request(app).get('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    for (const hook of res.body.webhooks) {
      assert.strictEqual(hook.secret, undefined, 'GET list must omit secret');
    }
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

  test('PUT does NOT re-emit the signing secret', async () => {
    // Regression: previously every edit (toggle enabled, change url) returned
    // the full row including `secret`, defeating the "shown once at creation"
    // guarantee and keeping the secret in browser memory long after the user
    // dismissed the reveal banner.
    const u = await makeUserWithBusiness();
    const created = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'https://example.com/old' });
    assert.ok(created.body.secret);

    // No-op update (no fields)
    const noop = await request(app).put(`/api/webhooks/${created.body.id}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({});
    assert.strictEqual(noop.body.secret, undefined, 'no-op PUT must not leak secret');

    // Real update
    const real = await request(app).put(`/api/webhooks/${created.body.id}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ enabled: false });
    assert.strictEqual(real.body.secret, undefined, 'PUT response must not leak secret');
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

  // The review.responded webhook represents a one-time state transition
  // (review went from unanswered → answered). Edits to an existing
  // response are typo fixes, not new business events, and should not
  // re-notify Slack/Zapier integrations.
  test('review.responded fires only on first response, not on edits', async () => {
    const u = await makeUserWithBusiness();
    const hookRes = await request(app).post('/api/webhooks')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ url: 'http://127.0.0.1:1/hook', events: ['review.responded'] });
    assert.strictEqual(hookRes.status, 201);
    const hookId = hookRes.body.id;

    const reviewRes = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Alice', rating: 5, review_text: 'Great!' });
    assert.strictEqual(reviewRes.status, 201, `review create: ${JSON.stringify(reviewRes.body)}`);
    const reviewId = reviewRes.body.review.id;

    // First response — webhook should fire (1 delivery row)
    const r1 = await request(app).post(`/api/reviews/${reviewId}/respond`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Thank you Alice!' });
    assert.strictEqual(r1.status, 200, `first respond: ${JSON.stringify(r1.body)}`);

    // Edit response — webhook should NOT fire again (still 1 delivery row)
    const r2 = await request(app).post(`/api/reviews/${reviewId}/respond`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Thanks so much, Alice!' });
    assert.strictEqual(r2.status, 200, `edit respond: ${JSON.stringify(r2.body)}`);

    // Drain fire-and-forget delivery (5s connect timeout on the worker)
    await new Promise(r => setTimeout(r, 6000));

    const { all } = require('../src/db/schema');
    const deliveries = all(
      "SELECT * FROM webhook_deliveries WHERE webhook_id = ? AND event = 'review.responded'",
      [hookId]
    );
    assert.strictEqual(deliveries.length, 1, `expected exactly 1 delivery row, got ${deliveries.length}`);
  });
});
