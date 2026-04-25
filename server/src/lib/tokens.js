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

module.exports = { generateToken, hashToken, safeEqual };
