// Google sign-in — server-side OAuth 2.0 flow (Authorization Code).
//
// Why server-side and not Google Identity Services / one-tap on the
// client: the GIS popup needs the client_id baked into the page,
// which is fine, but state-management around CSRF and the post-login
// session is cleaner when the server holds the auth boundary. We
// already have JWT issuance + cookie session infra — slotting Google
// in as another `signToken` source matches that pattern.
//
// Flow:
//   1. /api/auth/google/login  → server redirects user to Google with
//      a one-time `state` param stored in a short-TTL cookie.
//   2. Google redirects back to /api/auth/google/callback?code=…&state=…
//   3. Server verifies state cookie matches param (CSRF guard),
//      exchanges code for tokens, decodes the ID token to get email
//      + google_sub.
//   4. Account linking:
//      - If a user with that email exists, link by setting google_sub.
//      - If google_sub already linked, just sign in.
//      - If no match, auto-create a new user (email-verified since
//        Google has already verified it).
//   5. Issue a ReviewHub JWT, set the session cookie, redirect to
//      /dashboard.
//
// Env vars:
//   GOOGLE_SIGNIN_CLIENT_ID
//   GOOGLE_SIGNIN_CLIENT_SECRET
//   GOOGLE_SIGNIN_REDIRECT_URI   (optional, defaults to {CLIENT_URL}/api/auth/google/callback)

const crypto = require('crypto');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Scopes for sign-in only — we do NOT request business.manage here
// because that's a separate OAuth client (the review-fetching client
// on a different Google account). Sign-in needs only identity claims.
const SIGNIN_SCOPES = ['openid', 'email', 'profile'];

function isConfigured() {
  return !!(process.env.GOOGLE_SIGNIN_CLIENT_ID && process.env.GOOGLE_SIGNIN_CLIENT_SECRET);
}

function getRedirectUri() {
  if (process.env.GOOGLE_SIGNIN_REDIRECT_URI) return process.env.GOOGLE_SIGNIN_REDIRECT_URI;
  const base = process.env.CLIENT_URL || 'http://localhost:5173';
  // The redirect URI is server-rooted (Google posts the code to a
  // server endpoint), so we use the same host as CLIENT_URL but the
  // /api/auth/google/callback path. In dev with Vite proxy, this is
  // localhost:5173/api/... → proxied to localhost:3001. In prod,
  // reviewhub.review/api/... is served by the same host as the SPA.
  return `${base.replace(/\/$/, '')}/api/auth/google/callback`;
}

// Build the Google auth URL the user is redirected to. `state` is a
// random token we round-trip through Google + verify against a cookie
// on callback (CSRF defense — without it, an attacker could initiate
// a callback for their own Google account against the victim's
// session and link them).
function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_SIGNIN_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SIGNIN_SCOPES.join(' '),
    state,
    access_type: 'online',
    prompt: 'select_account',
    // include_granted_scopes lets a user who's already granted
    // business.manage on a different client elevate without
    // re-consenting to those scopes. Off here because we want
    // sign-in scopes ONLY.
    include_granted_scopes: 'false',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

// Exchange the authorization code for tokens. Returns the decoded
// ID token claims. We don't need the access token for sign-in (no
// further Google API calls); just the ID token to identify the user.
async function exchangeCodeForIdToken(code) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_SIGNIN_CLIENT_ID,
    client_secret: process.env.GOOGLE_SIGNIN_CLIENT_SECRET,
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Google token exchange ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  if (!json.id_token) {
    throw new Error('Google token response missing id_token');
  }
  return decodeIdToken(json.id_token);
}

// Minimal JWT decode. We trust the ID token came directly from
// Google's token endpoint over TLS in response to our authenticated
// client_secret request — no signature verification needed at this
// point because the token never left Google's servers without our
// auth. (Verifying signature would also work but adds a JWKS fetch
// per sign-in; not worth it here.)
function decodeIdToken(idToken) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed id_token');
  const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
  const claims = JSON.parse(payload);
  if (!claims.sub) throw new Error('id_token missing sub claim');
  if (!claims.email) throw new Error('id_token missing email claim');
  if (claims.email_verified !== true) {
    // Google sets this true for nearly every Gmail account. If false,
    // the user's email isn't verified at Google's end — refuse to
    // auto-create a ReviewHub account from it because we can't trust
    // the address belongs to them.
    throw new Error('Google email not verified');
  }
  // Optional but defensive: check audience matches our client_id so a
  // token issued for some OTHER Google project couldn't be replayed
  // against ours.
  if (claims.aud !== process.env.GOOGLE_SIGNIN_CLIENT_ID) {
    throw new Error('id_token audience mismatch');
  }
  return claims;
}

function genState() {
  return crypto.randomBytes(24).toString('base64url');
}

module.exports = {
  isConfigured,
  buildAuthUrl,
  exchangeCodeForIdToken,
  genState,
  getRedirectUri,
};
