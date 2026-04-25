// Tests for keyword matching in auto-rules

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('autoRules keywords', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function createRule(token, body) {
    const res = await request(app).post('/api/auto-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    return res;
  }

  async function createReview(token, body) {
    return request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  test('rule without keywords fires on any review text', async () => {
    const u = await makeUserWithBusiness();
    await createRule(u.token, {
      name: 'All positive',
      sentiment: 'positive',
      response_text: 'Thanks!',
    });
    const res = await createReview(u.token, {
      platform: 'google', reviewer_name: 'Alice', rating: 5,
      review_text: 'Great food',
    });
    assert.strictEqual(res.body.autoResponded, true);
  });

  test('rule with single keyword fires when keyword present', async () => {
    const u = await makeUserWithBusiness();
    await createRule(u.token, {
      name: 'Parking rule',
      response_text: 'Thanks for mentioning parking!',
      match_keywords: ['parking'],
    });
    const res = await createReview(u.token, {
      platform: 'google', reviewer_name: 'Bob', rating: 4,
      review_text: 'Great place, easy parking nearby',
    });
    assert.strictEqual(res.body.autoResponded, true);
    assert.ok(res.body.review.response_text.includes('parking'));
  });

  test('rule with single keyword does NOT fire when keyword absent', async () => {
    const u = await makeUserWithBusiness();
    await createRule(u.token, {
      name: 'Parking rule',
      response_text: 'Thanks for mentioning parking!',
      match_keywords: ['parking'],
    });
    const res = await createReview(u.token, {
      platform: 'google', reviewer_name: 'Carol', rating: 4,
      review_text: 'Great food and service',
    });
    assert.strictEqual(res.body.autoResponded, false);
  });

  test('rule with multiple keywords fires only when ALL present', async () => {
    const u = await makeUserWithBusiness();
    await createRule(u.token, {
      name: 'WiFi and coffee',
      response_text: 'Glad you enjoyed our wifi and coffee!',
      match_keywords: ['wifi', 'coffee'],
    });
    // Both present — should fire
    const res1 = await createReview(u.token, {
      platform: 'google', reviewer_name: 'Dave', rating: 5,
      review_text: 'Great wifi and amazing coffee',
    });
    assert.strictEqual(res1.body.autoResponded, true);

    // Only one present — should NOT fire
    const res2 = await createReview(u.token, {
      platform: 'google', reviewer_name: 'Eve', rating: 5,
      review_text: 'Great wifi but no coffee',
    });
    // "coffee" IS in the text, both match — but "no coffee" still contains the word "coffee"
    assert.strictEqual(res2.body.autoResponded, true);

    // Neither present — should NOT fire
    const res3 = await createReview(u.token, {
      platform: 'google', reviewer_name: 'Frank', rating: 5,
      review_text: 'Great food and service',
    });
    assert.strictEqual(res3.body.autoResponded, false);
  });

  test('keyword matching is case-insensitive', async () => {
    const u = await makeUserWithBusiness();
    await createRule(u.token, {
      name: 'Staff',
      response_text: 'Thanks for your comment about our staff!',
      match_keywords: ['staff'],
    });
    const res = await createReview(u.token, {
      platform: 'google', reviewer_name: 'Grace', rating: 5,
      review_text: 'The STAFF was incredibly friendly',
    });
    assert.strictEqual(res.body.autoResponded, true);
  });

  test('creates rule and persists keywords', async () => {
    const u = await makeUserWithBusiness();
    const res = await createRule(u.token, {
      name: 'Keyword rule',
      response_text: 'Thanks!',
      match_keywords: ['food', 'service'],
    });
    assert.strictEqual(res.status, 201);
    const kws = JSON.parse(res.body.match_keywords);
    assert.deepStrictEqual(kws, ['food', 'service']);
  });

  test('accepts keywords as comma-separated string', async () => {
    const u = await makeUserWithBusiness();
    const res = await createRule(u.token, {
      name: 'CSV keywords',
      response_text: 'Thanks!',
      match_keywords: 'fast, clean',
    });
    assert.strictEqual(res.status, 201);
    const kws = JSON.parse(res.body.match_keywords);
    assert.deepStrictEqual(kws, ['fast', 'clean']);
  });

  test('PUT can update keywords', async () => {
    const u = await makeUserWithBusiness();
    const created = await createRule(u.token, {
      name: 'Old kws',
      response_text: 'Thanks!',
      match_keywords: ['old'],
    });
    const res = await request(app).put(`/api/auto-rules/${created.body.id}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'Updated', response_text: 'Updated!', match_keywords: ['new', 'fresh'] });
    assert.strictEqual(res.status, 200);
    const kws = JSON.parse(res.body.match_keywords);
    assert.deepStrictEqual(kws, ['new', 'fresh']);
  });

  test('PUT can clear keywords by sending null', async () => {
    const u = await makeUserWithBusiness();
    const created = await createRule(u.token, {
      name: 'Has kws',
      response_text: 'Thanks!',
      match_keywords: ['word'],
    });
    const res = await request(app).put(`/api/auto-rules/${created.body.id}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'No kws', response_text: 'Thanks!', match_keywords: null });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.match_keywords, null);
  });
});
