// Integration tests for PUT /api/reviews/:id/sentiment

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('sentiment override', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function makeReview(u, rating = 5) {
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Alice', rating });
    return res.body.review;
  }

  test('sets sentiment to negative', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u, 5); // auto = positive
    const res = await request(app).put(`/api/reviews/${rev.id}/sentiment`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ sentiment: 'negative' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sentiment, 'negative');
  });

  test('sets sentiment to neutral', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u, 1); // auto = negative
    const res = await request(app).put(`/api/reviews/${rev.id}/sentiment`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ sentiment: 'neutral' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sentiment, 'neutral');
  });

  test('sets sentiment to positive', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u, 3);
    const res = await request(app).put(`/api/reviews/${rev.id}/sentiment`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ sentiment: 'positive' });
    assert.strictEqual(res.body.sentiment, 'positive');
  });

  test('persists override in DB', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u, 5);
    await request(app).put(`/api/reviews/${rev.id}/sentiment`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ sentiment: 'negative' });

    const { get } = require('../src/db/schema');
    const stored = get('SELECT sentiment FROM reviews WHERE id = ?', [rev.id]);
    assert.strictEqual(stored.sentiment, 'negative');
  });

  test('rejects invalid sentiment value', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u);
    const res = await request(app).put(`/api/reviews/${rev.id}/sentiment`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ sentiment: 'very_bad' });
    assert.strictEqual(res.status, 400);
  });

  test('requires auth', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u);
    const res = await request(app).put(`/api/reviews/${rev.id}/sentiment`)
      .send({ sentiment: 'negative' });
    assert.strictEqual(res.status, 401);
  });

  test('cannot override another user review', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    const rev = await makeReview(u1);
    const res = await request(app).put(`/api/reviews/${rev.id}/sentiment`)
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ sentiment: 'negative' });
    assert.strictEqual(res.status, 404);
  });

  test('returns 400 for invalid review ID', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).put('/api/reviews/abc/sentiment')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ sentiment: 'positive' });
    assert.strictEqual(res.status, 400);
  });

  test('overridden sentiment appears in GET /reviews list', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u, 5); // positive
    await request(app).put(`/api/reviews/${rev.id}/sentiment`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ sentiment: 'negative' });

    const list = await request(app).get('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`);
    const found = list.body.reviews.find(r => r.id === rev.id);
    assert.strictEqual(found.sentiment, 'negative');
  });

  test('overridden sentiment works with sentiment filter', async () => {
    const u = await makeUserWithBusiness();
    const rev = await makeReview(u, 5); // starts positive
    await request(app).put(`/api/reviews/${rev.id}/sentiment`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ sentiment: 'negative' });

    const neg = await request(app).get('/api/reviews?sentiment=negative')
      .set('Authorization', `Bearer ${u.token}`);
    const pos = await request(app).get('/api/reviews?sentiment=positive')
      .set('Authorization', `Bearer ${u.token}`);

    assert.ok(neg.body.reviews.some(r => r.id === rev.id));
    assert.ok(!pos.body.reviews.some(r => r.id === rev.id));
  });
});
