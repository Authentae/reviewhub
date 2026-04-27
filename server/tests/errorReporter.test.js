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
});
