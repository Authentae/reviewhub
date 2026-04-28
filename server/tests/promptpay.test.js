// PromptPay payload tests.
//
// Lock down the EMVCo QR format so a future refactor can't silently
// produce a payload that Thai banking apps reject. Reference values
// generated against the BOT spec + cross-checked with promptpay.io
// (a popular open-source generator).

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { buildPayload, normalizeId, crc16, isConfigured } = require('../src/lib/promptpay');

describe('PromptPay', () => {
  test('crc16 matches CCITT-FALSE for known vector', () => {
    // Reference: ANSI/EMV crc check on '123456789' is 0x29B1.
    assert.equal(crc16('123456789'), '29B1');
  });

  test('normalizeId converts 10-digit Thai mobile to BBAN', () => {
    assert.equal(normalizeId('0812345678'), '0066812345678');
    assert.equal(normalizeId('081-234-5678'), '0066812345678');
  });

  test('normalizeId leaves 13-digit citizen ID unchanged', () => {
    assert.equal(normalizeId('1234567890123'), '1234567890123');
  });

  test('normalizeId rejects bad input', () => {
    assert.equal(normalizeId(''), null);
    assert.equal(normalizeId('123'), null);
    assert.equal(normalizeId(null), null);
    assert.equal(normalizeId(undefined), null);
  });

  test('buildPayload returns null for invalid id', () => {
    assert.equal(buildPayload({ id: 'notanumber' }), null);
  });

  test('buildPayload static QR (no amount) starts with format + 11', () => {
    const out = buildPayload({ id: '0812345678' });
    // 0002 01 = payload format indicator (tag 00, len 02, val 01)
    // 0102 11 = point-of-init method (tag 01, len 02, val 11 = static)
    assert.match(out, /^000201010211/);
    assert.match(out, /29\d{2}0016A000000677010111/); // PromptPay AID
    assert.match(out, /6304[0-9A-F]{4}$/); // CRC tail
  });

  test('buildPayload dynamic QR encodes amount with 2 decimals', () => {
    const out = buildPayload({ id: '0812345678', amount: 14 });
    assert.match(out, /^000201010212/); // 12 = dynamic
    assert.match(out, /540514\.00/);     // tag 54, length 05, "14.00"
  });

  test('buildPayload encodes amount 14.50 correctly', () => {
    const out = buildPayload({ id: '0812345678', amount: 14.5 });
    assert.match(out, /540514\.50/);
  });

  test('buildPayload includes country code TH and currency 764', () => {
    const out = buildPayload({ id: '0812345678' });
    assert.match(out, /5303764/);  // currency: THB
    assert.match(out, /5802TH/);   // country: TH
  });

  test('CRC at the end is valid for a sample payload', () => {
    const out = buildPayload({ id: '0812345678', amount: 29 });
    // Recompute CRC over everything except the trailing 4 chars.
    const head = out.slice(0, -4);
    const tail = out.slice(-4);
    assert.equal(crc16(head), tail);
  });

  test('isConfigured flips with PROMPTPAY_ID env', () => {
    const original = process.env.PROMPTPAY_ID;
    try {
      delete process.env.PROMPTPAY_ID;
      assert.equal(isConfigured(), false);
      process.env.PROMPTPAY_ID = '';
      assert.equal(isConfigured(), false);
      process.env.PROMPTPAY_ID = '0812345678';
      assert.equal(isConfigured(), true);
      process.env.PROMPTPAY_ID = 'not-a-number';
      assert.equal(isConfigured(), false);
    } finally {
      if (original) process.env.PROMPTPAY_ID = original;
      else delete process.env.PROMPTPAY_ID;
    }
  });
});
