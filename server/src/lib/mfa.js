// Multi-factor auth helpers — email-based one-time passwords (OTP) and
// recovery codes. Designed to be swapped for TOTP (authenticator apps) later
// without changing the route interface.
//
// Security posture:
//   - OTP codes are 6 digits, valid for 10 minutes, hashed in the DB.
//   - Recovery codes are 10 × 8 uppercase-alphanumeric groups, hashed
//     individually and single-use (marked used_at on consumption).
//   - All comparisons go through timingSafeEqual to avoid timing leaks, even
//     though we're comparing hashes (belt-and-braces).
//   - Rate limiting on challenge issuance happens at the route layer; the
//     user row has `mfa_last_sent_at` so per-account limits can be enforced.

const crypto = require('crypto');
const { hashToken, safeEqual } = require('./tokens');

const OTP_EXPIRY_MINUTES = 10;
const RECOVERY_CODE_COUNT = 10;

// 6-digit zero-padded code. `randomInt(0, 1_000_000)` is uniformly distributed
// over 0–999,999; padding gives a consistent "123456" shape.
function generateOtp() {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

// Recovery code format: "XXXX-XXXX" using A–Z, 2–9 (no 0/1/O/I to avoid
// confusion in handwritten copies). 8 significant chars = 32 bits of entropy
// per code, ample for single-use.
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRecoveryCode() {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  return Array.from({ length: count }, () => generateRecoveryCode());
}

// Normalise user-entered codes before hashing/comparing. Recovery codes in
// the email are displayed with a dash; a user pasting may or may not include
// it. Strip whitespace and dashes, uppercase, so "abcd efgh", "ABCD-EFGH",
// and "abcdefgh" all match.
function normaliseRecoveryCode(raw) {
  return String(raw || '').replace(/[\s-]/g, '').toUpperCase();
}

function hashRecoveryCode(code) {
  return hashToken(normaliseRecoveryCode(code));
}

// OTP: we only allow digits; strip any stray whitespace a user might paste.
function normaliseOtp(raw) {
  return String(raw || '').replace(/\s+/g, '');
}

function hashOtp(code) {
  return hashToken(normaliseOtp(code));
}

// Constant-time compare for hashed codes. Both inputs are 64-char hex from
// SHA-256, same length, so safeEqual works directly.
function compareHashes(a, b) {
  return safeEqual(a, b);
}

module.exports = {
  OTP_EXPIRY_MINUTES,
  RECOVERY_CODE_COUNT,
  generateOtp,
  generateRecoveryCode,
  generateRecoveryCodes,
  normaliseRecoveryCode,
  hashRecoveryCode,
  normaliseOtp,
  hashOtp,
  compareHashes,
};
