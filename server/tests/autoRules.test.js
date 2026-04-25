// Integration tests for /api/auto-rules and auto-respond on review creation

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('auto-rules', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function createRule(u, body) {
    return request(app).post('/api/auto-rules').set('Authorization', `Bearer ${u.token}`).send(body);
  }

  async function createReview(u, body = {}) {
    return request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Test', rating: 5, ...body });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  test('GET /auto-rules requires auth', async () => {
    const res = await request(app).get('/api/auto-rules');
    assert.strictEqual(res.status, 401);
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────

  test('GET /auto-rules returns empty for new user', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).get('/api/auto-rules').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, []);
  });

  test('POST /auto-rules creates a rule', async () => {
    const u = await makeUserWithBusiness();
    const res = await createRule(u, {
      name: 'All 5-star',
      min_rating: 5,
      max_rating: 5,
      response_text: 'Thank you for the 5 stars!',
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.name, 'All 5-star');
    assert.strictEqual(res.body.min_rating, 5);
    assert.strictEqual(res.body.enabled, 1);
  });

  test('POST /auto-rules rejects missing name', async () => {
    const u = await makeUserWithBusiness();
    const res = await createRule(u, { response_text: 'Hi' });
    assert.strictEqual(res.status, 400);
  });

  test('POST /auto-rules rejects missing response_text', async () => {
    const u = await makeUserWithBusiness();
    const res = await createRule(u, { name: 'X' });
    assert.strictEqual(res.status, 400);
  });

  test('POST /auto-rules rejects invalid platform', async () => {
    const u = await makeUserWithBusiness();
    const res = await createRule(u, { name: 'X', platform: 'twitter', response_text: 'Hi' });
    assert.strictEqual(res.status, 400);
  });

  test('POST /auto-rules rejects invalid sentiment', async () => {
    const u = await makeUserWithBusiness();
    const res = await createRule(u, { name: 'X', sentiment: 'angry', response_text: 'Hi' });
    assert.strictEqual(res.status, 400);
  });

  test('POST /auto-rules rejects min_rating > max_rating', async () => {
    const u = await makeUserWithBusiness();
    const res = await createRule(u, { name: 'X', min_rating: 5, max_rating: 3, response_text: 'Hi' });
    assert.strictEqual(res.status, 400);
  });

  test('PUT /auto-rules/:id toggles enabled', async () => {
    const u = await makeUserWithBusiness();
    const created = await createRule(u, { name: 'Toggle', response_text: 'R' });
    const res = await request(app)
      .put(`/api/auto-rules/${created.body.id}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ enabled: false });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.enabled, 0);
  });

  test('PUT /auto-rules/:id returns 404 for another user', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const created = await createRule(u1, { name: 'Mine', response_text: 'R' });
    const res = await request(app)
      .put(`/api/auto-rules/${created.body.id}`)
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ name: 'Stolen', response_text: 'R' });
    assert.strictEqual(res.status, 404);
  });

  test('DELETE /auto-rules/:id removes the rule', async () => {
    const u = await makeUserWithBusiness();
    const created = await createRule(u, { name: 'Del', response_text: 'R' });
    const del = await request(app).delete(`/api/auto-rules/${created.body.id}`).set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);
    assert.strictEqual(del.body.deleted, true);
    const list = await request(app).get('/api/auto-rules').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.length, 0);
  });

  // ── Auto-respond on review creation ──────────────────────────────────────

  test('new review matching a rule gets auto-responded', async () => {
    const u = await makeUserWithBusiness();
    await createRule(u, { name: '5-star auto', min_rating: 5, max_rating: 5, response_text: 'Thanks for 5 stars!' });
    const res = await createReview(u, { rating: 5 });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.review.response_text, 'Thanks for 5 stars!');
    assert.strictEqual(res.body.autoResponded, true);
  });

  test('new review NOT matching a rule gets no auto-response', async () => {
    const u = await makeUserWithBusiness();
    await createRule(u, { name: '5-star only', min_rating: 5, max_rating: 5, response_text: 'Thanks!' });
    const res = await createReview(u, { rating: 3 });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.review.response_text, null);
    assert.strictEqual(res.body.autoResponded, false);
  });

  test('rule matching by platform', async () => {
    const u = await makeUserWithBusiness();
    await createRule(u, { name: 'Google only', platform: 'google', response_text: 'Google thanks!' });
    const googleRes = await createReview(u, { platform: 'google', rating: 4 });
    const yelpRes = await createReview(u, { platform: 'yelp', rating: 4 });
    assert.ok(googleRes.body.review.response_text);
    assert.strictEqual(yelpRes.body.review.response_text, null);
  });

  test('rule matching by sentiment', async () => {
    const u = await makeUserWithBusiness();
    // rating 5 → positive sentiment
    await createRule(u, { name: 'Positive only', sentiment: 'positive', response_text: 'Great!' });
    const pos = await createReview(u, { rating: 5, review_text: 'Amazing experience!' });
    const neg = await createReview(u, { rating: 1, review_text: 'Terrible!' });
    assert.ok(pos.body.review.response_text);
    assert.strictEqual(neg.body.review.response_text, null);
  });

  test('disabled rule is skipped', async () => {
    const u = await makeUserWithBusiness();
    const created = await createRule(u, { name: 'Disabled', min_rating: 5, response_text: 'Hi!' });
    await request(app).put(`/api/auto-rules/${created.body.id}`).set('Authorization', `Bearer ${u.token}`).send({ enabled: false });
    const res = await createReview(u, { rating: 5 });
    assert.strictEqual(res.body.review.response_text, null);
  });

  test('first matching rule wins (oldest wins)', async () => {
    const u = await makeUserWithBusiness();
    await createRule(u, { name: 'First', min_rating: 4, response_text: 'First reply' });
    await createRule(u, { name: 'Second', min_rating: 5, response_text: 'Second reply' });
    const res = await createReview(u, { rating: 5 });
    assert.strictEqual(res.body.review.response_text, 'First reply');
  });

  // ── Auto-tag on rule match ────────────────────────────────────────────────

  test('matching rule with tag_id applies tag to review', async () => {
    const u = await makeUserWithBusiness();
    // Create a tag
    const tagRes = await request(app).post('/api/tags')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'auto-tagged', color: '#ff0000' });
    assert.strictEqual(tagRes.status, 201);
    const tagId = tagRes.body.id;

    await createRule(u, { name: 'Tag 5 stars', min_rating: 5, response_text: 'Thanks!', tag_id: tagId });
    const rev = await createReview(u, { rating: 5 });
    assert.strictEqual(rev.status, 201);

    const { get } = require('../src/db/schema');
    const rt = get('SELECT * FROM review_tags WHERE review_id = ? AND tag_id = ?', [rev.body.review.id, tagId]);
    assert.ok(rt !== null, 'Expected review_tags entry to exist');
  });

  test('rule tag_id ignored if tag belongs to different user', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    // u1 creates tag, u2 creates rule referencing that tag
    const tagRes = await request(app).post('/api/tags')
      .set('Authorization', `Bearer ${u1.token}`)
      .send({ name: 'u1-tag', color: '#00ff00' });
    const tagId = tagRes.body.id;

    await createRule(u2, { name: 'U2 rule', min_rating: 5, response_text: 'Hi!', tag_id: tagId });
    const rev = await createReview(u2, { rating: 5 });
    assert.strictEqual(rev.status, 201);

    const { get } = require('../src/db/schema');
    const rt = get('SELECT * FROM review_tags WHERE review_id = ? AND tag_id = ?', [rev.body.review.id, tagId]);
    assert.strictEqual(rt, null, 'Tag should NOT be applied to another user\'s review');
  });
});
