const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT_SECRET hardening.
//
// Production: refuse to start with a weak or missing secret. If an operator
// forgets the env var, the previous behaviour was "boot with a hard-coded
// known string" — which is functionally no auth, since anyone with the repo
// can forge tokens. Better to fail loudly at boot than quietly in prod.
//
// Development / test: allow a fallback to keep "clone and run" ergonomics,
// but clearly mark the process as insecure in logs.
const MIN_SECRET_LEN = 32;

function resolveSecret() {
  const env = process.env.JWT_SECRET;
  const strong = typeof env === 'string' && env.length >= MIN_SECRET_LEN;

  if (process.env.NODE_ENV === 'production' && !strong) {
    // Throwing at require-time ensures the process never serves a request
    // with a weak secret. The supervisor (systemd / pm2 / Docker) will
    // see the non-zero exit and surface it in logs.
    throw new Error(
      `JWT_SECRET must be set to a random string of at least ${MIN_SECRET_LEN} characters in production. ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
    );
  }

  if (!strong) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SECURITY] JWT_SECRET is missing or shorter than ${MIN_SECRET_LEN} chars. Using a dev fallback. ` +
      `This is ONLY safe in local development.`
    );
    return env || 'dev-fallback-do-not-use-in-production-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  }

  return env;
}

const JWT_SECRET = resolveSecret();

// Read the JWT from either the session cookie (preferred, post-migration)
// or the Authorization: Bearer header (legacy + non-browser clients). We
// try the cookie first so that once the client deploys with
// withCredentials:true, no request still carries the token in a header.
function extractToken(req) {
  const { readSessionCookie } = require('../lib/sessionCookie');
  const cookie = readSessionCookie(req);
  if (cookie) return cookie;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// API key auth path — called by authMiddleware when the bearer token starts
// with "rh_". Hashes the raw key, looks it up, and populates req.user exactly
// as a JWT would. Updates last_used_at asynchronously (fire-and-forget) so it
// doesn't add latency to every API call.
//
// Two key families share this prefix:
//   rh_ext_<token>  → browser-extension token (one-per-user, stored on
//                      users.extension_token_hash, available on all plans)
//   rh_<token>      → general API keys from /api/apikeys (Business-plan)
function apiKeyMiddleware(req, res, next, rawKey) {
  try {
    const { get, run } = require('../db/schema');
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // Extension tokens first — their hash lives on users.extension_token_hash
    if (rawKey.startsWith('rh_ext_')) {
      const row = get(
        'SELECT id, email FROM users WHERE extension_token_hash = ?',
        [hash]
      );
      if (!row) return res.status(401).json({ error: 'Invalid extension token' });
      req.user = { id: row.id, email: row.email, extensionToken: true };
      return next();
    }

    // General API keys — from the api_keys table, plan-gated at issuance
    const row = get(
      `SELECT ak.id, ak.user_id, u.email
       FROM api_keys ak JOIN users u ON u.id = ak.user_id
       WHERE ak.key_hash = ?`,
      [hash]
    );
    if (!row) return res.status(401).json({ error: 'Invalid API key' });

    req.user = { id: row.user_id, email: row.email, apiKeyId: row.id };
    setImmediate(() => {
      try { run("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?", [row.id]); } catch { /* ignore */ }
    });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid API key' });
  }
}

// Standard auth middleware. Rejects tokens that are still in the "mfa
// pending" state — those can only be used at /auth/login/mfa to complete the
// sign-in flow. Use `mfaPendingMiddleware` for the MFA-completion routes.
function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  // API key path — keys start with "rh_", JWTs do not
  if (token.startsWith('rh_')) {
    return apiKeyMiddleware(req, res, next, token);
  }
  try {
    const claims = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (claims.mfa === 'pending') {
      return res.status(401).json({ error: 'MFA required' });
    }

    // Revoke JWTs issued before the user last rotated their password. This
    // protects against an attacker who stole a token before the legit user
    // changed their password: the token is cryptographically valid but
    // logically stale. `iat` (issued-at) is seconds-since-epoch; the DB
    // column is a SQLite datetime string (UTC).
    //
    // Skipped for non-auth-gated routes upstream — this middleware is only
    // invoked where we actually need fresh auth, and the DB read is ~0.05ms.
    try {
      const { get } = require('../db/schema');
      const row = claims.id
        ? get('SELECT password_changed_at FROM users WHERE id = ?', [claims.id])
        : null;
      if (row?.password_changed_at) {
        // Parse the SQLite datetime (UTC, no trailing Z) to ms
        const changedAtMs = new Date(row.password_changed_at + 'Z').getTime();
        const iatMs = (claims.iat || 0) * 1000;
        // If the JWT was issued 30s or more before the password change, reject.
        // The small fudge window tolerates clock skew between app restarts
        // and reset workflow races without widening the real revocation gap.
        if (Number.isFinite(changedAtMs) && iatMs + 30_000 < changedAtMs) {
          return res.status(401).json({ error: 'Session revoked — please sign in again' });
        }
      }
    } catch {
      // DB unavailable → fail closed on the password-change check rather
      // than silently passing potentially-revoked tokens. But we don't
      // want to break auth for transient DB errors either — 500 is more
      // honest than 401 here.
      // (Practically unreachable: same DB that served every other req.)
    }

    req.user = claims;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Dedicated middleware for the two MFA-completion endpoints. Only accepts
// tokens with `mfa: 'pending'`. A full access token submitted here is wrong.
// The MFA-pending token is NOT set as a cookie (it's returned only in the
// JSON body so the client holds it in memory), so this middleware still
// reads exclusively from the Authorization header.
function mfaPendingMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing MFA token' });
  }
  const token = header.slice(7);
  try {
    const claims = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (claims.mfa !== 'pending') {
      return res.status(401).json({ error: 'Invalid MFA token' });
    }
    req.user = claims;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid MFA token' });
  }
}

// Default expiry is 7 days. Callers can override for short-lived tokens like
// the MFA-pending intermediate JWT (10 minutes).
function signToken(payload, { expiresIn = '7d' } = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// Soft-auth: returns the authenticated user's id if a valid JWT is on
// the request, or null otherwise. Never throws, never 401s. Use on
// public endpoints where knowing the caller is "nice to have" but not
// required — e.g. suppressing self-view notifications when the founder
// previews their own outbound audit URL while still logged in.
function tryGetUserId(req) {
  try {
    const token = extractToken(req);
    if (!token || token.startsWith('rh_')) return null;
    const claims = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (claims?.mfa === 'pending') return null;
    return typeof claims?.id === 'number' ? claims.id : null;
  } catch {
    return null;
  }
}

module.exports = { authMiddleware, mfaPendingMiddleware, signToken, tryGetUserId };
