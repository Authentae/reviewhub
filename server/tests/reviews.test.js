// Integration tests for reviews + businesses + templates.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('reviews + businesses', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /reviews returns empty set for a new user', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).get('/api/reviews').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 0);
  });

  test('POST /reviews creates a review', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Alice', rating: 5, review_text: 'Fantastic service!' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.review.rating, 5);
    assert.strictEqual(res.body.review.reviewer_name, 'Alice');
  });

  test('POST /reviews rejects invalid rating', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'X', rating: 99 });
    assert.strictEqual(res.status, 400);
  });

  test('POST /reviews rejects invalid platform', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'linkedin', reviewer_name: 'X', rating: 5 });
    assert.strictEqual(res.status, 400);
  });

  test('POST /reviews rejects non-string reviewer_name (type-guard)', async () => {
    // Regression: without the typeof check, .trim() threw and the route
    // returned 500. Now we want a clean 400.
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: ['not-a-string'], rating: 5 });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /string/i);
  });

  test('POST /reviews rejects non-string platform (type-guard)', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: { x: 1 }, reviewer_name: 'X', rating: 5 });
    assert.strictEqual(res.status, 400);
  });

  test('filter by sentiment and rating works', async () => {
    const u = await makeUserWithBusiness();
    for (const [name, rating, txt] of [
      ['A', 5, 'wonderful great love'],
      ['B', 1, 'terrible awful horrible'],
      ['C', 3, 'it was okay'],
    ]) {
      await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
        .send({ platform: 'google', reviewer_name: name, rating, review_text: txt });
    }
    const pos = await request(app).get('/api/reviews?sentiment=positive').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(pos.body.total, 1);
    const five = await request(app).get('/api/reviews?rating=5').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(five.body.total, 1);
    assert.strictEqual(five.body.reviews[0].reviewer_name, 'A');
  });

  test('respond, note, delete lifecycle', async () => {
    const u = await makeUserWithBusiness();
    const create = await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'yelp', reviewer_name: 'Deleter', rating: 4, review_text: 'nice' });
    const id = create.body.review.id;
    // respond
    const respond = await request(app).post(`/api/reviews/${id}/respond`).set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Thanks!' });
    assert.strictEqual(respond.status, 200);
    // response appears
    const list = await request(app).get('/api/reviews').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.reviews[0].response_text, 'Thanks!');
    // note
    const note = await request(app).put(`/api/reviews/${id}/note`).set('Authorization', `Bearer ${u.token}`)
      .send({ note: 'private' });
    assert.strictEqual(note.status, 200);
    // delete
    const del = await request(app).delete(`/api/reviews/${id}`).set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);
    // gone
    const final = await request(app).get('/api/reviews').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(final.body.total, 0);
  });

  test('users can only see their own reviews', async () => {
    const a = await makeUserWithBusiness('A Co');
    const b = await makeUserWithBusiness('B Co');
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${a.token}`)
      .send({ platform: 'google', reviewer_name: 'leak?', rating: 5 });
    const resB = await request(app).get('/api/reviews').set('Authorization', `Bearer ${b.token}`);
    assert.strictEqual(resB.body.total, 0);
  });

  test('GET /:id/draft returns a draft with the source marked', async () => {
    const u = await makeUserWithBusiness();
    const create = await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Drafty', rating: 5, review_text: 'great' });
    const id = create.body.review.id;
    const res = await request(app).get(`/api/reviews/${id}/draft`).set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.draft === 'string' && res.body.draft.length > 0);
    assert.ok(['ai', 'template'].includes(res.body.source),
      `source must be 'ai' or 'template', got: ${res.body.source}`);
    // No ANTHROPIC_API_KEY in test env → must fall back to template.
    if (!process.env.ANTHROPIC_API_KEY) {
      assert.strictEqual(res.body.source, 'template');
    }
  });

  test('CSV export blocked on Free plan', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).get('/api/reviews/export/csv').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 403);
    assert.match(res.body.error, /pro plan/i);
  });

  test('CSV export returns a well-formed header', async () => {
    const u = await makeUserWithBusiness('CSV Co', 'pro');
    const res = await request(app).get('/api/reviews/export/csv').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.text.split('\r\n')[0], /ID,Platform,Reviewer,Rating/);
  });

  test('JSON export returns filter metadata + review array', async () => {
    const u = await makeUserWithBusiness('JSON Co', 'pro');
    // Seed a review so the export has something to contain
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Exporter', rating: 5, review_text: 'great' });
    const res = await request(app)
      .get('/api/reviews/export/json?platform=google')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.match(res.headers['content-disposition'], /attachment;.*\.json/);
    const body = JSON.parse(res.text);
    assert.ok(Array.isArray(body.reviews));
    assert.ok(body.reviews.length >= 1);
    assert.strictEqual(body.filters.platform, 'google');
    // Secret-like fields are never included; only columns explicitly listed
    assert.ok(!('password_hash' in body.reviews[0]));
    assert.ok(!('access_token' in body.reviews[0]));
    // Truncation metadata lets BI consumers know when to paginate
    assert.ok('total_matching' in body);
    assert.ok('truncated' in body);
    assert.strictEqual(body.truncated, false);
    assert.strictEqual(body.total_matching, body.count);
    assert.strictEqual(body.limit, 10000);
  });
});

describe('templates', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('template creation blocked on Free plan', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/templates').set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'Test', body: 'Test body' });
    assert.strictEqual(res.status, 403);
    assert.match(res.body.error, /starter plan/i);
  });

  test('CRUD a template', async () => {
    const u = await makeUserWithBusiness('Template Co', 'starter');
    const create = await request(app).post('/api/templates').set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'Thanks', body: 'We appreciate your feedback!' });
    assert.strictEqual(create.status, 201);
    const id = create.body.id;

    const list = await request(app).get('/api/templates').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.templates.length, 1);

    const update = await request(app).put(`/api/templates/${id}`).set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'Thanks!', body: 'Thanks so much.' });
    assert.strictEqual(update.status, 200);

    const del = await request(app).delete(`/api/templates/${id}`).set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);

    const empty = await request(app).get('/api/templates').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(empty.body.templates.length, 0);
  });

  test('title and body are required', async () => {
    const u = await makeUserWithBusiness('Template Validation Co', 'starter');
    const res = await request(app).post('/api/templates').set('Authorization', `Bearer ${u.token}`).send({ title: 'x' });
    assert.strictEqual(res.status, 400);
  });

  test('users cannot touch each others templates', async () => {
    const a = await makeUserWithBusiness('Template A Co', 'starter');
    const b = await makeUserWithBusiness('Template B Co', 'starter');
    const mine = await request(app).post('/api/templates').set('Authorization', `Bearer ${a.token}`)
      .send({ title: 'A', body: 'A body' });
    const id = mine.body.id;
    const poke = await request(app).put(`/api/templates/${id}`).set('Authorization', `Bearer ${b.token}`)
      .send({ title: 'hacked', body: 'body' });
    assert.strictEqual(poke.status, 404);
  });
});

describe('bulk-respond', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function makeReview(u, overrides = {}) {
    const r = await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Tester', rating: 5, review_text: 'Great!', ...overrides });
    return r.body.review.id;
  }

  test('responds to multiple unresponded reviews', async () => {
    const u = await makeUserWithBusiness();
    const id1 = await makeReview(u);
    const id2 = await makeReview(u);
    const res = await request(app).post('/api/reviews/bulk-respond').set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [id1, id2], response_text: 'Thank you for your feedback!' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.updated, 2);
    assert.strictEqual(res.body.skipped, 0);
    // Verify the responses were persisted
    const list = await request(app).get('/api/reviews?responded=yes').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.total, 2);
  });

  test('skips reviews that already have a response', async () => {
    const u = await makeUserWithBusiness();
    const id1 = await makeReview(u);
    const id2 = await makeReview(u);
    // Pre-respond to id1
    await request(app).post(`/api/reviews/${id1}/respond`).set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Already answered' });
    const res = await request(app).post('/api/reviews/bulk-respond').set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [id1, id2], response_text: 'Bulk reply' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.updated, 1);
    assert.strictEqual(res.body.skipped, 1);
  });

  test('returns 400 for empty array', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/reviews/bulk-respond').set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [], response_text: 'Hi' });
    assert.strictEqual(res.status, 400);
  });

  test('returns 400 for more than 50 IDs', async () => {
    const u = await makeUserWithBusiness();
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    const res = await request(app).post('/api/reviews/bulk-respond').set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: ids, response_text: 'Hi' });
    assert.strictEqual(res.status, 400);
  });

  test('returns 400 for missing response_text', async () => {
    const u = await makeUserWithBusiness();
    const id = await makeReview(u);
    const res = await request(app).post('/api/reviews/bulk-respond').set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [id], response_text: '   ' });
    assert.strictEqual(res.status, 400);
  });

  test('cannot bulk-respond to another user\'s reviews', async () => {
    const a = await makeUserWithBusiness();
    const b = await makeUserWithBusiness();
    const otherId = await makeReview(b);
    const res = await request(app).post('/api/reviews/bulk-respond').set('Authorization', `Bearer ${a.token}`)
      .send({ review_ids: [otherId], response_text: 'Stolen reply' });
    assert.strictEqual(res.status, 200);
    // updated=0 because the ID doesn't belong to user A's business
    assert.strictEqual(res.body.updated, 0);
  });
});
