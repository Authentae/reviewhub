// Tests for the scheduled-reply-send feature.
//
// Covers two surfaces:
//   1. POST /reviews/:id/respond accepts scheduled_post_at, validates
//      it (ISO, future, max 90d), suppresses immediate post.
//   2. The cron job picks up due rows, posts via provider, sets
//      response_posted_at, clears scheduled_post_at.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request, makeUserWithBusiness } = require('./helpers');

describe('POST /api/reviews/:id/respond — scheduled_post_at handling', () => {
  let app;
  let user;
  let reviewId;

  before(async () => {
    app = await getAgent();
    user = await makeUserWithBusiness('Schedule Test Co');
    // Insert a review directly via DB so we have something to respond to
    const { insert } = require('../src/db/schema');
    reviewId = insert(
      `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment, created_at)
       VALUES (?, 'google', 'Alice', 5, 'Great place', 'positive', datetime('now'))`,
      [user.businessId]
    );
  });

  test('rejects malformed scheduled_post_at', async () => {
    const r = await request(app)
      .post(`/api/reviews/${reviewId}/respond`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ response_text: 'Thanks!', scheduled_post_at: 'not-a-date' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /ISO 8601/);
  });

  test('rejects past scheduled_post_at', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const r = await request(app)
      .post(`/api/reviews/${reviewId}/respond`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ response_text: 'Thanks!', scheduled_post_at: past });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /past/);
  });

  test('rejects scheduled_post_at >90 days out', async () => {
    const farFuture = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString();
    const r = await request(app)
      .post(`/api/reviews/${reviewId}/respond`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ response_text: 'Thanks!', scheduled_post_at: farFuture });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /90 days/);
  });

  test('valid future scheduled_post_at saves and suppresses immediate post', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const r = await request(app)
      .post(`/api/reviews/${reviewId}/respond`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ response_text: 'Thanks for stopping by!', scheduled_post_at: future });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.posted, false, 'immediate post must be suppressed');
    assert.ok(r.body.scheduled_post_at, 'scheduled_post_at echoed back');

    const { get } = require('../src/db/schema');
    const row = get(`SELECT response_text, scheduled_post_at, response_posted_at FROM reviews WHERE id = ?`, [reviewId]);
    assert.strictEqual(row.response_text, 'Thanks for stopping by!');
    assert.ok(row.scheduled_post_at);
    assert.strictEqual(row.response_posted_at, null);
  });

  test('omitting scheduled_post_at preserves the legacy immediate-post flow', async () => {
    // Fresh review for this case
    const { insert, get } = require('../src/db/schema');
    const id = insert(
      `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment, created_at)
       VALUES (?, 'google', 'Bob', 4, 'Pretty good', 'positive', datetime('now'))`,
      [user.businessId]
    );

    const r = await request(app)
      .post(`/api/reviews/${id}/respond`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ response_text: 'Thanks Bob!' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.scheduled_post_at, null);

    const row = get(`SELECT scheduled_post_at FROM reviews WHERE id = ?`, [id]);
    assert.strictEqual(row.scheduled_post_at, null);
  });
});

describe('Scheduled reply poster cron', () => {
  let app;
  let user;

  before(async () => {
    app = await getAgent();
    user = await makeUserWithBusiness('Cron Test Co');
  });

  function insertReview(extras = {}) {
    const { insert } = require('../src/db/schema');
    return insert(
      `INSERT INTO reviews (business_id, platform, external_id, reviewer_name, rating, review_text, sentiment, created_at)
       VALUES (?, 'google', ?, 'Test', 5, 'Great', 'positive', datetime('now'))`,
      [user.businessId, extras.external_id || 'ext-' + Math.random().toString(36).slice(2)]
    );
  }

  function setScheduled(reviewId, hoursOffset, text = 'Reply') {
    const { run } = require('../src/db/schema');
    run(
      `UPDATE reviews
          SET response_text = ?,
              scheduled_post_at = datetime('now', '+' || ? || ' hours'),
              responded_at = datetime('now')
        WHERE id = ?`,
      [text, hoursOffset, reviewId]
    );
  }

  function readRow(id) {
    const { get } = require('../src/db/schema');
    return get(`SELECT * FROM reviews WHERE id = ?`, [id]);
  }

  test('skips rows with future scheduled_post_at', async () => {
    const id = insertReview();
    setScheduled(id, 1); // 1h in the future

    const { runScheduledReplyPoster } = require('../src/jobs/scheduledReplyPoster');
    const result = await runScheduledReplyPoster();

    assert.strictEqual(result.sent, 0);
    const row = readRow(id);
    assert.strictEqual(row.response_posted_at, null, 'should not have posted');
    assert.ok(row.scheduled_post_at, 'should still be queued');
  });

  test('clears schedule when platform has no provider connection (no-op rather than retry forever)', async () => {
    const id = insertReview();
    setScheduled(id, -1); // 1h in the past — due

    const { runScheduledReplyPoster } = require('../src/jobs/scheduledReplyPoster');
    await runScheduledReplyPoster();

    const row = readRow(id);
    assert.strictEqual(row.scheduled_post_at, null,
      'no platform_connection → schedule should clear');
    assert.strictEqual(row.response_posted_at, null,
      'no provider call happened → posted_at stays null');
  });

  test('REPLY_TO_PLATFORMS="" suppresses cron posting entirely', async () => {
    const id = insertReview();
    setScheduled(id, -2);

    process.env.REPLY_TO_PLATFORMS = '';
    try {
      const { runScheduledReplyPoster } = require('../src/jobs/scheduledReplyPoster');
      await runScheduledReplyPoster();

      const row = readRow(id);
      // Schedule cleared (no point retrying when explicitly disabled)
      // but no post happened
      assert.strictEqual(row.scheduled_post_at, null);
      assert.strictEqual(row.response_posted_at, null);
    } finally {
      delete process.env.REPLY_TO_PLATFORMS;
    }
  });

  test('rows missing external_id are skipped (cleared, not retried)', async () => {
    // Insert a review without external_id (locally-imported, not from a provider)
    const { insert, run } = require('../src/db/schema');
    const id = insert(
      `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment, created_at)
       VALUES (?, 'google', 'NoExt', 5, 'Local', 'positive', datetime('now'))`,
      [user.businessId]
    );
    run(
      `UPDATE reviews
          SET response_text = 'Reply',
              scheduled_post_at = datetime('now', '-1 hour'),
              external_id = NULL
        WHERE id = ?`,
      [id]
    );

    const { runScheduledReplyPoster } = require('../src/jobs/scheduledReplyPoster');
    await runScheduledReplyPoster();

    const row = readRow(id);
    assert.strictEqual(row.scheduled_post_at, null,
      'no external_id → schedule should clear so we don\'t loop');
    assert.strictEqual(row.response_posted_at, null,
      'no post happened');
  });
});
