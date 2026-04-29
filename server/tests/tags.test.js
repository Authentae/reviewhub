// Integration tests for /api/tags and PUT /api/reviews/:id/tags

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('tags', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function makeReview(u) {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Tester', rating: 4 });
    return res.body.review;
  }

  async function makeTag(u, name = 'VIP', color = '#3b82f6') {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name, color });
    return res.body;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  test('GET /tags returns empty array for new user', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).get('/api/tags').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, []);
  });

  test('POST /tags creates a tag', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'VIP', color: '#ef4444' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.name, 'VIP');
    assert.strictEqual(res.body.color, '#ef4444');
    assert.ok(res.body.id > 0);
  });

  test('POST /tags rejects empty name', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: '   ' });
    assert.strictEqual(res.status, 400);
  });

  test('POST /tags rejects duplicate name for same user', async () => {
    const u = await makeUserWithBusiness();
    await makeTag(u, 'Unique');
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'Unique' });
    assert.strictEqual(res.status, 409);
  });

  test('two users can have tags with the same name', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const r1 = await request(app).post('/api/tags').set('Authorization', `Bearer ${u1.token}`).send({ name: 'Shared' });
    const r2 = await request(app).post('/api/tags').set('Authorization', `Bearer ${u2.token}`).send({ name: 'Shared' });
    assert.strictEqual(r1.status, 201);
    assert.strictEqual(r2.status, 201);
    assert.notStrictEqual(r1.body.id, r2.body.id);
  });

  test('PUT /tags/:id updates name and color', async () => {
    const u = await makeUserWithBusiness();
    const tag = await makeTag(u, 'Old');
    const res = await request(app)
      .put(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'New', color: '#10b981' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.name, 'New');
    assert.strictEqual(res.body.color, '#10b981');
  });

  test('PUT /tags/:id returns 404 for another user\'s tag', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const tag = await makeTag(u1, 'Mine');
    const res = await request(app)
      .put(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ name: 'Stolen' });
    assert.strictEqual(res.status, 404);
  });

  test('DELETE /tags/:id removes tag', async () => {
    const u = await makeUserWithBusiness();
    const tag = await makeTag(u, 'ToDelete');
    const del = await request(app).delete(`/api/tags/${tag.id}`).set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);
    assert.strictEqual(del.body.deleted, true);
    const list = await request(app).get('/api/tags').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.length, 0);
  });

  test('DELETE /tags/:id nulls out auto_rules that reference the tag', async () => {
    // Regression: auto_rules.tag_id was added via migrateAddColumn (no real
    // FK), so deleting a tag previously left orphan tag_id pointers and the
    // rules engine quietly stopped matching for those rules.
    const u = await makeUserWithBusiness();
    const tag = await makeTag(u, 'WillDelete');
    const ruleRes = await request(app)
      .post('/api/auto-rules')
      .set('Authorization', `Bearer ${u.token}`)
      .send({
        name: 'Auto-thanks tagged reviews',
        sentiment: 'positive',
        response_text: 'Thank you for the kind words!',
        tag_id: tag.id,
      });
    assert.strictEqual(ruleRes.status, 201, `expected 201, got ${ruleRes.status}: ${JSON.stringify(ruleRes.body)}`);
    assert.strictEqual(ruleRes.body.tag_id, tag.id);

    const del = await request(app).delete(`/api/tags/${tag.id}`).set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);

    const rules = await request(app).get('/api/auto-rules').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(rules.status, 200);
    const rule = rules.body.find(r => r.id === ruleRes.body.id);
    assert.ok(rule, 'rule should still exist');
    assert.strictEqual(rule.tag_id, null, 'rule.tag_id should be nulled when the tag is deleted');
  });

  test('DELETE /tags/:id returns 404 for another user\'s tag', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const tag = await makeTag(u1, 'NotYours');
    const res = await request(app).delete(`/api/tags/${tag.id}`).set('Authorization', `Bearer ${u2.token}`);
    assert.strictEqual(res.status, 404);
  });

  test('GET /tags includes review_count', async () => {
    const u = await makeUserWithBusiness();
    const tag = await makeTag(u, 'Counted');
    const review = await makeReview(u);
    await request(app)
      .put(`/api/reviews/${review.id}/tags`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ tag_ids: [tag.id] });
    const list = await request(app).get('/api/tags').set('Authorization', `Bearer ${u.token}`);
    const found = list.body.find(t => t.id === tag.id);
    assert.strictEqual(Number(found.review_count), 1);
  });

  // ── Review tagging ────────────────────────────────────────────────────────

  test('PUT /reviews/:id/tags assigns tags to a review', async () => {
    const u = await makeUserWithBusiness();
    const tag1 = await makeTag(u, 'T1');
    const tag2 = await makeTag(u, 'T2');
    const review = await makeReview(u);
    const res = await request(app)
      .put(`/api/reviews/${review.id}/tags`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ tag_ids: [tag1.id, tag2.id] });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tags.length, 2);
    const names = res.body.tags.map(t => t.name).sort();
    assert.deepStrictEqual(names, ['T1', 'T2']);
  });

  test('PUT /reviews/:id/tags replaces existing tags', async () => {
    const u = await makeUserWithBusiness();
    const t1 = await makeTag(u, 'Keep');
    const t2 = await makeTag(u, 'Drop');
    const review = await makeReview(u);
    await request(app).put(`/api/reviews/${review.id}/tags`).set('Authorization', `Bearer ${u.token}`).send({ tag_ids: [t1.id, t2.id] });
    const res = await request(app).put(`/api/reviews/${review.id}/tags`).set('Authorization', `Bearer ${u.token}`).send({ tag_ids: [t1.id] });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tags.length, 1);
    assert.strictEqual(res.body.tags[0].name, 'Keep');
  });

  test('PUT /reviews/:id/tags clears tags with empty array', async () => {
    const u = await makeUserWithBusiness();
    const tag = await makeTag(u, 'ClearMe');
    const review = await makeReview(u);
    await request(app).put(`/api/reviews/${review.id}/tags`).set('Authorization', `Bearer ${u.token}`).send({ tag_ids: [tag.id] });
    const res = await request(app).put(`/api/reviews/${review.id}/tags`).set('Authorization', `Bearer ${u.token}`).send({ tag_ids: [] });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.tags, []);
  });

  test('PUT /reviews/:id/tags rejects tag_ids from another user', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const tag = await makeTag(u1, 'OwnerTag');
    const review = await makeReview(u2);
    const res = await request(app)
      .put(`/api/reviews/${review.id}/tags`)
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ tag_ids: [tag.id] });
    assert.strictEqual(res.status, 400);
  });

  test('GET /reviews includes tags array', async () => {
    const u = await makeUserWithBusiness();
    const tag = await makeTag(u, 'InList');
    const review = await makeReview(u);
    await request(app).put(`/api/reviews/${review.id}/tags`).set('Authorization', `Bearer ${u.token}`).send({ tag_ids: [tag.id] });
    const list = await request(app).get('/api/reviews').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.status, 200);
    const found = list.body.reviews.find(r => r.id === review.id);
    assert.ok(Array.isArray(found.tags));
    assert.strictEqual(found.tags[0].name, 'InList');
  });

  test('DELETE /tags/:id cascades from review_tags', async () => {
    const u = await makeUserWithBusiness();
    const tag = await makeTag(u, 'CascadeTag');
    const review = await makeReview(u);
    await request(app).put(`/api/reviews/${review.id}/tags`).set('Authorization', `Bearer ${u.token}`).send({ tag_ids: [tag.id] });
    await request(app).delete(`/api/tags/${tag.id}`).set('Authorization', `Bearer ${u.token}`);
    const list = await request(app).get('/api/reviews').set('Authorization', `Bearer ${u.token}`);
    const found = list.body.reviews.find(r => r.id === review.id);
    assert.deepStrictEqual(found.tags, []);
  });

  test('GET /reviews?tag_id=X returns accurate total and full pages', async () => {
    // Regression: tag filtering used to be applied post-LIMIT in JS, which
    // made `total` reflect untagged rows and produced partial pages.
    const u = await makeUserWithBusiness();
    const tag = await makeTag(u, 'PaginationTag');

    // 8 reviews total: 5 tagged, 3 untagged. With limit=10 and tag filter,
    // we should get exactly the 5 tagged reviews and total=5.
    const tagged = [];
    for (let i = 0; i < 5; i++) tagged.push(await makeReview(u));
    for (let i = 0; i < 3; i++) await makeReview(u);
    for (const r of tagged) {
      await request(app).put(`/api/reviews/${r.id}/tags`)
        .set('Authorization', `Bearer ${u.token}`).send({ tag_ids: [tag.id] });
    }

    const res = await request(app)
      .get(`/api/reviews?tag_id=${tag.id}&limit=10`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 5, 'total should reflect tag filter');
    assert.strictEqual(res.body.reviews.length, 5, 'should return all 5 tagged reviews');
    for (const r of res.body.reviews) {
      assert.ok(r.tags.some(t => t.id === tag.id), `review ${r.id} should carry the tag`);
    }
  });

  test('GET /reviews?tag_id=X paginates correctly', async () => {
    const u = await makeUserWithBusiness();
    const tag = await makeTag(u, 'BigTag');
    // 7 tagged reviews, plus 5 untagged distractors that should not steal slots.
    const tagged = [];
    for (let i = 0; i < 7; i++) tagged.push(await makeReview(u));
    for (let i = 0; i < 5; i++) await makeReview(u);
    for (const r of tagged) {
      await request(app).put(`/api/reviews/${r.id}/tags`)
        .set('Authorization', `Bearer ${u.token}`).send({ tag_ids: [tag.id] });
    }

    const page1 = await request(app)
      .get(`/api/reviews?tag_id=${tag.id}&limit=5&page=1`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(page1.body.total, 7);
    assert.strictEqual(page1.body.reviews.length, 5);

    const page2 = await request(app)
      .get(`/api/reviews?tag_id=${tag.id}&limit=5&page=2`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(page2.body.total, 7);
    assert.strictEqual(page2.body.reviews.length, 2, 'page 2 should have remaining 2 tagged reviews');
  });

  test('POST /tags rejects with 400 once user hits the per-account cap', async () => {
    // Cap is 50; we go up to that, then assert the next POST is rejected.
    // Direct DB inserts would skip the route's check and let us seed faster,
    // but driving through the real route is what we actually care about.
    const u = await makeUserWithBusiness();
    for (let i = 0; i < 50; i++) {
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${u.token}`)
        .send({ name: `cap-${i}` });
      assert.strictEqual(res.status, 201, `seed POST #${i} failed: ${res.status}`);
    }
    const overflow = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'one-too-many' });
    assert.strictEqual(overflow.status, 400);
    assert.match(overflow.body.error, /Maximum 50 tags/);
  });
});
