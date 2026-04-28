// Billing route tests.
//
// LemonSqueezy credentials are NOT configured in the test environment, so
// checkout/portal return 503. We still exercise auth guards, validation,
// conflict detection, and the webhook/promptpay endpoints that don't require
// external credentials.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, makeUserWithBusiness, setPlan, request } = require('./helpers');
const { run } = require('../src/db/schema');

describe('billing — checkout', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('POST /billing/checkout requires auth', async () => {
    const res = await request(app).post('/api/billing/checkout').send({ plan: 'starter' });
    assert.strictEqual(res.status, 401);
  });

  test('POST /billing/checkout rejects missing plan', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ cycle: 'monthly' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /plan/i);
  });

  test('POST /billing/checkout rejects invalid plan name', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ plan: 'enterprise', cycle: 'monthly' });
    assert.strictEqual(res.status, 400);
  });

  test('POST /billing/checkout rejects free plan (no checkout needed)', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ plan: 'free', cycle: 'monthly' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /free/i);
  });

  test('POST /billing/checkout rejects invalid cycle', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ plan: 'starter', cycle: 'weekly' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /cycle/i);
  });

  test('POST /billing/checkout returns 409 when already on active paid plan', async () => {
    const u = await makeUserWithBusiness();
    // Simulate an active paid subscription in the DB.
    run(
      `UPDATE subscriptions SET plan = 'starter', status = 'active',
       billing_subscription_id = 'sub_test_123' WHERE user_id = ?`,
      [u.userId]
    );
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ plan: 'pro', cycle: 'monthly' });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.code, 'already_subscribed');
  });

  test('POST /billing/checkout returns 503 when billing provider not configured', async () => {
    const u = await makeUserWithBusiness();
    // In the test environment LEMONSQUEEZY_API_KEY is not set → 503.
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ plan: 'starter', cycle: 'monthly' });
    assert.strictEqual(res.status, 503);
  });
});

describe('billing — portal', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('POST /billing/portal requires auth', async () => {
    const res = await request(app).post('/api/billing/portal').send({});
    assert.strictEqual(res.status, 401);
  });

  test('POST /billing/portal returns 400 when user has no subscription', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/billing/portal')
      .set('Authorization', `Bearer ${u.token}`)
      .send({});
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /no active subscription/i);
  });
});

describe('billing — webhook', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('POST /billing/webhook returns 200 when billing not configured', async () => {
    // No LS credentials → webhook is still accepted (prevents provider retry storms).
    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.ok || res.body.note);
  });
});

describe('billing — promptpay', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /billing/promptpay requires auth', async () => {
    const res = await request(app).get('/api/billing/promptpay?plan=starter');
    assert.strictEqual(res.status, 401);
  });

  test('GET /billing/promptpay returns 501 when PROMPTPAY_ID not set', async () => {
    const prev = process.env.PROMPTPAY_ID;
    delete process.env.PROMPTPAY_ID;
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .get('/api/billing/promptpay?plan=starter&cycle=monthly')
      .set('Authorization', `Bearer ${u.token}`);
    process.env.PROMPTPAY_ID = prev;
    assert.strictEqual(res.status, 501);
  });

  test('GET /billing/promptpay returns 400 for free plan', async () => {
    process.env.PROMPTPAY_ID = '0812345678';
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .get('/api/billing/promptpay?plan=free')
      .set('Authorization', `Bearer ${u.token}`);
    delete process.env.PROMPTPAY_ID;
    assert.strictEqual(res.status, 400);
  });

  test('GET /billing/promptpay returns QR payload for valid plan', async () => {
    process.env.PROMPTPAY_ID = '0812345678';
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .get('/api/billing/promptpay?plan=starter&cycle=monthly')
      .set('Authorization', `Bearer ${u.token}`);
    delete process.env.PROMPTPAY_ID;
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.payload, 'expected payload string');
    assert.ok(typeof res.body.amount_thb === 'number');
    assert.strictEqual(res.body.plan, 'starter');
  });
});
