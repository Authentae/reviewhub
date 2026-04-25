// Centralised password policy. Single source of truth for hashing and
// validation rules — used by /register, /login, /change-password, and the
// password-reset flow. Keeping all three in sync was the original reason for
// extracting this; bumping requirements now means editing one constant
// instead of three routes.

const bcrypt = require('bcryptjs');

// OWASP 2026 recommendation. cost=12 is ~250ms on modern hardware — slow
// enough to make offline cracking expensive, fast enough not to be a DoS
// vector on legitimate logins. Older accounts hashed at cost=10 are
// transparently re-hashed on next successful login (see needsRehash).
const BCRYPT_COST = 12;

// NIST SP 800-63B (rev 4, 2024) abandoned arbitrary complexity rules
// (mixed-case + digits + symbols) in favour of length + breach checking.
// The 8-char floor reflects current consensus; 128 cap prevents bcrypt's
// 72-byte truncation surprise and DoS on hash-time.
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

// Top breach-list passwords. NOT a complete defence — full coverage needs
// HIBP k-anonymity API or a downloaded SecLists wordlist — but blocks the
// hits that account-takeover scripts actually try. Lower-cased for compare.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  '1234567890', 'qwerty123', 'qwertyuiop', 'iloveyou1', 'admin123',
  'letmein123', 'welcome123', 'monkey123', 'football1', 'abc12345',
  'passw0rd', 'p@ssw0rd', 'p@ssword', 'changeme', 'changeme1',
  'baseball1', 'superman1', 'starwars1', 'trustno1!', 'shadow123',
]);

// Validate a candidate password. Returns { ok: true } on accept, or
// { ok: false, error: '...' } with a user-facing reason on reject. Order
// matters: cheap checks first so we don't burn CPU on doomed candidates.
function validatePassword(password, { email } = {}) {
  if (typeof password !== 'string') {
    return { ok: false, error: 'Password must be a string' };
  }
  if (password.length < MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_LENGTH} characters` };
  }
  if (password.length > MAX_LENGTH) {
    return { ok: false, error: `Password too long (max ${MAX_LENGTH} characters)` };
  }
  // Reject the email itself as the password — surprisingly common.
  if (email && password.toLowerCase() === email.toLowerCase()) {
    return { ok: false, error: 'Password cannot be your email address' };
  }
  // Reject the local-part of the email (the bit before @).
  if (email) {
    const local = email.split('@')[0].toLowerCase();
    if (local.length >= 4 && password.toLowerCase() === local) {
      return { ok: false, error: 'Password cannot be derived from your email' };
    }
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: 'This password is too common — choose something less guessable' };
  }
  return { ok: true };
}

// Hash a password at the current cost factor. Always await.
function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

// Compare. Same semantics as bcrypt.compare; centralised so we can swap
// algorithms (argon2id) without hunting call sites.
function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Detect hashes whose embedded cost factor is below the current target.
// Call after a successful login to opportunistically re-hash at the new
// cost — users get the upgrade without a forced password reset. Cost is
// encoded as the second `$`-separated field, e.g. `$2a$10$…`.
function needsRehash(hash) {
  if (typeof hash !== 'string') return false;
  const match = /^\$2[aby]\$(\d{2})\$/.exec(hash);
  if (!match) return true; // unknown format — re-hash to migrate
  return parseInt(match[1], 10) < BCRYPT_COST;
}

module.exports = {
  BCRYPT_COST,
  MIN_LENGTH,
  MAX_LENGTH,
  validatePassword,
  hashPassword,
  comparePassword,
  needsRehash,
};
