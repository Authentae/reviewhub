// Tests for the one-shot follow-up backfill migration.
//
// The migration runs inside getDb()'s migration block and is idempotent via
// the schema_meta flag 'follow_up_backfill_v1'. Because the test helpers
// boot the DB once per process, we can't test "first boot after upgrade"
// directly — instead we simulate it: insert an unstamped old request,
// delete the flag, re-run the migration logic, and verify the stamp lands.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('follow-up backfill migration', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function setBiz(u) {
    const { run } = require('../src/db/schema');
    run(`UPDATE businesses SET google_place_id = 'ChIJbackfill' WHERE user_id = ?`, [u.userId]);
  }

  test('schema_meta table exists after migration', () => {
    const { get } = require('../src/db/schema');
    const row = get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'`);
    assert.ok(row, 'schema_meta table should exist');
  });

  test('follow_up_backfill_v1 flag has been written', () => {
    const { get } = require('../src/db/schema');
    const row = get(`SELECT value FROM schema_meta WHERE key = 'follow_up_backfill_v1'`);
    assert.ok(row, 'backfill flag must be recorded');
    // value is the count of rows stamped — on a fresh test DB this is 0 or a small number
    assert.match(String(row.value), /^\d+$/, 'flag value should be a count');
  });

  test('simulated first-boot stamps old unstamped requests', async () => {
    const { run, get, getDb } = require('../src/db/schema');
    const db = await getDb();
    {
      const u = await makeUserWithBusiness('Backfill Co');
      await setBiz(u);
      const sent = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
        .send({ customer_name: 'Old', customer_email: 'old@x.com', platform: 'google' });
      // Make it ancient AND clear any existing stamp
      run("UPDATE review_requests SET sent_at = datetime('now', '-60 days'), follow_up_sent_at = NULL WHERE id = ?", [sent.body.id]);
      // Remove the idempotency flag so we can re-run the migration body
      run(`DELETE FROM schema_meta WHERE key = 'follow_up_backfill_v1'`);

      // Re-run the one-shot logic inline (same statement as in schema.js)
      const info = db.prepare(
        `UPDATE review_requests
           SET follow_up_sent_at = datetime('now')
         WHERE follow_up_sent_at IS NULL
           AND clicked_at IS NULL
           AND sent_at < datetime('now', '-30 days')`
      ).run();
      assert.ok(info.changes >= 1, 'backfill should stamp at least the ancient request');

      const after = get('SELECT follow_up_sent_at FROM review_requests WHERE id = ?', [sent.body.id]);
      assert.ok(after.follow_up_sent_at, 'ancient request should now be stamped');

      // Restore the flag so other tests see a consistent state
      db.prepare(`INSERT INTO schema_meta (key, value) VALUES ('follow_up_backfill_v1', ?)`).run(String(info.changes));
    }
  });

  test('backfill does NOT stamp recent unstamped requests', async () => {
    const { run, get } = require('../src/db/schema');
    const u = await makeUserWithBusiness('Recent Co');
    await setBiz(u);
    const sent = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'Recent', customer_email: 'recent@x.com', platform: 'google' });
    // Only 5 days old — below the 30-day backfill threshold
    run("UPDATE review_requests SET sent_at = datetime('now', '-5 days'), follow_up_sent_at = NULL WHERE id = ?", [sent.body.id]);

    const { getDb } = require('../src/db/schema');
    (await getDb()).prepare(
      `UPDATE review_requests SET follow_up_sent_at = datetime('now')
       WHERE follow_up_sent_at IS NULL AND clicked_at IS NULL AND sent_at < datetime('now', '-30 days')`
    ).run();

    const after = get('SELECT follow_up_sent_at FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.strictEqual(after.follow_up_sent_at, null, 'recent request must not be stamped');
  });
});
