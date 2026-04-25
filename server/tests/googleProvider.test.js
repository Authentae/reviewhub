// Unit tests for the Google Business Profile provider.
//
// We mock global.fetch and the lib/providers/googleOAuth refreshAccessToken
// call so the tests never touch the network. The focus is the decision tree:
//   - token fresh → no refresh, call APIs with current token
//   - token expired + refresh_token present → refresh, persist, retry
//   - token expired + refresh revoked → clear DB credentials, throw clear error
//   - external_account_id already resolved → skip discovery calls
//   - discovery path → list accounts → list locations → list reviews

const { test, describe, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const { cleanupTempDb, getAgent } = require('./helpers');

// Boot the app so the DB is initialised and we can exercise the persistence
// side effects (UPDATE platform_connections) in the refresh path.
let app;
before(async () => { app = await getAgent(); });
after(cleanupTempDb);

// Env required for GoogleProvider.isConfigured and googleOAuth. Values don't
// have to be real — we intercept the HTTP calls.
process.env.GOOGLE_CLIENT_ID         = process.env.GOOGLE_CLIENT_ID         || 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET     = process.env.GOOGLE_CLIENT_SECRET     || 'test-client-secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI= process.env.GOOGLE_OAUTH_REDIRECT_URI|| 'http://test/cb';

const { GoogleProvider } = require('../src/lib/providers/google');
const googleOAuth = require('../src/lib/providers/googleOAuth');
const { get, insert, run } = require('../src/db/schema');

// Util: build a platform_connections row backing a GoogleProvider. We need
// a real row because the provider writes to the DB on refresh.
function seedConnection({ accessToken, refreshToken, expiresAt, externalAccountId = 'user@gmail.com' }) {
  // Minimal user + business — tests before() initialises schema via getAgent.
  const userId = insert(
    "INSERT INTO users (email, password_hash) VALUES (?, 'x')",
    [`gp-${Math.random().toString(36).slice(2)}@t.co`]
  );
  const bizId = insert(
    'INSERT INTO businesses (user_id, business_name) VALUES (?, ?)',
    [userId, 'GP Test Co']
  );
  const connId = insert(
    `INSERT INTO platform_connections
       (business_id, provider, external_account_id, access_token, refresh_token, token_expires_at)
     VALUES (?, 'google', ?, ?, ?, ?)`,
    [bizId, externalAccountId, accessToken, refreshToken, expiresAt]
  );
  return get('SELECT * FROM platform_connections WHERE id = ?', [connId]);
}

// Swap global.fetch for a stub the test configures per-call. Each entry is
// { match: url-predicate, response: { status, body } }.
function installFetchStub(responses) {
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    for (const r of responses) {
      if (r.match(url, opts)) {
        return {
          ok: r.status >= 200 && r.status < 300,
          status: r.status,
          headers: { get: () => null },
          text: async () => JSON.stringify(r.body),
          json: async () => r.body,
        };
      }
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  return calls;
}

describe('GoogleProvider', () => {
  let origFetch;
  beforeEach(() => { origFetch = global.fetch; });
  after(() => { global.fetch = origFetch; });

  test('isConfigured flips with deployment env vars', () => {
    const gp = new GoogleProvider({});
    assert.strictEqual(gp.isConfigured, true);

    const saved = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    const gp2 = new GoogleProvider({});
    assert.strictEqual(gp2.isConfigured, false);
    process.env.GOOGLE_CLIENT_ID = saved;
  });

  test('fresh access_token → no refresh, discovery + reviews fetched with it', async () => {
    const futureIso = new Date(Date.now() + 10 * 60_000).toISOString();
    const conn = seedConnection({
      accessToken: 'FRESH_TOKEN',
      refreshToken: 'REFRESH_TOKEN',
      expiresAt: futureIso,
      externalAccountId: 'user@gmail.com', // triggers discovery
    });

    const calls = installFetchStub([
      {
        match: (u) => u.includes('mybusinessaccountmanagement.googleapis.com/v1/accounts') && !u.includes('/locations'),
        status: 200,
        body: { accounts: [{ name: 'accounts/111' }] },
      },
      {
        match: (u) => u.includes('mybusinessbusinessinformation.googleapis.com') && u.includes('/locations'),
        status: 200,
        body: { locations: [{ name: 'locations/222' }] },
      },
      {
        match: (u) => u.includes('mybusiness.googleapis.com/v4') && u.includes('/reviews'),
        status: 200,
        body: {
          reviews: [
            {
              reviewId: 'rev1',
              reviewer: { displayName: 'Alice' },
              starRating: 'FIVE',
              comment: 'Excellent',
              createTime: '2026-04-20T00:00:00Z',
            },
            {
              reviewId: 'rev2',
              reviewer: { displayName: 'Bob' },
              starRating: 'TWO',
              comment: 'Meh',
              createTime: '2026-04-18T00:00:00Z',
            },
          ],
        },
      },
    ]);

    const gp = new GoogleProvider(conn);
    const reviews = await gp.fetchReviews({ since: null });

    // All three endpoints hit, Authorization header threaded
    assert.strictEqual(calls.length, 3);
    for (const c of calls) {
      assert.strictEqual(c.opts.headers.Authorization, 'Bearer FRESH_TOKEN');
    }
    // Mapping: star → int, display name, etc.
    assert.strictEqual(reviews.length, 2);
    assert.strictEqual(reviews[0].rating, 5);
    assert.strictEqual(reviews[0].reviewer_name, 'Alice');
    assert.strictEqual(reviews[1].rating, 2);
    // external_account_id on the DB row was updated to the resolved location path
    const refreshed = get('SELECT external_account_id FROM platform_connections WHERE id = ?', [conn.id]);
    assert.strictEqual(refreshed.external_account_id, 'accounts/111/locations/222');
  });

  test('expired access_token → refresh is called + token persisted before API calls', async () => {
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const conn = seedConnection({
      accessToken: 'OLD_TOKEN',
      refreshToken: 'REFRESH_TOKEN',
      expiresAt: pastIso,
      externalAccountId: 'accounts/999/locations/888', // already resolved — skip discovery
    });

    // Stub the refresh helper
    const origRefresh = googleOAuth.refreshAccessToken;
    let refreshCalledWith = null;
    googleOAuth.refreshAccessToken = async (rt) => {
      refreshCalledWith = rt;
      return {
        access_token: 'NEW_TOKEN',
        expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      };
    };

    installFetchStub([
      {
        match: (u) => u.includes('/reviews'),
        status: 200,
        body: { reviews: [] },
      },
    ]);

    const gp = new GoogleProvider(conn);
    await gp.fetchReviews({});
    assert.strictEqual(refreshCalledWith, 'REFRESH_TOKEN');

    // DB row updated to carry the new token
    const updated = get('SELECT access_token FROM platform_connections WHERE id = ?', [conn.id]);
    assert.strictEqual(updated.access_token, 'NEW_TOKEN');

    googleOAuth.refreshAccessToken = origRefresh;
  });

  test('revoked refresh_token → clear DB credentials + throw re-auth error', async () => {
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const conn = seedConnection({
      accessToken: 'OLD_TOKEN',
      refreshToken: 'REVOKED_RT',
      expiresAt: pastIso,
      externalAccountId: 'accounts/999/locations/888',
    });

    const origRefresh = googleOAuth.refreshAccessToken;
    googleOAuth.refreshAccessToken = async () => {
      const err = new Error('Google token refresh failed (400): invalid_grant');
      err.revoked = true;
      throw err;
    };

    installFetchStub([]); // nothing should be called

    const gp = new GoogleProvider(conn);
    await assert.rejects(
      () => gp.fetchReviews({}),
      /reconnect/i,
      'should tell the user to reconnect'
    );
    const cleared = get('SELECT access_token, refresh_token FROM platform_connections WHERE id = ?', [conn.id]);
    assert.strictEqual(cleared.access_token, null);
    assert.strictEqual(cleared.refresh_token, null);

    googleOAuth.refreshAccessToken = origRefresh;
  });

  test('resolved external_account_id → discovery endpoints are skipped', async () => {
    const futureIso = new Date(Date.now() + 10 * 60_000).toISOString();
    const conn = seedConnection({
      accessToken: 'FRESH_TOKEN',
      refreshToken: 'RT',
      expiresAt: futureIso,
      externalAccountId: 'accounts/42/locations/43',
    });

    const calls = installFetchStub([
      { match: (u) => u.includes('/reviews'), status: 200, body: { reviews: [] } },
    ]);

    const gp = new GoogleProvider(conn);
    await gp.fetchReviews({});
    assert.strictEqual(calls.length, 1, 'only the reviews call fires');
    assert.ok(calls[0].url.includes('accounts/42/locations/43/reviews'));
  });

  test('since filter trims older reviews client-side', async () => {
    const futureIso = new Date(Date.now() + 10 * 60_000).toISOString();
    const conn = seedConnection({
      accessToken: 'T',
      refreshToken: 'RT',
      expiresAt: futureIso,
      externalAccountId: 'accounts/1/locations/1',
    });

    installFetchStub([
      {
        match: (u) => u.includes('/reviews'),
        status: 200,
        body: {
          reviews: [
            { reviewId: 'new',  reviewer: { displayName: 'N' }, starRating: 'FIVE', comment: 'recent', createTime: '2026-04-22T12:00:00Z' },
            { reviewId: 'old',  reviewer: { displayName: 'O' }, starRating: 'FIVE', comment: 'ancient', createTime: '2020-01-01T00:00:00Z' },
          ],
        },
      },
    ]);

    const gp = new GoogleProvider(conn);
    const reviews = await gp.fetchReviews({ since: '2026-01-01T00:00:00Z' });
    assert.strictEqual(reviews.length, 1);
    assert.strictEqual(reviews[0].external_id, 'new');
  });

  test('non-2xx API response → informative error with status', async () => {
    const futureIso = new Date(Date.now() + 10 * 60_000).toISOString();
    const conn = seedConnection({
      accessToken: 'T',
      refreshToken: 'RT',
      expiresAt: futureIso,
      externalAccountId: 'accounts/1/locations/1',
    });

    installFetchStub([
      { match: (u) => u.includes('/reviews'), status: 403, body: { error: 'forbidden' } },
    ]);

    const gp = new GoogleProvider(conn);
    await assert.rejects(() => gp.fetchReviews({}), /Google API 403/);
  });
});
