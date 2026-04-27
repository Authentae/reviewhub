// Regression test for the unbounded by_route map.
//
// Before the fix, every unmatched URL (404 scans like /wp-admin,
// /.env, /api/users/12345 brute force) added a fresh key to
// COUNT.by_route — slow memory leak that grew with attack noise.
//
// This test simulates a flood of distinct unmatched paths and asserts
// the by_route map stays bounded — all unmatched paths must collapse
// into the :unmatched / :unmatched-api bucket.

const test = require('node:test');
const assert = require('node:assert');

require('./helpers'); // sets NODE_ENV=test, neutralizes SMTP, etc.

// Reset the module cache so a fresh metrics module starts with empty counters.
delete require.cache[require.resolve('../src/lib/metrics')];
const metricsMod = require('../src/lib/metrics');
const { snapshot, middleware } = metricsMod;

function fakeRun(path, statusCode = 404) {
  // The metrics middleware listens on res.on('finish'). We synthesise a
  // request that flows the same way — the EventEmitter path triggers record().
  const { EventEmitter } = require('node:events');
  const req = { method: 'GET', path, baseUrl: '', route: null };
  const res = new EventEmitter();
  res.statusCode = statusCode;
  middleware()(req, res, () => {});
  res.emit('finish');
}

test('by_route stays bounded under a flood of unmatched paths', () => {
  // Simulate 200 distinct random scan URLs.
  for (let i = 0; i < 200; i++) {
    fakeRun(`/api/users/${i}`);
    fakeRun(`/wp-admin/${i}/setup.php`);
  }
  const snap = snapshot();
  // top_routes is the top 10 — but the universe of buckets must be tiny.
  // We accept up to 4 keys (buffer for matched routes from setup, plus the
  // :unmatched-api and :unmatched buckets themselves).
  const keys = Object.keys(snap.requests.top_routes);
  assert.ok(keys.length <= 4, `expected ≤4 buckets, got ${keys.length}: ${keys.join(', ')}`);
  // All 400 unmatched runs landed in :unmatched-api OR :unmatched buckets.
  const unmatchedApiCount = snap.requests.top_routes[':unmatched-api'] || 0;
  const unmatchedCount = snap.requests.top_routes[':unmatched'] || 0;
  assert.ok(unmatchedApiCount + unmatchedCount >= 400,
    `expected ≥400 in :unmatched buckets, got api=${unmatchedApiCount} other=${unmatchedCount}`);
});
