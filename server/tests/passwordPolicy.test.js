// Unit tests for lib/passwordPolicy.js — pure functions used by every
// password-touching route (register, login, change, reset). The route-level
// integration suites cover happy-path; this file pins down the validation
// edge cases (length boundaries, email-derivation, common-list coverage)
// and the bcrypt rehash-detection logic.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  validatePassword,
  hashPassword,
  comparePassword,
  needsRehash,
  MIN_LENGTH,
  MAX_LENGTH,
  BCRYPT_COST,
} = require('../src/lib/passwordPolicy');

describe('validatePassword', () => {
  test('rejects non-string', () => {
    for (const v of [undefined, null, 12345678, {}, [], true]) {
      const r = validatePassword(v);
      assert.strictEqual(r.ok, false);
      assert.match(r.error, /string/i);
    }
  });

  test(`rejects shorter than MIN_LENGTH (${MIN_LENGTH})`, () => {
    const tooShort = 'A'.repeat(MIN_LENGTH - 1);
    const r = validatePassword(tooShort);
    assert.strictEqual(r.ok, false);
    assert.match(r.error, new RegExp(`${MIN_LENGTH}`));
  });

  test(`accepts exactly MIN_LENGTH (${MIN_LENGTH}) when not common`, () => {
    const r = validatePassword('Zq7!aB2x');
    assert.strictEqual(r.ok, true);
  });

  test(`rejects longer than MAX_LENGTH (${MAX_LENGTH})`, () => {
    const tooLong = 'A'.repeat(MAX_LENGTH + 1);
    const r = validatePassword(tooLong);
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /long/i);
  });

  test(`accepts exactly MAX_LENGTH (${MAX_LENGTH})`, () => {
    // 128 chars, mixed so it's not a recognisable pattern
    const r = validatePassword('Zq7!aB2x'.repeat(16));
    assert.strictEqual(r.ok, true);
  });

  test('rejects password === email (case-insensitive)', () => {
    const r = validatePassword('User@Example.com', { email: 'user@example.com' });
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /email/i);
  });

  test('rejects password === email local-part when local ≥ 4 chars', () => {
    const r = validatePassword('alice', { email: 'alice@example.com' });
    // 5 chars — but below MIN_LENGTH — should fail on length first
    assert.strictEqual(r.ok, false);
    // For one ≥ MIN_LENGTH where the local is itself ≥ MIN_LENGTH:
    const r2 = validatePassword('verysecret', { email: 'verysecret@example.com' });
    assert.strictEqual(r2.ok, false);
    assert.match(r2.error, /derived/i);
  });

  test('does NOT reject a 3-char local-part that happens to be a substring', () => {
    // Local "abc" is < 4 chars, so the local-part rule is skipped. The
    // password "abcSecret9!" is a normal valid password and should pass.
    const r = validatePassword('abcSecret9!', { email: 'abc@example.com' });
    assert.strictEqual(r.ok, true);
  });

  test('rejects common breach-list passwords (case-insensitive)', () => {
    for (const common of ['password123', 'Password123', 'ADMIN123', 'qwerty123', 'changeme']) {
      const r = validatePassword(common);
      assert.strictEqual(r.ok, false, `expected ${common} rejected`);
      assert.match(r.error, /common/i);
    }
  });

  test('accepts a strong password without email context', () => {
    const r = validatePassword('Zq7!aB2x-magnolia');
    assert.strictEqual(r.ok, true);
  });

  test('handles non-ASCII (Thai, emoji) without throwing', () => {
    const r = validatePassword('สวัสดี-2026!🌟');
    // 12 chars + emoji — well above MIN_LENGTH after JS counts code units
    assert.strictEqual(r.ok, true);
  });
});

describe('hashPassword + comparePassword', () => {
  test('hash then compare round-trips', async () => {
    const pw = 'Zq7!aB2x-roundtrip';
    const hash = await hashPassword(pw);
    assert.strictEqual(typeof hash, 'string');
    assert.match(hash, /^\$2[aby]\$\d{2}\$/);
    assert.strictEqual(await comparePassword(pw, hash), true);
    assert.strictEqual(await comparePassword('different', hash), false);
  });

  test('produces a different hash for the same input each call (salt)', async () => {
    const pw = 'Zq7!aB2x-salted';
    const a = await hashPassword(pw);
    const b = await hashPassword(pw);
    assert.notStrictEqual(a, b);
    // …but both verify
    assert.strictEqual(await comparePassword(pw, a), true);
    assert.strictEqual(await comparePassword(pw, b), true);
  });

  test('hashes embed the current BCRYPT_COST', async () => {
    const hash = await hashPassword('Zq7!aB2x-cost');
    const m = /^\$2[aby]\$(\d{2})\$/.exec(hash);
    assert.ok(m);
    assert.strictEqual(parseInt(m[1], 10), BCRYPT_COST);
  });
});

describe('needsRehash', () => {
  test(`returns true for cost below current (${BCRYPT_COST})`, () => {
    // Build a synthetic header — bcrypt accepts $2a$ / $2b$ / $2y$.
    const old = '$2a$10$' + 'x'.repeat(53);
    assert.strictEqual(needsRehash(old), true);
  });

  test(`returns false for cost equal to current`, () => {
    const cur = `$2b$${String(BCRYPT_COST).padStart(2, '0')}$` + 'x'.repeat(53);
    assert.strictEqual(needsRehash(cur), false);
  });

  test('returns false for cost above current (forward-compat)', () => {
    const future = '$2b$15$' + 'x'.repeat(53);
    assert.strictEqual(needsRehash(future), false);
  });

  test('returns true for unrecognisable formats (so they get migrated)', () => {
    for (const v of ['', 'plaintext', 'argon2id$blah', '$pbkdf2$10$xyz']) {
      assert.strictEqual(needsRehash(v), true, `expected unknown format ${JSON.stringify(v)} to be flagged`);
    }
  });

  test('returns false for non-string (no hash to migrate)', () => {
    for (const v of [null, undefined, 12, {}, []]) {
      assert.strictEqual(needsRehash(v), false);
    }
  });
});
