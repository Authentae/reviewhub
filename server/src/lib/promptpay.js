// PromptPay QR generation (Thailand).
//
// PromptPay is the Bank of Thailand's instant-transfer rail. Every Thai
// bank account holder has a PromptPay ID — usually their phone number
// (formatted as 13-digit BBAN: 0066 + last 9 digits) or 13-digit citizen
// ID. Showing a PromptPay QR on the upgrade screen lets Thai customers
// pay directly from any banking app (SCB, Kbank, Krungsri, Bangkok Bank,
// Krungthai, etc.) without going through a card processor — which is
// huge for the Thai market because card adoption is low and per-tx fees
// on local cards are high.
//
// This module produces the EMVCo-spec payload string that every Thai
// banking app recognises. The payload is rendered to a QR client-side
// (qrcode.js or similar). We don't render the QR itself here — keeps
// this lib zero-dep and identical between server (for receipts) and
// any future client mirror.
//
// Format reference: https://www.bot.or.th/en/financial-innovation/digital-finance/digital-payment/standardised-qr-code.html
//
// Inert until PROMPTPAY_ID is set. The /api/billing/promptpay endpoint
// returns 501 when unconfigured so the client can hide the option.
//
// SETUP (when ready):
//   PROMPTPAY_ID=0812345678        (your phone number — 10-digit Thai mobile)
//   or
//   PROMPTPAY_ID=1234567890123     (your 13-digit Thai citizen ID)
//   PROMPTPAY_NAME="ReviewHub"     (optional — shown on the receiver's app)

const CRC_TABLE = (() => {
  // Precomputed CRC-16 (CCITT-FALSE, poly 0x1021, init 0xFFFF) lookup —
  // 256-entry table built once at module load. EMVCo QRs require this exact
  // CRC variant in their final 4-char "63" tag.
  const t = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 8;
    for (let j = 0; j < 8; j++) {
      c = (c & 0x8000) ? ((c << 1) ^ 0x1021) : (c << 1);
    }
    t[i] = c & 0xFFFF;
  }
  return t;
})();

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >> 8) ^ str.charCodeAt(i)) & 0xFF]) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// EMVCo TLV: ID + length-prefix-2 + value
function tlv(id, value) {
  const v = String(value);
  return id + v.length.toString().padStart(2, '0') + v;
}

/**
 * Normalize a Thai mobile / citizen ID into the PromptPay BBAN format.
 *  - 10-digit mobile (0812345678 or 0066812345678) → 13 chars: '0066' + last 9
 *  - 13-digit citizen ID → unchanged
 */
function normalizeId(idRaw) {
  const id = String(idRaw || '').replace(/[^0-9]/g, '');
  if (!id) return null;
  if (id.length === 13) return id;       // citizen ID
  if (id.length === 10 && id.startsWith('0')) {
    return '0066' + id.slice(1); // strip leading 0, prepend country code
  }
  if (id.length === 12 && id.startsWith('66')) {
    return '00' + id;            // already country-coded, missing two zeros
  }
  return null;
}

/**
 * Build a PromptPay QR payload string.
 *
 * @param {object} opts
 * @param {string} opts.id - PromptPay receiver ID (phone or citizen ID)
 * @param {number} [opts.amount] - Amount in THB. Omit for "any amount" QR.
 * @returns {string|null} EMVCo QR payload, or null if id is invalid.
 */
function buildPayload({ id, amount }) {
  const targetId = normalizeId(id);
  if (!targetId) return null;

  // Tag 29 = merchant account info (PromptPay).
  // 00 = AID, 01 = mobile/citizen ID receiver.
  const merchantInfo =
    tlv('00', 'A000000677010111') + // PromptPay AID
    tlv('01', targetId);

  let payload =
    tlv('00', '01') +                                        // Payload format indicator
    tlv('01', amount ? '12' : '11') +                        // Static (11) vs Dynamic (12) QR
    tlv('29', merchantInfo) +                                // PromptPay merchant info
    tlv('53', '764') +                                       // Currency code: THB
    (amount ? tlv('54', Number(amount).toFixed(2)) : '') +   // Transaction amount
    tlv('58', 'TH');                                         // Country code

  // CRC tag (63) is itself part of the CRC input — append the tag header
  // first ("6304"), compute CRC over everything-so-far, then append.
  payload += '6304';
  return payload + crc16(payload);
}

function isConfigured() {
  return !!process.env.PROMPTPAY_ID && !!normalizeId(process.env.PROMPTPAY_ID);
}

module.exports = {
  buildPayload,
  normalizeId,
  isConfigured,
  // exported for tests
  crc16,
};
