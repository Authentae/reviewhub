// Unit tests for the token helpers. No DB required.

const { test, describe } = require('node:test');
const assert = require('node:assert');

// makeUnsubToken / verifyUnsubToken require JWT_SECRET. Set a deterministic
// one BEFORE requiring tokens — helpers.js doesn't touch JWT_SECRET, so it
// either inherits from the environment (flaky test) or is undefined (throw).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-tokens-tests-32-chars-min!';

const { generateToken, hashToken, safeEqual, makeUnsubToken, verifyUnsubToken } = require('../src/lib/tokens');

describe('tokens', () => {
  test('generateToken produces 64-char hex plaintext', () => {
    const { plaintext } = generateToken();
    assert.match(plaintext, /^[a-f0-9]{64}$/);
  });

  test('generateToken hash matches hashToken(plaintext)', () => {
    const { plaintext, hash } = generateToken();
    assert.strictEqual(hash, hashToken(plaintext));
  });

  test('two calls produce different tokens', () => {
    const a = generateToken();
    const b = generateToken();
    assert.notStrictEqual(a.plaintext, b.plaintext);
    assert.notStrictEqual(a.hash, b.hash);
  });

  test('hashToken is deterministic', () => {
    assert.strictEqual(hashToken('abc'), hashToken('abc'));
    assert.notStrictEqual(hashToken('abc'), hashToken('abd'));
  });

  test('safeEqual is true for equal hex strings', () => {
    const h = hashToken('x');
    assert.strictEqual(safeEqual(h, h), true);
  });

  test('safeEqual is false for different strings', () => {
    assert.strictEqual(safeEqual(hashToken('a'), hashToken('b')), false);
  });

  test('safeEqual rejects non-string or mismatched-length input', () => {
    assert.strictEqual(safeEqual('abc', 'abcd'), false);
    assert.strictEqual(safeEqual(null, 'abc'), false);
    assert.strictEqual(safeEqual('abc', null), false);
  });
});

// Unsubscribe tokens (RFC 8058 List-Unsubscribe one-click). Stateless
// HMAC-signed; ship in every digest email for months. The verify path
// must catch:
//   1. Tamper (sig flipped / body re-encoded with a different user id)
//   2. Cross-user / cross-list confusion (token A doesn't verify as user B)
//   3. Malformed input — return structured failure, not a throw
describe('unsubscribe tokens (makeUnsubToken / verifyUnsubToken)', () => {
  test('roundtrip returns the same userId + listType', () => {
    const tok = makeUnsubToken(42, 'digest');
    const v = verifyUnsubToken(tok);
    assert.strictEqual(v.ok, true);
    assert.strictEqual(v.userId, 42);
    assert.strictEqual(v.listType, 'digest');
    assert.ok(typeof v.issuedAt === 'number' && v.issuedAt > 1.5e9);
  });

  test('different users produce non-colliding tokens', () => {
    const a = makeUnsubToken(1, 'digest');
    const b = makeUnsubToken(2, 'digest');
    assert.notStrictEqual(a, b);
    assert.strictEqual(verifyUnsubToken(a).userId, 1);
    assert.strictEqual(verifyUnsubToken(b).userId, 2);
  });

  test('different list types produce non-colliding tokens', () => {
    const d = makeUnsubToken(7, 'digest');
    const n = makeUnsubToken(7, 'new_review');
    assert.notStrictEqual(d, n);
    assert.strictEqual(verifyUnsubToken(d).listType, 'digest');
    assert.strictEqual(verifyUnsubToken(n).listType, 'new_review');
  });

  test('tampered signature is rejected as reason:sig', () => {
    const tok = makeUnsubToken(42, 'digest');
    const [body, sig] = tok.split('.');
    const flipped = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a');
    const v = verifyUnsubToken(`${body}.${flipped}`);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.reason, 'sig');
  });

  test('forged body (different user) with original sig fails as reason:sig', () => {
    const original = makeUnsubToken(42, 'digest');
    const [, sig] = original.split('.');
    // Forge: claim user 999 — but the sig was signed for user 42.
    const forgedBody = Buffer.from(JSON.stringify({ u: 999, l: 'digest', t: 1 }))
      .toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const v = verifyUnsubToken(`${forgedBody}.${sig}`);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.reason, 'sig');
  });

  test('malformed input (no dot separator) returns reason:malformed', () => {
    assert.strictEqual(verifyUnsubToken('nodothere').reason, 'malformed');
  });

  test('non-string input returns reason:malformed (does not throw)', () => {
    assert.strictEqual(verifyUnsubToken(null).reason, 'malformed');
    assert.strictEqual(verifyUnsubToken(undefined).reason, 'malformed');
    assert.strictEqual(verifyUnsubToken(42).reason, 'malformed');
  });

  test('short sig length is rejected without crash', () => {
    const tok = makeUnsubToken(42, 'digest');
    const [body] = tok.split('.');
    const v = verifyUnsubToken(`${body}.short`);
    assert.strictEqual(v.ok, false);
  });

  test('payload missing required field (l) fails as reason:payload', () => {
    // Properly sign a payload that lacks the required listType field —
    // this exercises the post-verify payload-shape check, not the sig check.
    const crypto = require('crypto');
    const secret = crypto.createHmac('sha256', 'unsub:' + process.env.JWT_SECRET).digest();
    const b64u = (s) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const body = b64u(JSON.stringify({ u: 42 })); // no `l`
    const sig = b64u(crypto.createHmac('sha256', secret).update(body).digest());
    const v = verifyUnsubToken(`${body}.${sig}`);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.reason, 'payload');
  });
});
