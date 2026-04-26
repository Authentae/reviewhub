// Token helpers for email verification and password reset.
//
// Design:
//   - Plaintext token = 32 random bytes as hex (64 chars). Sent via email only.
//   - DB stores SHA-256(token) as hex. If the DB is dumped, tokens can't be used.
//   - Lookup is by hash (indexed). Comparison uses timingSafeEqual to avoid
//     timing-based token guessing (even though we're hashing, belt-and-braces).

const crypto = require('crypto');

// Generate a fresh token. Returns { plaintext, hash } — the plaintext goes in the
// email link, the hash goes in the DB.
function generateToken() {
  const plaintext = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(plaintext);
  return { plaintext, hash };
}

// Hash a token with SHA-256. No salt needed — the token itself is already
// 256 bits of entropy, so salting doesn't add meaningful security for this use.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Constant-time comparison of two equal-length hex strings.
// Returns false if lengths differ (which can't happen with SHA-256 hex output
// but guards against accidental misuse).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// Stateless signed token for List-Unsubscribe one-click handling (RFC 8058).
//
// Why a separate scheme from generateToken: those are random + DB-stored hashes
// (revocable, single-use). Unsubscribe tokens are emitted in every digest sent
// over months — we don't want a row per email. HMAC over (userId, listType)
// is stateless: the link in a 6-month-old digest still works, and revoking
// is just a server-side check ("is the user still subscribed?").
//
// Format: base64url(json{u,l,t}) + "." + base64url(hmac-sha256)
//   u = user id, l = list type ("digest"/"new_review"/"negative_alert"), t = issued-at unix-seconds
// Verifying: split on ".", recompute HMAC, constant-time compare.
//
// Secret: JWT_SECRET (already required to be ≥32 chars in prod). Reusing it
// avoids adding another secret to the env surface; the HMAC uses domain
// separation via a "unsub:" prefix so a JWT can never be confused for an
// unsub token and vice versa.
function _b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function _b64urlDecode(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}
function _unsubSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET required for unsub tokens');
  return crypto.createHmac('sha256', 'unsub:' + s).digest();
}

function makeUnsubToken(userId, listType) {
  const payload = { u: Number(userId), l: String(listType), t: Math.floor(Date.now() / 1000) };
  const body = _b64url(JSON.stringify(payload));
  const sig = _b64url(crypto.createHmac('sha256', _unsubSecret()).update(body).digest());
  return body + '.' + sig;
}

// Returns { ok: true, userId, listType } on success, { ok: false, reason } otherwise.
// Tokens never expire — see comment above. If the user re-subscribes and we
// want to invalidate prior tokens, that's a feature flag we can add later.
function verifyUnsubToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'malformed' };
  const [body, sig] = token.split('.', 2);
  let expected;
  try {
    expected = _b64url(crypto.createHmac('sha256', _unsubSecret()).update(body).digest());
  } catch (err) {
    return { ok: false, reason: 'config' };
  }
  // Constant-time compare. Strings same length here so the simple compare is OK,
  // but use timingSafeEqual to be explicit about intent.
  if (sig.length !== expected.length) return { ok: false, reason: 'sig' };
  let same = true;
  try {
    same = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return { ok: false, reason: 'sig' }; }
  if (!same) return { ok: false, reason: 'sig' };
  let payload;
  try { payload = JSON.parse(_b64urlDecode(body).toString('utf8')); }
  catch { return { ok: false, reason: 'payload' }; }
  if (!Number.isFinite(payload?.u) || typeof payload?.l !== 'string') {
    return { ok: false, reason: 'payload' };
  }
  return { ok: true, userId: payload.u, listType: payload.l, issuedAt: payload.t };
}

module.exports = { generateToken, hashToken, safeEqual, makeUnsubToken, verifyUnsubToken };
