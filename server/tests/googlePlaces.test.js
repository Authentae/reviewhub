// Unit tests for the Places API (NEW) read-only adapter.
//
// We stub `googlePlaces._fetch` (module-local, NOT global.fetch) so tests
// never hit the network and don't fight other tests' fetch mocks.

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';

const googlePlaces = require('../src/lib/providers/googlePlaces');

// Helper: build a fake fetch Response.
function fakeRes(status, jsonBody) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => jsonBody,
    text: async () => JSON.stringify(jsonBody),
  };
}

let originalFetch;
beforeEach(() => { originalFetch = googlePlaces._fetch; });
afterEach(() => { googlePlaces._fetch = originalFetch; });

describe('googlePlaces.isConfigured', () => {
  test('true when env var present', () => {
    process.env.GOOGLE_MAPS_API_KEY = 'k';
    assert.strictEqual(googlePlaces.isConfigured(), true);
  });
  test('false when env var missing', () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    assert.strictEqual(googlePlaces.isConfigured(), false);
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key'; // restore
  });
});

describe('googlePlaces.lookupByName', () => {
  test('returns top match + suggestions', async () => {
    googlePlaces._fetch = async (url, opts) => {
      assert.match(url, /searchText/);
      assert.strictEqual(opts.method, 'POST');
      assert.strictEqual(opts.headers['X-Goog-Api-Key'], 'test-maps-key');
      assert.match(opts.headers['X-Goog-FieldMask'], /places\.id/);
      const body = JSON.parse(opts.body);
      assert.strictEqual(body.textQuery, 'Mirth Sathorn Bangkok');
      return fakeRes(200, {
        places: [
          { id: 'P1', displayName: { text: 'Mirth Sathorn' }, formattedAddress: 'Sathorn Rd' },
          { id: 'P2', displayName: { text: 'Mirth Cafe' }, formattedAddress: 'Silom Rd' },
          { id: 'P3', displayName: { text: 'Mirth Spa' }, formattedAddress: 'Asoke' },
          { id: 'P4', displayName: { text: 'Should be ignored' }, formattedAddress: 'X' },
        ],
      });
    };
    const out = await googlePlaces.lookupByName('Mirth Sathorn');
    assert.strictEqual(out.placeId, 'P1');
    assert.strictEqual(out.displayName, 'Mirth Sathorn');
    assert.strictEqual(out.suggestions.length, 3);
    assert.deepStrictEqual(
      out.suggestions.map((s) => s.placeId),
      ['P1', 'P2', 'P3']
    );
  });

  test('returns null when no places found', async () => {
    googlePlaces._fetch = async () => fakeRes(200, { places: [] });
    const out = await googlePlaces.lookupByName('Nonexistent Hotel');
    assert.strictEqual(out, null);
  });

  test('returns null when response has no places key', async () => {
    googlePlaces._fetch = async () => fakeRes(200, {});
    const out = await googlePlaces.lookupByName('Whatever');
    assert.strictEqual(out, null);
  });

  test('throws on non-2xx with status code preserved', async () => {
    googlePlaces._fetch = async () => fakeRes(403, { error: 'permission denied' });
    await assert.rejects(
      () => googlePlaces.lookupByName('X'),
      (err) => err.status === 403 && /403/.test(err.message)
    );
  });

  test('throws when API key missing', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    await assert.rejects(() => googlePlaces.lookupByName('X'), /not configured/);
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
  });

  test('rejects empty businessName', async () => {
    await assert.rejects(() => googlePlaces.lookupByName(''), /required/);
    await assert.rejects(() => googlePlaces.lookupByName('   '), /required/);
  });

  test('honors custom hint', async () => {
    let captured;
    googlePlaces._fetch = async (_url, opts) => {
      captured = JSON.parse(opts.body).textQuery;
      return fakeRes(200, { places: [] });
    };
    await googlePlaces.lookupByName('Bistro', 'Chiang Mai');
    assert.strictEqual(captured, 'Bistro Chiang Mai');
  });

  test('omits hint when empty string passed', async () => {
    let captured;
    googlePlaces._fetch = async (_url, opts) => {
      captured = JSON.parse(opts.body).textQuery;
      return fakeRes(200, { places: [] });
    };
    await googlePlaces.lookupByName('Bistro', '');
    assert.strictEqual(captured, 'Bistro');
  });
});

describe('googlePlaces.fetchReviews', () => {
  test('maps Places review shape to internal shape', async () => {
    googlePlaces._fetch = async (url, opts) => {
      assert.match(url, /\/places\/abc123/);
      assert.strictEqual(opts.method, 'GET');
      assert.strictEqual(opts.headers['X-Goog-Api-Key'], 'test-maps-key');
      return fakeRes(200, {
        reviews: [
          {
            name: 'places/abc123/reviews/r1',
            rating: 5,
            text: { text: 'Lovely stay, great location.', languageCode: 'en' },
            publishTime: '2026-04-01T10:00:00Z',
            authorAttribution: { displayName: 'Alice' },
          },
          {
            name: 'places/abc123/reviews/r2',
            rating: 3,
            text: { text: 'พนักงานน่ารักครับ' },
            publishTime: '2026-04-02T11:30:00Z',
            authorAttribution: { displayName: 'Boon' },
          },
        ],
      });
    };
    const out = await googlePlaces.fetchReviews('abc123');
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].reviewer_name, 'Alice');
    assert.strictEqual(out[0].rating, 5);
    assert.strictEqual(out[0].review_text, 'Lovely stay, great location.');
    assert.strictEqual(out[0].created_at, '2026-04-01T10:00:00Z');
    assert.match(out[0].external_id, /^[a-f0-9]{16}$/);
    assert.strictEqual(out[1].reviewer_name, 'Boon');
    assert.notStrictEqual(out[0].external_id, out[1].external_id);
  });

  test('returns empty array when reviews missing', async () => {
    googlePlaces._fetch = async () => fakeRes(200, { displayName: { text: 'X' } });
    const out = await googlePlaces.fetchReviews('p');
    assert.deepStrictEqual(out, []);
  });

  test('handles missing rating with default 3', async () => {
    googlePlaces._fetch = async () => fakeRes(200, {
      reviews: [{
        publishTime: '2026-01-01T00:00:00Z',
        text: { text: 'meh' },
        authorAttribution: { displayName: 'X' },
      }],
    });
    const out = await googlePlaces.fetchReviews('p');
    assert.strictEqual(out[0].rating, 3);
  });

  test('falls back to originalText when text missing', async () => {
    googlePlaces._fetch = async () => fakeRes(200, {
      reviews: [{
        publishTime: '2026-01-01T00:00:00Z',
        rating: 4,
        originalText: { text: 'original-only' },
        authorAttribution: { displayName: 'X' },
      }],
    });
    const out = await googlePlaces.fetchReviews('p');
    assert.strictEqual(out[0].review_text, 'original-only');
  });

  test('throws on non-2xx', async () => {
    googlePlaces._fetch = async () => fakeRes(404, { error: 'not found' });
    await assert.rejects(
      () => googlePlaces.fetchReviews('bad'),
      (err) => err.status === 404
    );
  });

  test('rejects empty placeId', async () => {
    await assert.rejects(() => googlePlaces.fetchReviews(''), /required/);
  });
});

describe('googlePlaces._dedupHash', () => {
  test('stable across calls with same inputs', () => {
    const h1 = googlePlaces._dedupHash('Alice', '2026-04-01T10:00:00Z', 'Lovely stay');
    const h2 = googlePlaces._dedupHash('Alice', '2026-04-01T10:00:00Z', 'Lovely stay');
    assert.strictEqual(h1, h2);
    assert.match(h1, /^[a-f0-9]{16}$/);
  });

  test('changes when any input changes', () => {
    const base = googlePlaces._dedupHash('Alice', '2026-04-01T10:00:00Z', 'Lovely stay');
    assert.notStrictEqual(
      base,
      googlePlaces._dedupHash('Bob', '2026-04-01T10:00:00Z', 'Lovely stay')
    );
    assert.notStrictEqual(
      base,
      googlePlaces._dedupHash('Alice', '2026-04-02T10:00:00Z', 'Lovely stay')
    );
    assert.notStrictEqual(
      base,
      googlePlaces._dedupHash('Alice', '2026-04-01T10:00:00Z', 'Different text')
    );
  });

  test('only first 50 chars of text affect the hash', () => {
    const sameFirst50 = 'a'.repeat(50);
    const h1 = googlePlaces._dedupHash('A', 't', sameFirst50 + 'tail-a');
    const h2 = googlePlaces._dedupHash('A', 't', sameFirst50 + 'tail-b');
    assert.strictEqual(h1, h2, 'text after first 50 chars must not affect hash');
    // and a real change INSIDE the first 50 chars DOES change the hash
    const h3 = googlePlaces._dedupHash('A', 't', 'b'.repeat(50));
    assert.notStrictEqual(h1, h3);
  });

  test('handles missing/empty text gracefully', () => {
    assert.match(googlePlaces._dedupHash('A', 't', ''), /^[a-f0-9]{16}$/);
    assert.match(googlePlaces._dedupHash('A', 't', null), /^[a-f0-9]{16}$/);
    assert.match(googlePlaces._dedupHash('A', 't', undefined), /^[a-f0-9]{16}$/);
  });
});
