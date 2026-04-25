// Unit tests for the templateVars utility, plus integration tests for
// variable substitution in POST /reviews (auto-rules), POST /:id/respond,
// and POST /bulk-respond.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { substituteVars, hasVars } = require('../src/lib/templateVars');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('substituteVars unit', () => {
  const review = { reviewer_name: 'Alice', rating: 5, platform: 'google' };
  const biz    = { business_name: 'Corner Bistro' };

  test('substitutes all four variables', () => {
    const result = substituteVars(
      'Hi {reviewer_name}, thanks for your {rating}-star {platform} review of {business_name}!',
      review, biz
    );
    assert.strictEqual(result, 'Hi Alice, thanks for your 5-star Google review of Corner Bistro!');
  });

  test('capitalises platform name', () => {
    assert.strictEqual(substituteVars('{platform}', { platform: 'yelp' }, {}), 'Yelp');
    assert.strictEqual(substituteVars('{platform}', { platform: 'facebook' }, {}), 'Facebook');
    assert.strictEqual(substituteVars('{platform}', { platform: 'google' }, {}), 'Google');
  });

  test('repeats substitution for multiple occurrences', () => {
    const result = substituteVars('{reviewer_name} {reviewer_name}', review, biz);
    assert.strictEqual(result, 'Alice Alice');
  });

  test('leaves unknown placeholders untouched', () => {
    assert.strictEqual(substituteVars('Hello {unknown}', review, biz), 'Hello {unknown}');
  });

  test('handles null/empty text gracefully', () => {
    assert.strictEqual(substituteVars(null, review, biz), null);
    assert.strictEqual(substituteVars('', review, biz), '');
  });

  test('handles missing review fields gracefully', () => {
    const result = substituteVars('{reviewer_name} {rating}', {}, biz);
    assert.strictEqual(result, ' ');
  });
});

describe('hasVars unit', () => {
  test('detects reviewer_name', () => assert.ok(hasVars('Hi {reviewer_name}')));
  test('detects rating',        () => assert.ok(hasVars('Rating: {rating}')));
  test('detects platform',      () => assert.ok(hasVars('{platform} review')));
  test('detects business_name', () => assert.ok(hasVars('{business_name}')));
  test('returns false for plain text', () => assert.ok(!hasVars('Thanks for your review!')));
  test('returns false for unknown placeholder', () => assert.ok(!hasVars('{unknown}')));
});

// ── Integration tests ─────────────────────────────────────────────────────────

describe('template vars — POST /:id/respond', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('substitutes variables in manual response', async () => {
    const u = await makeUserWithBusiness('Bistro');
    const rr = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Bob', rating: 4 });
    const rev = rr.body.review;

    const res = await request(app).post(`/api/reviews/${rev.id}/respond`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Thanks {reviewer_name} for your {rating}-star review on {platform}!' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.response_text, 'Thanks Bob for your 4-star review on Google!');
  });

  test('saves substituted text — not the template — to the DB', async () => {
    const u = await makeUserWithBusiness();
    const rr = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'yelp', reviewer_name: 'Carol', rating: 5 });
    const rev = rr.body.review;

    await request(app).post(`/api/reviews/${rev.id}/respond`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Dear {reviewer_name}, love from {business_name}!' });

    const { get } = require('../src/db/schema');
    const stored = get('SELECT response_text FROM reviews WHERE id = ?', [rev.id]);
    assert.ok(stored.response_text.includes('Carol'));
    assert.ok(!stored.response_text.includes('{reviewer_name}'));
  });
});

describe('template vars — POST /bulk-respond', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('substitutes per-review in bulk with variables', async () => {
    const u = await makeUserWithBusiness('BulkCo');
    const r1 = (await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Dave', rating: 5 })).body.review;
    const r2 = (await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'yelp', reviewer_name: 'Eve', rating: 4 })).body.review;

    const res = await request(app).post('/api/reviews/bulk-respond')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r1.id, r2.id], response_text: 'Hi {reviewer_name} on {platform}!' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.updated, 2);

    const { get } = require('../src/db/schema');
    const stored1 = get('SELECT response_text FROM reviews WHERE id = ?', [r1.id]);
    const stored2 = get('SELECT response_text FROM reviews WHERE id = ?', [r2.id]);
    assert.strictEqual(stored1.response_text, 'Hi Dave on Google!');
    assert.strictEqual(stored2.response_text, 'Hi Eve on Yelp!');
  });

  test('no-vars bulk uses single batch update', async () => {
    const u = await makeUserWithBusiness();
    const r1 = (await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Frank', rating: 5 })).body.review;
    const r2 = (await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'yelp', reviewer_name: 'Grace', rating: 4 })).body.review;

    const res = await request(app).post('/api/reviews/bulk-respond')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ review_ids: [r1.id, r2.id], response_text: 'Thank you for your review!' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.updated, 2);
    const { get } = require('../src/db/schema');
    assert.strictEqual(get('SELECT response_text FROM reviews WHERE id = ?', [r1.id]).response_text, 'Thank you for your review!');
    assert.strictEqual(get('SELECT response_text FROM reviews WHERE id = ?', [r2.id]).response_text, 'Thank you for your review!');
  });
});

describe('template vars — auto-rules', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('auto-rule substitutes reviewer_name and platform', async () => {
    const u = await makeUserWithBusiness('AutoBiz');
    await request(app).post('/api/auto-rules')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'VarRule', response_text: 'Thanks {reviewer_name} for your {platform} review!' });

    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Hank', rating: 5 });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.autoResponded);
    assert.strictEqual(res.body.review.response_text, 'Thanks Hank for your Google review!');
  });

  test('auto-rule substitutes business_name and rating', async () => {
    const u = await makeUserWithBusiness('FancyCafe');
    await request(app).post('/api/auto-rules')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: 'BizRule', response_text: '{business_name} loves {rating}-star reviews!' });

    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'yelp', reviewer_name: 'Iris', rating: 5 });

    assert.ok(res.body.autoResponded);
    assert.strictEqual(res.body.review.response_text, 'FancyCafe loves 5-star reviews!');
  });
});
