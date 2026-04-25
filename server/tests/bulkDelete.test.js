// Integration tests for POST /api/reviews/bulk-delete

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('bulk delete', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function makeReview(u, name = 'Alice') {
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: name, rating: 5 });
    return res.body.review;
  }

  test('deletes specified reviews', async () => {
    const u = await makeUserWithBusiness();
    const r1 = await makeReview(u, 'Alice');
    const r2 = await makeReview(u, 'Bob');
    const r3 = await makeReview(u, 'Carol');

    const res = await request(app).post('/api/reviews/bulk-delete')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r1.id, r2.id] });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.deleted, 2);

    // r3 should still exist
    const list = await request(app).get('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.reviews.length, 1);
    assert.strictEqual(list.body.reviews[0].id, r3.id);
  });

  test('requires auth', async () => {
    const u = await makeUserWithBusiness();
    const r = await makeReview(u);
    const res = await request(app).post('/api/reviews/bulk-delete')
      .send({ review_ids: [r.id] });
    assert.strictEqual(res.status, 401);
  });

  test('rejects empty array', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/reviews/bulk-delete')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [] });
    assert.strictEqual(res.status, 400);
  });

  test('rejects more than 50 IDs', async () => {
    const u = await makeUserWithBusiness();
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    const res = await request(app).post('/api/reviews/bulk-delete')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: ids });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('50'));
  });

  test('rejects non-integer IDs', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/reviews/bulk-delete')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: ['abc'] });
    assert.strictEqual(res.status, 400);
  });

  test('silently ignores IDs not belonging to the user', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const r1 = await makeReview(u1);
    const r2 = await makeReview(u2);

    // u1 tries to delete u2's review alongside their own
    const res = await request(app).post('/api/reviews/bulk-delete')
      .set('Authorization', `Bearer ${u1.token}`)
      .send({ review_ids: [r1.id, r2.id] });

    assert.strictEqual(res.body.deleted, 1); // only r1

    // r2 still exists
    const { get } = require('../src/db/schema');
    assert.ok(get('SELECT id FROM reviews WHERE id = ?', [r2.id]));
  });

  test('cleans up review_tags when deleting', async () => {
    const u = await makeUserWithBusiness();
    const r = await makeReview(u);
    // Create a tag and attach it
    const tagRes = await request(app).post('/api/tags')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'TestTag', color: '#ff0000' });
    const tagId = tagRes.body.id;
    await request(app).put(`/api/reviews/${r.id}/tags`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ tag_ids: [tagId] });

    await request(app).post('/api/reviews/bulk-delete')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r.id] });

    const { all } = require('../src/db/schema');
    const orphans = all('SELECT * FROM review_tags WHERE review_id = ?', [r.id]);
    assert.strictEqual(orphans.length, 0);
  });

  test('returns deleted:0 when all IDs are foreign', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const r = await makeReview(u2);

    const res = await request(app).post('/api/reviews/bulk-delete')
      .set('Authorization', `Bearer ${u1.token}`)
      .send({ review_ids: [r.id] });

    assert.strictEqual(res.body.deleted, 0);
  });
});
