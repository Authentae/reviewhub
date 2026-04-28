// /api/public/platforms — public platform registry endpoint.
//
// External tools (extension, Zapier, docs site) read this to discover
// canonical platform IDs without scraping the client bundle. Lock down
// the response shape so we don't break those consumers silently.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request } = require('./helpers');

describe('public platforms catalogue', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /api/public/platforms returns the registry without auth', async () => {
    const res = await request(app).get('/api/public/platforms');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.global));
    assert.ok(Array.isArray(res.body.local));
    assert.ok(Array.isArray(res.body.internal));
    assert.ok(res.body.meta && typeof res.body.meta === 'object');
  });

  test('global list includes the foundational platforms', async () => {
    const res = await request(app).get('/api/public/platforms');
    for (const p of ['google', 'yelp', 'facebook', 'tripadvisor', 'trustpilot']) {
      assert.ok(res.body.global.includes(p), `expected global to include ${p}`);
    }
  });

  test('local list includes locale-specific platforms across markets', async () => {
    const res = await request(app).get('/api/public/platforms');
    for (const p of ['wongnai', 'tabelog', 'naver', 'dianping', 'thefork', 'reclameaqui']) {
      assert.ok(res.body.local.includes(p), `expected local to include ${p}`);
    }
  });

  test('meta entries carry label + locale for every platform', async () => {
    const res = await request(app).get('/api/public/platforms');
    const allIds = [...res.body.global, ...res.body.local, ...res.body.internal];
    for (const id of allIds) {
      const m = res.body.meta[id];
      assert.ok(m, `meta missing for ${id}`);
      assert.equal(typeof m.label, 'string');
      assert.equal(typeof m.locale, 'string');
    }
  });

  test('response is cacheable (1h public)', async () => {
    const res = await request(app).get('/api/public/platforms');
    assert.match(res.headers['cache-control'] || '', /max-age=3600/);
    assert.match(res.headers['cache-control'] || '', /public/);
  });
});
