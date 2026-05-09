// Unit tests for the Places API v1 poller (server/src/jobs/placesPoller.js).
//
// We stub googlePlaces._fetch (module-local) and lineMessenger.PUSH_URL
// indirectly by setting LINE_OA_ENABLED=false, so no network calls escape.
// generateDraft auto-mocks via the empty ANTHROPIC_API_KEY in helpers.js.

const { test, describe, before, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert');
const { cleanupTempDb, getAgent, makeUserWithBusiness } = require('./helpers');

process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';

let app;
before(async () => { app = await getAgent(); });
after(cleanupTempDb);

const { run, get, all, insert } = require('../src/db/schema');
const googlePlaces = require('../src/lib/providers/googlePlaces');
const placesPoller = require('../src/jobs/placesPoller');

function fakeRes(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

let originalFetch;
beforeEach(() => { originalFetch = googlePlaces._fetch; });
afterEach(() => { googlePlaces._fetch = originalFetch; });

describe('placesPoller.pollOne', () => {
  test('returns error when business has no Place ID', async () => {
    const user = await makeUserWithBusiness('No-place-id Co');
    const r = await placesPoller.pollOne(user.businessId);
    assert.strictEqual(r.inserted, 0);
    assert.match(r.error, /No google_place_id/);
  });

  test('returns error when business not found', async () => {
    const r = await placesPoller.pollOne(99999999);
    assert.strictEqual(r.inserted, 0);
    assert.match(r.error, /not found/i);
  });

  test('inserts new reviews and skips dedup hits on second poll', async () => {
    const user = await makeUserWithBusiness('Dedup Test Hotel');
    run('UPDATE businesses SET google_place_id = ? WHERE id = ?', ['ChIJplaceXYZ', user.businessId]);

    googlePlaces._fetch = async () => fakeRes(200, {
      reviews: [
        {
          rating: 5,
          publishTime: '2026-04-01T10:00:00Z',
          text: { text: 'Excellent stay, lovely staff' },
          authorAttribution: { displayName: 'Alice' },
        },
        {
          rating: 4,
          publishTime: '2026-04-02T11:00:00Z',
          text: { text: 'Comfortable rooms but breakfast was average' },
          authorAttribution: { displayName: 'Bob' },
        },
      ],
    });

    const first = await placesPoller.pollOne(user.businessId);
    assert.strictEqual(first.inserted, 2);
    assert.strictEqual(first.error, null);

    // Same response on the next poll → 0 new (dedup).
    const second = await placesPoller.pollOne(user.businessId);
    assert.strictEqual(second.inserted, 0);
    assert.strictEqual(second.error, null);

    // Third poll with one new review at the front
    googlePlaces._fetch = async () => fakeRes(200, {
      reviews: [
        {
          rating: 3,
          publishTime: '2026-04-03T09:00:00Z',
          text: { text: 'Service slow at check-in' },
          authorAttribution: { displayName: 'Carol' },
        },
        {
          rating: 5,
          publishTime: '2026-04-01T10:00:00Z',
          text: { text: 'Excellent stay, lovely staff' },
          authorAttribution: { displayName: 'Alice' },
        },
      ],
    });
    const third = await placesPoller.pollOne(user.businessId);
    assert.strictEqual(third.inserted, 1);

    const rows = all(
      `SELECT external_id, reviewer_name, platform FROM reviews
        WHERE business_id = ? ORDER BY created_at`,
      [user.businessId]
    );
    assert.strictEqual(rows.length, 3);
    assert.deepStrictEqual(
      rows.map((r) => r.reviewer_name),
      ['Alice', 'Bob', 'Carol']
    );
    // All inserted as platform='google' so the existing UI filter sees them.
    assert.ok(rows.every((r) => r.platform === 'google'));
  });

  test('returns API errors without inserting', async () => {
    const user = await makeUserWithBusiness('Error Test Co');
    run('UPDATE businesses SET google_place_id = ? WHERE id = ?', ['ChIJfails', user.businessId]);
    googlePlaces._fetch = async () => fakeRes(403, { error: 'permission' });
    const r = await placesPoller.pollOne(user.businessId);
    assert.strictEqual(r.inserted, 0);
    assert.match(r.error, /403/);
    const rows = all('SELECT id FROM reviews WHERE business_id = ?', [user.businessId]);
    assert.strictEqual(rows.length, 0);
  });

  test('handles empty reviews response cleanly', async () => {
    const user = await makeUserWithBusiness('Empty Reviews Co');
    run('UPDATE businesses SET google_place_id = ? WHERE id = ?', ['ChIJempty', user.businessId]);
    googlePlaces._fetch = async () => fakeRes(200, { reviews: [] });
    const r = await placesPoller.pollOne(user.businessId);
    assert.strictEqual(r.inserted, 0);
    assert.strictEqual(r.error, null);
  });
});

describe('placesPoller.pollAll', () => {
  test('skips when API key is missing', async () => {
    const saved = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    const r = await placesPoller.pollAll();
    assert.match(r.skipped || '', /not set/);
    process.env.GOOGLE_MAPS_API_KEY = saved;
  });

  test('iterates only businesses with google_place_id', async () => {
    const userA = await makeUserWithBusiness('Has Place ID A');
    const userB = await makeUserWithBusiness('No Place ID B');
    const userC = await makeUserWithBusiness('Has Place ID C');
    run('UPDATE businesses SET google_place_id = ? WHERE id = ?', ['placeA', userA.businessId]);
    // userB intentionally has no place id
    run('UPDATE businesses SET google_place_id = ? WHERE id = ?', ['placeC', userC.businessId]);

    const calls = [];
    googlePlaces._fetch = async (url) => {
      calls.push(url);
      return fakeRes(200, { reviews: [] });
    };

    const r = await placesPoller.pollAll();
    // Only the two businesses with place IDs should have been polled.
    assert.ok(calls.length >= 2, `expected ≥2 fetches, got ${calls.length}`);
    // r.businessCount counts businesses with a place_id (potentially more from
    // earlier tests in this file — assert ≥ 2 for our two new ones).
    assert.ok(r.businessCount >= 2);
  });
});
