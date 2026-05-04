// Defensive tests for the error reporter. The reporter is the LAST line
// of the observability stack — if it ever throws, the original error
// (already known to be problematic) gets swallowed without trace.

const test = require('node:test');
const assert = require('node:assert');

require('./helpers'); // sets NODE_ENV=test, neutralises SMTP

const { captureException } = require('../src/lib/errorReporter');

test('errorReporter', async (t) => {
  // Suppress console.error noise during these tests — the reporter
  // legitimately writes there in dev mode.
  const origErr = console.error;
  console.error = () => {};
  t.after(() => { console.error = origErr; });

  await t.test('does not throw on a normal Error', () => {
    assert.doesNotThrow(() => captureException(new Error('boom'), { route: 'unit' }));
  });

  await t.test('does not throw on a non-Error value', () => {
    assert.doesNotThrow(() => captureException('string error', { route: 'unit' }));
    assert.doesNotThrow(() => captureException(null));
    assert.doesNotThrow(() => captureException(undefined));
    assert.doesNotThrow(() => captureException({ message: 'plain object' }));
  });

  await t.test('does not throw with a malformed SENTRY_DSN', () => {
    const orig = process.env.SENTRY_DSN;
    process.env.SENTRY_DSN = 'not-a-valid-dsn';
    try {
      assert.doesNotThrow(() => captureException(new Error('test'), { route: 'unit' }));
    } finally {
      if (orig === undefined) delete process.env.SENTRY_DSN;
      else process.env.SENTRY_DSN = orig;
    }
  });

  await t.test('does not throw with a circular-reference context', () => {
    const ctx = { route: 'unit' };
    ctx.self = ctx;
    // The reporter shouldn't try to JSON.stringify the context as a whole;
    // if it did, this would throw "Converting circular structure to JSON".
    assert.doesNotThrow(() => captureException(new Error('circ'), ctx));
  });

  // Pre-Sentry connectivity proof — without this, "is the forwarder
  // actually working" requires triggering a real prod error and waiting
  // for it to (or not to) appear in Sentry's Issues feed. Mock fetch
  // and assert the envelope is built correctly.
  await t.test('forwards a well-formed envelope to Sentry when DSN is set', async () => {
    const calls = [];
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, status: 200, text: async () => '' };
    };
    const origDsn = process.env.SENTRY_DSN;
    process.env.SENTRY_DSN = 'https://abc123def456@o42.ingest.sentry.io/9999';
    try {
      captureException(new Error('forwarder smoke test'), { route: 'unit', kind: 'test' });
      // Flush — forwardToSentry is fire-and-forget so the fetch is
      // scheduled on the microtask queue. Awaiting two macroticks
      // gives it time to fire.
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      global.fetch = origFetch;
      if (origDsn === undefined) delete process.env.SENTRY_DSN;
      else process.env.SENTRY_DSN = origDsn;
    }

    assert.strictEqual(calls.length, 1, 'expected exactly one envelope POST');
    const { url, opts } = calls[0];

    // Envelope endpoint format
    assert.strictEqual(url, 'https://o42.ingest.sentry.io/api/9999/envelope/',
      'envelope URL must match Sentry spec (NOT the deprecated /store/ endpoint)');
    assert.strictEqual(opts.method, 'POST');
    assert.strictEqual(opts.headers['Content-Type'], 'application/x-sentry-envelope');

    // Auth header carries the public key from the DSN
    const auth = opts.headers['X-Sentry-Auth'];
    assert.ok(auth.includes('sentry_key=abc123def456'), `auth header must carry public key, got: ${auth}`);
    assert.ok(auth.includes('sentry_version=7'));

    // Envelope body: 3 NDJSON lines (header / item header / event payload)
    const lines = opts.body.split('\n').filter(Boolean);
    assert.strictEqual(lines.length, 3, 'envelope must be exactly 3 NDJSON lines');
    const envelopeHeader = JSON.parse(lines[0]);
    const itemHeader = JSON.parse(lines[1]);
    const event = JSON.parse(lines[2]);

    // event_id present, 32-char hex
    assert.match(envelopeHeader.event_id, /^[a-f0-9]{32}$/);
    assert.strictEqual(itemHeader.type, 'event');
    assert.strictEqual(itemHeader.content_type, 'application/json');

    // Event payload has the actual error info Sentry needs to render
    assert.strictEqual(event.platform, 'node');
    assert.strictEqual(event.level, 'error');
    assert.strictEqual(event.exception.values[0].value, 'forwarder smoke test');
    assert.strictEqual(event.tags.kind, 'test');
    assert.strictEqual(event.extra.route, 'unit');
  });

  await t.test('skips forward (no fetch call) when SENTRY_DSN is unset', async () => {
    const calls = [];
    const origFetch = global.fetch;
    global.fetch = async (...args) => { calls.push(args); return { ok: true }; };
    const origDsn = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    try {
      captureException(new Error('no-dsn'), { route: 'unit' });
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      global.fetch = origFetch;
      if (origDsn !== undefined) process.env.SENTRY_DSN = origDsn;
    }
    assert.strictEqual(calls.length, 0, 'must not call fetch when DSN is unset');
  });
});
