// Integration tests for /api/businesses — multi-business + active-business switch

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, makeUserWithBusiness, request } = require('./helpers');

describe('businesses', () => {
  let app;
  before(async () => { app = await getAgent(); });

  function setPlan(userId, plan) {
    const { run } = require('../src/db/schema');
    run('UPDATE subscriptions SET plan = ? WHERE user_id = ?', [plan, userId]);
  }

  // ── List ──────────────────────────────────────────────────────────────────

  test('GET /businesses returns empty list for new user', async () => {
    const u = await makeUser();
    const res = await request(app).get('/api/businesses').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.businesses, []);
    assert.strictEqual(res.body.active_business_id, null);
  });

  test('GET /businesses returns businesses with active_business_id', async () => {
    const u = await makeUserWithBusiness('Biz A');
    const res = await request(app).get('/api/businesses').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.businesses.length, 1);
    assert.strictEqual(res.body.active_business_id, u.businessId);
  });

  // ── Create with plan limits ───────────────────────────────────────────────

  test('POST /businesses second business blocked on Free plan', async () => {
    const u = await makeUserWithBusiness('First');
    const res = await request(app).post('/api/businesses')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ business_name: 'Second' });
    assert.strictEqual(res.status, 409);
  });

  test('POST /businesses second business blocked on Starter plan', async () => {
    const u = await makeUserWithBusiness('First', 'starter');
    const res = await request(app).post('/api/businesses')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ business_name: 'Second' });
    assert.strictEqual(res.status, 409);
  });

  test('POST /businesses allows up to 5 on Business plan', async () => {
    const u = await makeUser();
    setPlan(u.userId, 'business');

    for (let i = 1; i <= 5; i++) {
      const res = await request(app).post('/api/businesses')
        .set('Authorization', `Bearer ${u.token}`)
        .send({ business_name: `Location ${i}` });
      assert.strictEqual(res.status, 200, `Failed on location ${i}: ${res.body.error}`);
    }

    const res6 = await request(app).post('/api/businesses')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ business_name: 'Location 6' });
    assert.strictEqual(res6.status, 403);
    assert.strictEqual(res6.body.upgrade, true);
  });

  // ── Active business switch ────────────────────────────────────────────────

  test('PUT /businesses/active switches active business', async () => {
    const u = await makeUser();
    setPlan(u.userId, 'business');

    const b1 = await request(app).post('/api/businesses')
      .set('Authorization', `Bearer ${u.token}`).send({ business_name: 'Biz One' });
    const b2 = await request(app).post('/api/businesses')
      .set('Authorization', `Bearer ${u.token}`).send({ business_name: 'Biz Two' });

    // Switch to b2
    const sw = await request(app).put('/api/businesses/active')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ business_id: b2.body.id });
    assert.strictEqual(sw.status, 200);
    assert.strictEqual(sw.body.active_business_id, b2.body.id);

    // List should reflect b2 as active
    const list = await request(app).get('/api/businesses').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.active_business_id, b2.body.id);
  });

  test('PUT /businesses/active rejects another user\'s business', async () => {
    const u1 = await makeUserWithBusiness('U1 Biz', 'business');
    const u2 = await makeUser();

    const res = await request(app).put('/api/businesses/active')
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ business_id: u1.businessId });
    assert.strictEqual(res.status, 404);
  });

  test('PUT /businesses/active requires auth', async () => {
    const res = await request(app).put('/api/businesses/active').send({ business_id: 1 });
    assert.strictEqual(res.status, 401);
  });

  test('PUT /businesses/active rejects invalid ID', async () => {
    const u = await makeUser();
    const res = await request(app).put('/api/businesses/active')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ business_id: 'notanumber' });
    assert.strictEqual(res.status, 400);
  });
});
