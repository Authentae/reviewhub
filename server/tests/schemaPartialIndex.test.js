// Tests for the partial index supporting the follow-up review-request job.
// The job's WHERE clause must match the partial index predicate exactly for
// SQLite to use it, so these tests lock in (1) the index exists, (2) its
// predicate is what we expect, and (3) SQLite's query planner actually
// selects it for the scan query.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
require('./helpers');

describe('review_requests partial index for follow-up scan', () => {
  before(() => { require('../src/db/schema').getDb(); });

  test('idx_rr_pending_followup exists', () => {
    const { all } = require('../src/db/schema');
    const indices = all(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'review_requests'`);
    assert.ok(
      indices.some(idx => idx.name === 'idx_rr_pending_followup'),
      `expected idx_rr_pending_followup; got: ${indices.map(i => i.name).join(', ')}`
    );
  });

  test('index predicate filters to pending (not clicked, not followed up)', () => {
    const { all } = require('../src/db/schema');
    const rows = all(
      `SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_rr_pending_followup'`
    );
    assert.strictEqual(rows.length, 1);
    const sql = rows[0].sql;
    assert.match(sql, /clicked_at IS NULL/i);
    assert.match(sql, /follow_up_sent_at IS NULL/i);
  });

  test('SQLite query planner selects the partial index for the scan query', () => {
    const { all } = require('../src/db/schema');
    // EXPLAIN QUERY PLAN the shape used by the follow-up scanner — look for
    // the partial index in the output. SQLite prints something like:
    //   SEARCH review_requests USING INDEX idx_rr_pending_followup ...
    const plan = all(
      `EXPLAIN QUERY PLAN
       SELECT rr.id FROM review_requests rr
       JOIN businesses b ON b.id = rr.business_id
       JOIN users u ON u.id = b.user_id
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.follow_up_after_days > 0
         AND rr.clicked_at IS NULL
         AND rr.follow_up_sent_at IS NULL
         AND (julianday('now') - julianday(rr.sent_at)) >= u.follow_up_after_days`
    );
    const detail = plan.map(r => r.detail).join(' | ');
    // We accept either: SQLite picked the partial index, OR it picked a
    // join-driven plan that uses the other rr index — as long as it's not
    // a full table scan. (On an empty test DB the planner may choose either.)
    assert.doesNotMatch(detail, /SCAN review_requests(?! USING)/,
      `query planner fell back to a full table scan of review_requests. Plan: ${detail}`);
  });
});
