// Tests for lib/audit.js — the audit log helper.
//
// Critical because:
//   1. Best-effort guarantee — audit failures must NEVER bubble into the
//      underlying request flow. A bug here would silently 500 logins,
//      password resets, billing webhooks etc.
//   2. Truncation — IP / UA / metadata are size-clamped to resist log
//      bloat from giant headers and to keep audit_log query speeds sane
//   3. IP extraction respects `trust proxy` semantics (req.ip first,
//      socket fallback) — a regression here would silently log
//      every request as `::ffff:127.0.0.1` from behind the Railway proxy
//   4. JSON metadata serialisation — metadata bag is callsite-controlled
//      so the helper must handle arbitrary nested shapes

const { test, describe, before } = require('node:test');
const assert = require('node:assert');

// Pull in helpers to set up DATABASE_PATH + schema before requiring audit.
const { getAgent, makeUser } = require('./helpers');

const { logAudit } = require('../src/lib/audit');
const { all, get } = require('../src/db/schema');

// Shared real user — FK constraint on audit_log.user_id requires an
// actual users row. Created once in before(); reused by every test that
// needs a userId.
let testUserId = null;

// Minimal mock Express req — only the fields lib/audit.js touches.
function mockReq({ ip, socketIp, ua } = {}) {
  return {
    ip: ip || undefined,
    socket: socketIp ? { remoteAddress: socketIp } : undefined,
    headers: ua ? { 'user-agent': ua } : {},
  };
}

describe('lib/audit.logAudit', () => {
  // Force the DB + schema to be initialised before any test runs the
  // sync get()/run() against audit_log. getAgent() lazy-creates the
  // singleton DB on first call.
  before(async () => {
    await getAgent();
    const u = await makeUser();
    testUserId = u.userId;
  });

  test('writes a row with event, user_id, ip, ua, metadata', () => {
    const evt = `test.basic-${Date.now()}`;
    logAudit(mockReq({ ip: '203.0.113.5', ua: 'Mozilla/5.0 (TestBrowser)' }), evt, {
      userId: testUserId,
      metadata: { foo: 'bar' },
    });
    const row = get('SELECT * FROM audit_log WHERE event = ?', [evt]);
    assert.ok(row, 'audit row should exist');
    assert.strictEqual(row.event, evt);
    assert.strictEqual(row.user_id, testUserId);
    assert.strictEqual(row.ip, '203.0.113.5');
    assert.strictEqual(row.user_agent, 'Mozilla/5.0 (TestBrowser)');
    assert.strictEqual(row.metadata, '{"foo":"bar"}');
  });

  test('writes user_id NULL when not provided (pre-auth events)', () => {
    const evt = `test.preauth-${Date.now()}`;
    logAudit(mockReq({ ip: '203.0.113.6' }), evt);
    const row = get('SELECT user_id FROM audit_log WHERE event = ?', [evt]);
    assert.strictEqual(row.user_id, null);
  });

  test('falls back to socket.remoteAddress when req.ip is missing', () => {
    const evt = `test.sock-fallback-${Date.now()}`;
    logAudit(mockReq({ socketIp: '198.51.100.7', ua: 'X' }), evt);
    const row = get('SELECT ip FROM audit_log WHERE event = ?', [evt]);
    assert.strictEqual(row.ip, '198.51.100.7');
  });

  test('records ip NULL when neither req.ip nor socket address is present', () => {
    const evt = `test.no-ip-${Date.now()}`;
    logAudit(mockReq({ ua: 'X' }), evt);
    const row = get('SELECT ip FROM audit_log WHERE event = ?', [evt]);
    assert.strictEqual(row.ip, null);
  });

  test('records ua NULL when User-Agent header is missing', () => {
    const evt = `test.no-ua-${Date.now()}`;
    logAudit(mockReq({ ip: '203.0.113.8' }), evt);
    const row = get('SELECT user_agent FROM audit_log WHERE event = ?', [evt]);
    assert.strictEqual(row.user_agent, null);
  });

  test('truncates user_agent to 500 chars', () => {
    const evt = `test.ua-truncate-${Date.now()}`;
    const longUa = 'A'.repeat(1500);
    logAudit(mockReq({ ip: '203.0.113.9', ua: longUa }), evt);
    const row = get('SELECT user_agent FROM audit_log WHERE event = ?', [evt]);
    assert.ok(row.user_agent.length <= 500, `ua should be <=500, got ${row.user_agent.length}`);
  });

  test('truncates ip to 64 chars (defensive against IPv6 + zone-id pathologies)', () => {
    const evt = `test.ip-truncate-${Date.now()}`;
    const weirdIp = 'fe80:0000:0000:0000:0000:0000:0000:0001%LongInterfaceNameThatShouldNotMatter';
    logAudit(mockReq({ ip: weirdIp, ua: 'X' }), evt);
    const row = get('SELECT ip FROM audit_log WHERE event = ?', [evt]);
    assert.ok(row.ip.length <= 64, `ip should be <=64, got ${row.ip.length}`);
  });

  test('truncates metadata JSON to 4000 chars', () => {
    const evt = `test.meta-truncate-${Date.now()}`;
    const bigBag = { lotsOfData: 'x'.repeat(8000) };
    logAudit(mockReq({ ip: '203.0.113.10' }), evt, { userId: 1, metadata: bigBag });
    const row = get('SELECT metadata FROM audit_log WHERE event = ?', [evt]);
    assert.ok(row.metadata.length <= 4000, `metadata should be <=4000, got ${row.metadata.length}`);
  });

  test('does NOT throw when called with req=null (non-request context)', () => {
    const evt = `test.no-req-${Date.now()}`;
    // Should not throw.
    logAudit(null, evt, { userId: testUserId });
    const row = get('SELECT ip, user_agent, user_id FROM audit_log WHERE event = ?', [evt]);
    assert.ok(row, 'row should still be written even without req');
    assert.strictEqual(row.ip, null);
    assert.strictEqual(row.user_agent, null);
    assert.strictEqual(row.user_id, testUserId);
  });

  test('best-effort: swallows DB errors instead of throwing', () => {
    // Force a failure by passing a bogus metadata shape that JSON.stringify
    // can't handle — circular reference. logAudit must swallow + warn.
    const evt = `test.swallow-${Date.now()}`;
    const circular = {};
    circular.self = circular;
    // Capture the warn so the test output stays clean.
    const origWarn = console.warn;
    let warned = false;
    console.warn = () => { warned = true; };
    try {
      // MUST NOT throw.
      logAudit(mockReq({ ip: '203.0.113.11' }), evt, { metadata: circular });
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warned, 'should have warned about the failure');
  });

  test('serialises non-trivial metadata (nested object, array)', () => {
    const evt = `test.nested-meta-${Date.now()}`;
    logAudit(mockReq({ ip: '203.0.113.12' }), evt, {
      userId: testUserId,
      metadata: { reason: 'rotate', tokens: ['a', 'b'], nested: { plan: 'pro', n: 3 } },
    });
    const row = get('SELECT metadata FROM audit_log WHERE event = ?', [evt]);
    const parsed = JSON.parse(row.metadata);
    assert.strictEqual(parsed.reason, 'rotate');
    assert.deepStrictEqual(parsed.tokens, ['a', 'b']);
    assert.strictEqual(parsed.nested.plan, 'pro');
    assert.strictEqual(parsed.nested.n, 3);
  });

  test('writes metadata NULL when opts.metadata is omitted', () => {
    const evt = `test.no-meta-${Date.now()}`;
    logAudit(mockReq({ ip: '203.0.113.13' }), evt, { userId: testUserId });
    const row = get('SELECT metadata FROM audit_log WHERE event = ?', [evt]);
    assert.strictEqual(row.metadata, null);
  });
});
