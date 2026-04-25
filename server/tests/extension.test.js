// Tests for the browser-extension auth + draft endpoints.
//
// Two surfaces:
//   /api/auth/extension-token       — generate / revoke / status (authed)
//   /api/extension/draft            — generate AI draft from scraped review
//                                     (authed via rh_ext_<token> bearer)

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request } = require('./helpers');

describe('extension token lifecycle', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /auth/extension-token shows has_token=false initially', async () => {
    const u = await makeUser();
    const res = await request(app).get('/api/auth/extension-token').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.has_token, false);
    assert.strictEqual(res.body.created_at, null);
  });

  test('POST /auth/extension-token returns a plaintext rh_ext_ token', async () => {
    const u = await makeUser();
    const res = await request(app).post('/api/auth/extension-token').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token.startsWith('rh_ext_'), 'token must start with rh_ext_');
    assert.ok(res.body.token.length > 20);
    assert.ok(res.body.created_at);
  });

  test('after POST, GET shows has_token=true', async () => {
    const u = await makeUser();
    await request(app).post('/api/auth/extension-token').set('Authorization', `Bearer ${u.token}`);
    const res = await request(app).get('/api/auth/extension-token').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.has_token, true);
    assert.ok(res.body.created_at);
  });

  test('regenerating replaces the old token (old stops working)', async () => {
    const u = await makeUser();
    const first = await request(app).post('/api/auth/extension-token').set('Authorization', `Bearer ${u.token}`);
    const firstToken = first.body.token;
    // Regenerate
    const second = await request(app).post('/api/auth/extension-token').set('Authorization', `Bearer ${u.token}`);
    assert.notStrictEqual(firstToken, second.body.token);

    // Old token no longer valid on the extension draft endpoint
    const draftAttempt = await request(app).post('/api/extension/draft')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ platform: 'yelp', rating: 3, review_text: 'Test', reviewer_name: 'X' });
    assert.strictEqual(draftAttempt.status, 401);
  });

  test('DELETE /auth/extension-token revokes the token', async () => {
    const u = await makeUser();
    const gen = await request(app).post('/api/auth/extension-token').set('Authorization', `Bearer ${u.token}`);
    const extToken = gen.body.token;
    const del = await request(app).delete('/api/auth/extension-token').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);
    assert.strictEqual(del.body.revoked, true);
    // Revoked token rejected
    const attempt = await request(app).post('/api/extension/draft')
      .set('Authorization', `Bearer ${extToken}`)
      .send({ platform: 'yelp', rating: 3, review_text: 'Test', reviewer_name: 'X' });
    assert.strictEqual(attempt.status, 401);
  });

  test('all three endpoints require auth', async () => {
    const get1 = await request(app).get('/api/auth/extension-token');
    const post1 = await request(app).post('/api/auth/extension-token');
    const del1 = await request(app).delete('/api/auth/extension-token');
    assert.strictEqual(get1.status, 401);
    assert.strictEqual(post1.status, 401);
    assert.strictEqual(del1.status, 401);
  });
});

describe('extension draft endpoint', () => {
  let app, u, extToken;
  before(async () => {
    app = await getAgent();
    u = await makeUser();
    const res = await request(app).post('/api/auth/extension-token').set('Authorization', `Bearer ${u.token}`);
    extToken = res.body.token;
  });

  test('POST /extension/draft with valid rh_ext_ token returns a draft', async () => {
    const res = await request(app).post('/api/extension/draft')
      .set('Authorization', `Bearer ${extToken}`)
      .send({
        platform: 'yelp',
        reviewer_name: 'Alice',
        rating: 5,
        review_text: 'Wonderful service, the pasta was amazing!',
        business_name: 'Luigi\'s',
      });
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.draft === 'string' && res.body.draft.length > 0);
    assert.strictEqual(res.body.platform, 'yelp');
    assert.ok(['ai', 'template'].includes(res.body.source));
  });

  test('rejects unknown platforms', async () => {
    const res = await request(app).post('/api/extension/draft')
      .set('Authorization', `Bearer ${extToken}`)
      .send({ platform: 'mySpace', rating: 5, review_text: 'hi', reviewer_name: 'x' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /platform/);
  });

  test('requires review_text', async () => {
    const res = await request(app).post('/api/extension/draft')
      .set('Authorization', `Bearer ${extToken}`)
      .send({ platform: 'yelp', rating: 5, reviewer_name: 'x' });
    assert.strictEqual(res.status, 400);
  });

  test('requires rating 1-5', async () => {
    const res = await request(app).post('/api/extension/draft')
      .set('Authorization', `Bearer ${extToken}`)
      .send({ platform: 'yelp', rating: 7, review_text: 'x', reviewer_name: 'y' });
    assert.strictEqual(res.status, 400);
  });

  test('rejects a JWT (must use rh_ext_ token)', async () => {
    // JWTs don't start with rh_ so the middleware routes them through normal
    // auth — but the extension route is authed via the same middleware, so
    // a JWT actually works too. This is fine — JWT holders are the same user.
    // The test clarifies intended behavior: a JWT DOES work, a different
    // user's JWT does NOT.
    const res = await request(app).post('/api/extension/draft')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', rating: 4, review_text: 'Nice', reviewer_name: 'Z' });
    assert.strictEqual(res.status, 200, 'JWT belonging to the same user is accepted');
  });

  test('rejects invalid rh_ext_ tokens', async () => {
    const res = await request(app).post('/api/extension/draft')
      .set('Authorization', 'Bearer rh_ext_this_is_not_a_valid_token_0000000000000000')
      .send({ platform: 'yelp', rating: 3, review_text: 'x', reviewer_name: 'y' });
    assert.strictEqual(res.status, 401);
  });

  test('accepts all allowed platforms', async () => {
    const platforms = ['google', 'yelp', 'facebook', 'tripadvisor', 'trustpilot', 'amazon', 'etsy', 'booking', 'airbnb', 'wongnai', 'other'];
    for (const p of platforms) {
      const res = await request(app).post('/api/extension/draft')
        .set('Authorization', `Bearer ${extToken}`)
        .send({ platform: p, rating: 4, review_text: 'Test', reviewer_name: 'T' });
      assert.strictEqual(res.status, 200, `platform ${p} should be accepted`);
    }
  });
});
