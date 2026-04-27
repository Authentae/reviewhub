// Defensive tests for logAudit — every state-changing route depends on
// it, and a regression that lets it throw would 500 the outer request.
//
// The contract is: logAudit NEVER throws, even when given malformed
// inputs. Regulatory audit rows are best-effort — losing one beats
// failing the request that triggered it.

const test = require('node:test');
const assert = require('node:assert');

const { getAgent } = require('./helpers');
const { logAudit } = require('../src/lib/audit');
const { all } = require('../src/db/schema');

// Force DB init before any logAudit call. getAgent() runs getDb() +
// migrations as a side effect.
let _ready = null;
async function ready() { if (!_ready) _ready = getAgent(); return _ready; }

function fakeReq(overrides = {}) {
  return {
    ip: '192.0.2.1',
    headers: { 'user-agent': 'TestUA/1.0', ...(overrides.headers || {}) },
    socket: {},
    ...overrides,
  };
}

test('logAudit', async (t) => {
  // Suppress the [AUDIT] failed warn lines while we test failure paths.
  const origWarn = console.warn;
  console.warn = () => {};
  t.after(() => { console.warn = origWarn; });

  await ready();

  await t.test('writes a row to audit_log on the happy path', async () => {
    const req = fakeReq();
    logAudit(req, 'test.happy', { userId: null, metadata: { ok: true } });
    const rows = all(`SELECT event, metadata FROM audit_log WHERE event = 'test.happy'`);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(JSON.parse(rows[0].metadata).ok, true);
  });

  await t.test('does not throw with no req', () => {
    assert.doesNotThrow(() => logAudit(null, 'test.no_req'));
  });

  await t.test('does not throw with no opts', () => {
    assert.doesNotThrow(() => logAudit(fakeReq(), 'test.no_opts'));
  });

  await t.test('does not throw with circular-reference metadata', () => {
    const meta = { a: 1 };
    meta.self = meta;
    // JSON.stringify on circular throws — logAudit's outer try/catch must
    // catch it and degrade silently instead of bubbling.
    assert.doesNotThrow(() => logAudit(fakeReq(), 'test.circ', { metadata: meta }));
  });

  await t.test('truncates oversized metadata to MAX_META', () => {
    const huge = { blob: 'x'.repeat(10000) };
    logAudit(fakeReq(), 'test.huge', { metadata: huge });
    const rows = all(`SELECT metadata FROM audit_log WHERE event = 'test.huge'`);
    assert.strictEqual(rows.length, 1);
    // MAX_META is 4000; the slice is on the JSON string, not the object,
    // so the stored value MUST be ≤4000 chars. JSON.parse on a truncated
    // value will likely throw — we don't read it back, just assert size.
    assert.ok(rows[0].metadata.length <= 4000);
  });

  await t.test('truncates oversized user-agent', () => {
    const longUa = 'A'.repeat(2000);
    const req = fakeReq({ headers: { 'user-agent': longUa } });
    logAudit(req, 'test.long_ua');
    const rows = all(`SELECT user_agent FROM audit_log WHERE event = 'test.long_ua'`);
    assert.strictEqual(rows.length, 1);
    // MAX_UA is 500
    assert.ok(rows[0].user_agent.length <= 500);
  });
});
