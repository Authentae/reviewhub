import axios from 'axios';
import { getToken, clearToken } from './auth';

// Axios client.
//
// Post-cookie-migration auth model:
//   - Session lives in an httpOnly cookie the server sets on login. The
//     browser sends it automatically because `withCredentials: true`.
//   - `X-Requested-With` satisfies the server's CSRF check for cookie-authed
//     state-changing requests. Other origins can't set custom headers on a
//     simple cross-site request without a CORS preflight, and our CORS
//     policy only allows the configured CLIENT_URL — so this header is
//     effectively a CSRF token that forgery can't produce.
//   - Bearer-from-localStorage fallback still fires when `getToken()` finds
//     a pre-migration token cached. This smooths the upgrade — users who
//     were logged in before the new build don't get kicked out.
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Legacy fallback: attach Bearer if a token is still in localStorage from
  // a pre-cookie session. New sessions never write here; once the cached
  // token expires, this branch becomes dead code and can be removed.
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // CSRF: server requires this header on cookie-authed state-changing
  // requests. Safe to send on every request — server ignores it on GETs.
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  config.headers['X-Request-Id'] = Math.random().toString(36).slice(2, 10);
  return config;
});

// Endpoints where a 401 is expected / user-driven and MUST NOT trigger the
// generic redirect — the component owns the error UX:
//   /auth/login        — bad credentials
//   /auth/register     — (can 401 in some flows)
//   /auth/forgot-*     — generic response surface
//   /auth/reset-*      — token validation errors surface inline
//   /auth/login/mfa    — MFA code rejection
//   /auth/login/recovery — recovery code rejection
// Any OTHER /auth/* endpoint (/auth/me, /auth/notifications, /auth/mfa/enable,
// /auth/password, /auth/me/export, etc.) returning 401 means the session is
// expired — redirect to /login so the user can re-auth and return.
const AUTH_401_IS_USER_ERROR = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/login/mfa',
  '/auth/login/recovery',
];
function shouldRedirectOn401(url) {
  for (const path of AUTH_401_IS_USER_ERROR) {
    // Match as a suffix of the URL path — axios may prefix baseURL and query.
    if (url.includes(path)) return false;
  }
  return true;
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && shouldRedirectOn401(url)) {
      // Session expired (or cookie missing). Clear any legacy localStorage
      // token and bounce to /login. Preserve the current path as ?next=
      // so a successful re-auth lands the user back exactly where their
      // session timed out, not on /dashboard. PrivateRoute's `from`
      // state preservation only fires when React Router triggers the
      // redirect — when api.js does a hard window.location.href no
      // state is passed, so we encode it in the URL instead.
      clearToken();
      const here = window.location.pathname + window.location.search;
      // Don't loop: never set next=/login (would cycle).
      const next = here && !here.startsWith('/login') ? `?next=${encodeURIComponent(here)}` : '';
      window.location.href = `/login${next}`;
    }
    if (err.response?.status === 429) {
      err.isRateLimited = true;
      // Surface how long to wait. Standard RateLimit headers (IETF draft-7)
      // include `RateLimit-Reset` in seconds and `Retry-After` in seconds.
      // Either may be present; prefer RateLimit-Reset for draft compliance.
      const h = err.response.headers || {};
      const resetSec = parseInt(h['ratelimit-reset'] || h['x-ratelimit-reset'] || h['retry-after'], 10);
      if (Number.isFinite(resetSec) && resetSec > 0) {
        err.retryAfterSeconds = resetSec;
      }
    }
    if (!err.response && err.request) {
      err.isNetworkError = true;
      err.message = err.code === 'ECONNABORTED'
        ? 'Request timed out — server may be busy'
        : 'Network error — please check your connection';
    }
    return Promise.reject(err);
  }
);

export default api;
