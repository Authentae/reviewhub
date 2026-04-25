const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, makeUserWithBusiness, setPlan, request } = require('./helpers');
const { hashKey } = require('../src/routes/apiKeys');

describe('API keys — plan gate', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('Free plan: POST /api/apikeys returns 403', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/apikeys').set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'test key' });
    assert.strictEqual(res.status, 403);
    assert.match(res.body.error, /business plan/i);
  });

  test('Starter plan: POST /api/apikeys returns 403', async () => {
    const u = await makeUserWithBusiness('Starter Co', 'starter');
    const res = await request(app).post('/api/apikeys').set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'test key' });
    assert.strictEqual(res.status, 403);
  });
});

describe('API keys — CRUD (Business plan)', () => {
  let app, u;
  before(async () => {
    app = await getAgent();
    u = await makeUserWithBusiness('Biz Co', 'business');
  });

  test('GET /api/apikeys returns empty array initially', async () => {
    const res = await request(app).get('/api/apikeys').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.keys, []);
  });

  test('POST /api/apikeys creates a key and returns full key once', async () => {
    const res = await request(app).post('/api/apikeys').set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'My integration' });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.key.startsWith('rh_'), 'key should start with rh_');
    assert.ok(res.body.key.length > 10);
    assert.strictEqual(res.body.name, 'My integration');
    assert.ok(res.body.key_prefix.endsWith('…'));
    assert.ok(typeof res.body.id === 'number');
  });

  test('GET /api/apikeys lists the created key without full key', async () => {
    const res = await request(app).get('/api/apikeys').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.keys.length, 1);
    assert.strictEqual(res.body.keys[0].name, 'My integration');
    assert.ok(!res.body.keys[0].key, 'full key must not be in list response');
    assert.ok(!res.body.keys[0].key_hash, 'hash must not be in list response');
  });

  test('POST /api/apikeys — name required', async () => {
    const res = await request(app).post('/api/apikeys').set('Authorization', `Bearer ${u.token}`)
      .send({});
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /name/i);
  });

  test('POST /api/apikeys — name too long rejected', async () => {
    const res = await request(app).post('/api/apikeys').set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'x'.repeat(101) });
    assert.strictEqual(res.status, 400);
  });

  test('DELETE /api/apikeys/:id revokes the key', async () => {
    // create a key to revoke
    const create = await request(app).post('/api/apikeys').set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'To be revoked' });
    assert.strictEqual(create.status, 201);
    const id = create.body.id;

    const del = await request(app).delete(`/api/apikeys/${id}`).set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);
    assert.strictEqual(del.body.deleted, true);

    // key no longer in list
    const list = await request(app).get('/api/apikeys').set('Authorization', `Bearer ${u.token}`);
    assert.ok(!list.body.keys.some(k => k.id === id));
  });

  test('DELETE /api/apikeys/:id — cannot revoke another user\'s key', async () => {
    const other = await makeUserWithBusiness('Other Co', 'business');
    const create = await request(app).post('/api/apikeys').set('Authorization', `Bearer ${other.token}`)
      .send({ name: 'other key' });
    assert.strictEqual(create.status, 201);
    const id = create.body.id;

    const del = await request(app).delete(`/api/apikeys/${id}`).set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 404);
  });
});

describe('API key auth', () => {
  let app, u, rawKey;
  before(async () => {
    app = await getAgent();
    u = await makeUserWithBusiness('Auth Biz', 'business');
    const res = await request(app).post('/api/apikeys').set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'auth test key' });
    rawKey = res.body.key;
  });

  test('authenticated route accepts API key in Authorization header', async () => {
    const res = await request(app).get('/api/apikeys').set('Authorization', `Bearer ${rawKey}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.keys));
  });

  test('invalid API key returns 401', async () => {
    const res = await request(app).get('/api/apikeys').set('Authorization', 'Bearer rh_notavalidkey000000000000000000000000000000');
    assert.strictEqual(res.status, 401);
  });

  test('missing token returns 401', async () => {
    const res = await request(app).get('/api/apikeys');
    assert.strictEqual(res.status, 401);
  });
});

describe('API keys — max 10 keys limit', () => {
  let app, u;
  before(async () => {
    app = await getAgent();
    u = await makeUserWithBusiness('Max Keys Co', 'business');
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/apikeys').set('Authorization', `Bearer ${u.token}`)
        .send({ name: `key ${i}` });
      assert.strictEqual(res.status, 201);
    }
  });

  test('11th key is rejected with 400', async () => {
    const res = await request(app).post('/api/apikeys').set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'one too many' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /maximum/i);
  });
});
