// Tests for the httpOnly-cookie session auth path.
//
// Two concerns:
//   (1) Login endpoints set a correctly-flagged session cookie.
//   (2) Subsequent requests authenticate via the cookie with no Authorization
//       header (the migration goal).
//   (3) Logout clears the cookie.
//   (4) CSRF middleware blocks cookie-authed non-GET requests that lack the
//       X-Requested-With header.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request } = require('./helpers');

// Parse a Set-Cookie header value into name/value/flags for assertion.
// Supertest normalises multiple Set-Cookie headers into an array.
function parseCookies(rawHeaders) {
  const arr = Array.isArray(rawHeaders) ? rawHeaders : [rawHeaders];
  return arr.filter(Boolean).map((raw) => {
    const [kv, ...flags] = raw.split(/;\s*/);
    const [name, value] = kv.split('=');
    const flagSet = new Set(flags.map((f) => f.toLowerCase()));
    const max = flags.find((f) => f.toLowerCase().startsWith('max-age='));
    return {
      name,
      value,
      httpOnly: flagSet.has('httponly'),
      secure: flagSet.has('secure'),
      sameSite: (flags.find((f) => f.toLowerCase().startsWith('samesite=')) || '').split('=')[1]?.toLowerCase(),
      path: (flags.find((f) => f.toLowerCase().startsWith('path=')) || '').split('=')[1],
      maxAge: max ? Number(max.split('=')[1]) : null,
    };
  });
}

function findCookie(headers, name) {
  return parseCookies(headers).find((c) => c.name === name);
}

describe('session cookie on login/register', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('register sets httpOnly session cookie with correct flags', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: `cookie-${Date.now()}@t.co`, password: 'TestPass-9f2A!xQ', acceptedTerms: true, ageConfirmed: true });
    assert.strictEqual(res.status, 200);
    const cookie = findCookie(res.headers['set-cookie'], 'rh_session');
    assert.ok(cookie, 'register must set rh_session cookie');
    assert.strictEqual(cookie.httpOnly, true);
    assert.strictEqual(cookie.sameSite, 'lax');
    assert.strictEqual(cookie.path, '/');
    // Secure is gated on NODE_ENV=production; tests run with NODE_ENV=test
    assert.strictEqual(cookie.secure, false);
    // maxAge is in seconds in Set-Cookie; 7 days = 604800
    assert.ok(cookie.maxAge > 0 && cookie.maxAge <= 604800,
      `maxAge out of range: ${cookie.maxAge}`);
  });

  test('login sets the same cookie', async () => {
    const u = await makeUser();
    const res = await request(app).post('/api/auth/login')
      .send({ email: u.email, password: u.password });
    assert.strictEqual(res.status, 200);
    assert.ok(findCookie(res.headers['set-cookie'], 'rh_session'));
  });

  test('register response body still includes token for migration compat', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: `compat-${Date.now()}@t.co`, password: 'TestPass-9f2A!xQ', acceptedTerms: true, ageConfirmed: true });
    assert.ok(typeof res.body.token === 'string' && res.body.token.length > 20);
  });
});

describe('cookie-based auth', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('cookie alone authenticates /me (no Authorization header)', async () => {
    const u = await makeUser();
    // Use supertest agent to preserve cookies across requests
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: u.email, password: u.password });
    // Subsequent GET with the agent carries the cookie — no header set
    const me = await agent.get('/api/auth/me');
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.body.user.email, u.email);
  });

  test('/me returns session_expires_at from the token exp claim', async () => {
    const u = await makeUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: u.email, password: u.password });
    const me = await agent.get('/api/auth/me');
    assert.ok(me.body.session_expires_at);
    // Should be roughly 7 days in the future
    const diffMs = new Date(me.body.session_expires_at).getTime() - Date.now();
    assert.ok(diffMs > 6 * 24 * 3600 * 1000, `session expiry too soon: ${me.body.session_expires_at}`);
    assert.ok(diffMs < 8 * 24 * 3600 * 1000, `session expiry too far: ${me.body.session_expires_at}`);
  });

  test('cookie + Bearer at the same time: cookie wins', async () => {
    // Prove the cookie takes precedence by using a different user's cookie
    // and a different user's Bearer token. The /me response should reflect
    // the cookie-identified user, not the header.
    const a = await makeUser();
    const b = await makeUser();
    const loginA = await request(app).post('/api/auth/login').send({ email: a.email, password: a.password });
    const aCookie = loginA.headers['set-cookie'][0].split(';')[0]; // "rh_session=..."
    const res = await request(app).get('/api/auth/me')
      .set('Cookie', aCookie)
      .set('Authorization', `Bearer ${b.token}`);
    assert.strictEqual(res.body.user.email, a.email, 'cookie identity should win over Bearer');
  });

  test('logout clears the cookie and de-authenticates the agent', async () => {
    const u = await makeUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: u.email, password: u.password });
    const before = await agent.get('/api/auth/me');
    assert.strictEqual(before.status, 200);

    const logout = await agent.post('/api/auth/logout').set('X-Requested-With', 'XMLHttpRequest');
    assert.strictEqual(logout.status, 200);
    // Set-Cookie with Max-Age=0 or past Expires clears it
    const cleared = findCookie(logout.headers['set-cookie'], 'rh_session');
    assert.ok(cleared, 'logout must send a clearing Set-Cookie');
    // supertest-agent sees Max-Age=0 / expired and drops the cookie on next request
    const after = await agent.get('/api/auth/me');
    assert.strictEqual(after.status, 401);
  });
});

describe('CSRF protection', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('cookie-authed POST without X-Requested-With is rejected 403', async () => {
    const u = await makeUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: u.email, password: u.password });
    // A state-changing POST using the cookie but NO X-Requested-With header.
    // This simulates a cross-site form submission.
    const res = await agent.put('/api/auth/notifications').send({ notif_new_review: false });
    assert.strictEqual(res.status, 403);
    assert.match(res.body.error, /CSRF/);
  });

  test('cookie-authed POST with X-Requested-With is accepted', async () => {
    const u = await makeUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: u.email, password: u.password });
    const res = await agent.put('/api/auth/notifications')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ notif_new_review: false });
    assert.strictEqual(res.status, 200);
  });

  test('Bearer-authed POST without X-Requested-With is still accepted (non-browser client)', async () => {
    const u = await makeUser();
    // No cookie — just Bearer token (the pattern every existing test uses)
    const res = await request(app).put('/api/auth/notifications')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ notif_new_review: false });
    assert.strictEqual(res.status, 200);
  });

  test('unauthenticated POST (no cookie, no bearer) is NOT blocked by CSRF — auth middleware rejects it first', async () => {
    // If CSRF blocked unauthed requests we'd get 403 instead of 401, which
    // is a worse error to debug. Verify it's 401 (or the route's own error).
    const res = await request(app).put('/api/auth/notifications').send({});
    assert.strictEqual(res.status, 401);
  });

  test('safe methods (GET) with cookie bypass CSRF check', async () => {
    const u = await makeUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: u.email, password: u.password });
    const res = await agent.get('/api/auth/me'); // no X-Requested-With
    assert.strictEqual(res.status, 200);
  });
});
