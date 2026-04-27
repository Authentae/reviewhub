// Integration tests for /api/public/widget (embeddable review badge)

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('public widget', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function enableWidget(u) {
    const { run, get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    run('UPDATE businesses SET widget_enabled = 1 WHERE id = ?', [biz.id]);
    return biz.id;
  }

  // ── JSON endpoint ─────────────────────────────────────────────────────────

  test('returns 404 when widget is disabled', async () => {
    const u = await makeUserWithBusiness();
    const { get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    const res = await request(app).get(`/api/public/widget/${biz.id}`);
    assert.strictEqual(res.status, 404);
  });

  test('returns JSON data when widget is enabled', async () => {
    const u = await makeUserWithBusiness('Widget Bistro');
    const bizId = await enableWidget(u);
    const res = await request(app).get(`/api/public/widget/${bizId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.business_name, 'Widget Bistro');
    assert.strictEqual(res.body.total, 0);
    assert.ok(Array.isArray(res.body.recent_reviews));
  });

  test('JSON data reflects actual reviews', async () => {
    const u = await makeUserWithBusiness();
    const bizId = await enableWidget(u);
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Alice', rating: 5, review_text: 'Amazing!' });
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'yelp', reviewer_name: 'Bob', rating: 4, review_text: 'Good.' });
    const res = await request(app).get(`/api/public/widget/${bizId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 2);
    assert.ok(res.body.avg_rating >= 4 && res.body.avg_rating <= 5);
  });

  test('JSON data does not expose private fields', async () => {
    const u = await makeUserWithBusiness();
    const bizId = await enableWidget(u);
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Carol', rating: 5 });
    const res = await request(app).get(`/api/public/widget/${bizId}`);
    assert.ok(!('response_text' in (res.body.recent_reviews[0] || {})));
    assert.ok(!('note' in (res.body.recent_reviews[0] || {})));
    assert.ok(!('business_id' in (res.body.recent_reviews[0] || {})));
  });

  test('returns 400 for non-integer ID', async () => {
    const res = await request(app).get('/api/public/widget/abc');
    assert.strictEqual(res.status, 400);
  });

  // ── HTML badge endpoint ───────────────────────────────────────────────────

  test('badge returns HTML when widget is enabled', async () => {
    const u = await makeUserWithBusiness('Badge Co');
    const bizId = await enableWidget(u);
    const res = await request(app).get(`/api/public/widget/${bizId}/badge`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.ok(res.text.includes('Badge Co'));
    assert.ok(res.text.includes('Powered by ReviewHub'));
  });

  test('badge returns 404 when widget is disabled', async () => {
    const u = await makeUserWithBusiness();
    const { get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    const res = await request(app).get(`/api/public/widget/${biz.id}/badge`);
    assert.strictEqual(res.status, 404);
  });

  test('badge renders star rating when reviews exist', async () => {
    const u = await makeUserWithBusiness();
    const bizId = await enableWidget(u);
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Dave', rating: 5 });
    const res = await request(app).get(`/api/public/widget/${bizId}/badge`);
    assert.ok(res.text.includes('★'));
    assert.ok(res.text.includes('5.0'));
  });

  test('badge response is iframe-embeddable AND blocks script execution', async () => {
    // Locks down two coupled requirements:
    //   1. customers paste this on their own websites → frame-ancestors must
    //      allow any origin (without it, the iframe won't render at all)
    //   2. the badge HTML is server-rendered with zero JavaScript → CSP
    //      must explicitly forbid scripts so a future XSS regression in
    //      the template can't escalate to script execution.
    // A future CSP refactor that drops either of these silently would now
    // trip this test instead of shipping.
    const u = await makeUserWithBusiness();
    const bizId = await enableWidget(u);
    const res = await request(app).get(`/api/public/widget/${bizId}/badge`);
    const csp = res.headers['content-security-policy'] || '';
    assert.match(csp, /frame-ancestors \*/, 'badge must allow any-origin embed');
    assert.match(csp, /script-src 'none'/, 'badge must forbid script execution');
    // X-Frame-Options must be absent — its DENY would override frame-ancestors.
    assert.strictEqual(res.headers['x-frame-options'], undefined);
  });

  // ── Settings toggle ───────────────────────────────────────────────────────

  test('widget_enabled can be toggled via PUT /api/businesses/:id', async () => {
    const u = await makeUserWithBusiness();
    const { get } = require('../src/db/schema');
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    const res = await request(app)
      .put(`/api/businesses/${biz.id}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ widget_enabled: 1 });
    assert.strictEqual(res.status, 200);
  });
});
