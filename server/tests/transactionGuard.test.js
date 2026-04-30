// Regression test for the schema.transaction() helper rejecting async callbacks.
//
// better-sqlite3 transactions are SYNCHRONOUS — they commit the moment the
// callback returns. If the callback is async (returns a Promise), the
// transaction commits BEFORE the awaited work runs, breaking atomicity.
// The helper should detect this and throw loudly so callers can't silently
// corrupt data.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent } = require('./helpers'); // initialises the DB
const { transaction } = require('../src/db/schema');

describe('transaction() async-callback guard', () => {
  before(async () => { await getAgent(); });

  test('sync callback runs and returns its result', () => {
    const result = transaction(() => {
      return 'sync-ok';
    });
    assert.strictEqual(result, 'sync-ok');
  });

  test('callback returning a Promise throws synchronously', () => {
    assert.throws(
      () => transaction(async () => { return 'whatever'; }),
      /async/i,
      'expected an error mentioning async'
    );
  });

  test('callback returning a manual Promise also throws', () => {
    assert.throws(
      () => transaction(() => Promise.resolve('manual')),
      /async/i
    );
  });

  test('callback returning thenable-shaped object also throws', () => {
    assert.throws(
      () => transaction(() => ({ then: () => {} })),
      /async/i
    );
  });
});
