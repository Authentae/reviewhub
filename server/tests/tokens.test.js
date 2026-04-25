// Unit tests for the token helpers. No DB required.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { generateToken, hashToken, safeEqual } = require('../src/lib/tokens');

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
