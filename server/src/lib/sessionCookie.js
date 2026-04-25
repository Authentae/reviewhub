// HTTP session cookie helpers.
//
// We set the JWT as an httpOnly cookie so XSS (if any lands) can't exfiltrate
// it. The cookie is the canonical auth credential; Bearer tokens are still
// accepted by authMiddleware during the migration window so existing
// localStorage-based clients keep working until they reload and pick up the
// new frontend code.
//
// Cross-site protection strategy:
//   - SameSite=Lax  — balances usability (OAuth return links, top-level
//     navigations) with protection against cross-site POSTs. We back it up
//     with an origin/custom-header CSRF check on state-changing routes.
//   - Secure in production — cookie never sent over plain HTTP.
//   - HttpOnly — blocks `document.cookie` access (XSS can't read the JWT).
//   - Path=/     — cookie applies to all routes under this origin.
//
// The 7d lifetime matches the JWT's `exp` so we don't have a cookie that
// lives longer than the token it carries.

const COOKIE_NAME = 'rh_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches signToken default

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_MS,
  };
}

// Set the session cookie on the response with the given JWT.
function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

// Clear the session cookie. Must use matching options (sameSite, path,
// secure) for the browser to recognise the clear, otherwise old cookies
// linger until their TTL expires.
function clearSessionCookie(res) {
  const opts = cookieOptions();
  delete opts.maxAge;
  res.clearCookie(COOKIE_NAME, opts);
}

// Read the session cookie from an incoming request (req.cookies is populated
// by the cookie-parser middleware registered in app.js).
function readSessionCookie(req) {
  return req.cookies ? req.cookies[COOKIE_NAME] : undefined;
}

module.exports = { COOKIE_NAME, setSessionCookie, clearSessionCookie, readSessionCookie };
