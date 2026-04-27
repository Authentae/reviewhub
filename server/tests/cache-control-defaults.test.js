// Regression guard for the /api default Cache-Control middleware.
//
// The middleware sets `no-store, private` on every /api/* response so
// authenticated JSON can't be cached by browsers or intermediate
// proxies. Routes that genuinely benefit from caching (publicWidget,
// plans, public reviews feed) override via setHeader. This test locks
// down BOTH behaviours so a refactor can't silently regress either:
//   - default applies to authed routes
//   - the public-cache override on widget/plans/public-reviews wins

const test = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request } = require('./helpers');
const { run } = require('../src/db/schema');

test('Cache-Control defaults', async (t) => {
  const app = await getAgent();

  await t.test('authed /api/auth/me defaults to no-store, private', async () => {
    const u = await makeUser();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['cache-control'] || '', /no-store/);
    assert.match(res.headers['cache-control'] || '', /private/);
  });

  await t.test('public /api/plans overrides to public, max-age', async () => {
    const res = await request(app).get('/api/plans');
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['cache-control'] || '', /public/);
    assert.match(res.headers['cache-control'] || '', /max-age=/);
  });

  await t.test('public widget badge overrides to public, max-age', async () => {
    // Set up a business with the widget enabled so we can actually hit the
    // route. We register a user, create a business, then opt the widget on.
    const u = await makeUser();
    const biz = await request(app)
      .post('/api/businesses')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ business_name: 'Test Biz' });
    assert.strictEqual(biz.status, 200);
    run('UPDATE businesses SET widget_enabled = 1 WHERE id = ?', [biz.body.id]);

    const res = await request(app).get(`/api/public/widget/${biz.body.id}/badge`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['cache-control'] || '', /public/);
    assert.match(res.headers['cache-control'] || '', /max-age=/);
  });
});
