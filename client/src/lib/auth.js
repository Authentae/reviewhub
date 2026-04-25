// Client-side auth state.
//
// Server holds the real credential (httpOnly session cookie). The client
// keeps only a non-sensitive "logged in" marker in localStorage so route
// guards (PrivateRoute / PublicOnlyRoute) can decide synchronously without
// a network call. The marker being wrong is never a security issue — the
// server re-checks every request and responds with 401 if the cookie is
// missing or invalid, at which point api.js redirects to /login.
//
// Legacy: we kept the `token` key in localStorage for migration compat —
// pre-cookie clients still read/write it. Newly-authenticated clients only
// set the marker; the token cookie is set server-side and invisible here.

const MARKER_KEY = 'rh_logged_in';
const LEGACY_TOKEN_KEY = 'token';

// Legacy API — used by code paths that were written before the cookie
// migration. Kept to avoid touching every call site; callers should prefer
// the semantic helpers (markLoggedIn / clearAuthState / isLoggedIn).
export function getToken() {
  return localStorage.getItem(LEGACY_TOKEN_KEY);
}
export function setToken(t) {
  // Continue writing the legacy token for any code that still reads it
  // (e.g. the Navbar's JWT-decode-for-email utility). Once that code is
  // moved to read from /me, this whole fallback can go away.
  if (t) localStorage.setItem(LEGACY_TOKEN_KEY, t);
  // The marker is the new source of truth for "are we logged in".
  localStorage.setItem(MARKER_KEY, '1');
}
export function clearToken() {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(MARKER_KEY);
}

// Synchronous check used by route guards.
//
// If a legacy JWT is present in localStorage, that's authoritative for
// expiry — an expired or malformed JWT means "not logged in" even if the
// marker is set, and we clear both so subsequent requests don't loop on
// 401 redirects.
//
// If no legacy JWT is present (post-cookie clients), the marker alone is
// the synchronous signal. The server is the real arbiter: the first /me
// after route mount will tell us if the cookie is actually valid, and if
// not, api.js's 401 interceptor will redirect to /login.
export function isLoggedIn() {
  const token = getToken();
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        clearToken();
        return false;
      }
      return true;
    } catch {
      clearToken();
      return false;
    }
  }
  return localStorage.getItem(MARKER_KEY) === '1';
}

// Legacy helper preserved for SessionExpiryBanner — still tries to read
// the cached token's exp. Post-cookie-migration, the banner will prefer
// the `session_expires_at` field returned by /me, and this can return null.
export function getTokenExpiryMs() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return null;
    return payload.exp * 1000 - Date.now();
  } catch {
    return null;
  }
}
