// Google Business Profile OAuth 2.0 helper.
//
// Why a separate file from providers/google.js: the OAuth dance
// (authorization URL generation, code→token exchange, refresh-token use)
// is distinct from the provider's data-fetching surface. This file owns
// the OAuth lifecycle; google.js consumes the tokens it stores.
//
// Required env vars (set up by the operator in Google Cloud Console):
//   GOOGLE_CLIENT_ID             — OAuth 2.0 Client ID
//   GOOGLE_CLIENT_SECRET         — OAuth 2.0 Client Secret
//   GOOGLE_OAUTH_REDIRECT_URI    — must match the URI whitelisted in the
//                                  Cloud Console (e.g.
//                                  https://yourapp.com/api/platforms/google/oauth/callback)
//
// Scopes: `business.manage` covers the Business Profile APIs needed to
// read locations and reviews.
//
// Flow:
//   1. User clicks "Connect with Google"
//   2. getAuthorizationUrl(state) → redirect to Google
//   3. Google redirects back with ?code=...&state=...
//   4. exchangeCodeForTokens(code) → {access_token, refresh_token, expires_at}
//   5. We store all three in platform_connections
//   6. On every sync, refreshIfNeeded() is called to ensure access_token
//      is valid, or exchange refresh_token for a new one

const crypto = require('crypto');

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Scopes required for Business Profile review management.
// `business.manage` is the umbrella scope that covers reading locations + reviews.
const SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'openid',
  'email',
];

function isConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

// Build the authorization URL the user is redirected to. `state` is a
// caller-opaque token we echo back on callback to prevent CSRF; the
// caller (oauth/start route) stores it bound to the user id.
function getAuthorizationUrl(state) {
  if (!isConfigured()) {
    throw new Error('Google OAuth not configured: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI');
  }
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    // access_type=offline asks Google for a refresh_token so we can keep
    // syncing after the initial access_token expires.
    access_type: 'offline',
    // prompt=consent forces the consent screen each time — without this,
    // Google omits the refresh_token on re-auth, which breaks long-term sync.
    prompt: 'consent',
    state,
    include_granted_scopes: 'true',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// Exchange an authorization code for tokens. Called from the callback route.
// Returns: { access_token, refresh_token, expires_at (ISO string), id_token,
//            google_email (from ID token, nice-to-have for display) }
async function exchangeCodeForTokens(code) {
  if (!isConfigured()) throw new Error('Google OAuth not configured');
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  const expiresInSec = data.expires_in || 3600;
  const expires_at = new Date(Date.now() + expiresInSec * 1000).toISOString();

  // Decode the ID token payload (middle segment of JWT) to pull out the
  // Google account email — handy for showing "Connected as alice@gmail.com"
  // in the UI. We do NOT verify the signature here; this is display-only,
  // not an auth claim. If the signature mattered we'd verify with Google's
  // JWKS, but we're not using the ID token for auth.
  let google_email = null;
  if (data.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(data.id_token.split('.')[1], 'base64').toString('utf8'));
      google_email = payload.email || null;
    } catch { /* ignore — email is display-only */ }
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token, // may be undefined if user re-connected without prompt=consent
    expires_at,
    google_email,
  };
}

// Use the refresh_token to get a new access_token without the user
// re-consenting. Returns same shape as exchangeCodeForTokens (minus refresh_token
// which stays the same, and minus id_token/google_email).
async function refreshAccessToken(refreshToken) {
  if (!isConfigured()) throw new Error('Google OAuth not configured');
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    // Distinguish "refresh token revoked" (requires re-auth) from transient errors.
    const revoked = res.status === 400 && err.includes('invalid_grant');
    const error = new Error(`Google token refresh failed (${res.status}): ${err}`);
    error.revoked = revoked;
    throw error;
  }
  const data = await res.json();
  const expiresInSec = data.expires_in || 3600;
  return {
    access_token: data.access_token,
    expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
  };
}

// Generate a CSRF-safe state token. Stored server-side bound to the user
// id + timestamp; when the callback comes back, we check it matches.
function generateState() {
  return crypto.randomBytes(24).toString('hex');
}

// Revoke a token at Google's endpoint. Works with either an access_token
// or a refresh_token; revoking the refresh_token implicitly invalidates
// every access_token derived from it. Best-effort — never blocks the
// calling flow (account delete, disconnect) on Google availability.
async function revokeToken(token) {
  if (!token) return { ok: true, skipped: true };
  try {
    const res = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // 200 = revoked. 400 with error=invalid_token means it was already
    // revoked or expired — idempotently successful.
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    if (res.status === 400 && body.includes('invalid_token')) return { ok: true, alreadyInvalid: true };
    return { ok: false, status: res.status, body };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  isConfigured,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  generateState,
  SCOPES,
};
