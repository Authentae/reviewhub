// Smoke test for the "posted to Google" badge pipeline.
//
// When REPLY_TO_PLATFORMS includes the review's platform AND the review has
// an external_id AND a platform_connection exists, posting a reply via
// /api/reviews/:id/respond should:
//   1. Call provider.replyToReview()
//   2. SET reviews.response_posted_at on success
//   3. Return success in the API response
//   4. Surface response_posted_at in subsequent GET /reviews
//
// The UI badge in ReviewCard.jsx:979 reads response_posted_at to render
// the "Posted to {platform}" green checkmark. If response_posted_at silently
// stops being set, the badge silently disappears — and the headline feature
// of the paid tier (auto-post replies to Google) appears to be broken even
// when it's actually working.

const { test, describe, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');
const { run, get } = require('../src/db/schema');

describe('posted-to-platform badge pipeline', () => {
  let app;
  before(async () => { app = await getAgent(); });

  // Create a review row directly with an external_id (simulates one that
  // came in from a real platform sync — the manual POST /api/reviews
  // endpoint doesn't accept external_id from the user).
  function insertExternalReview(businessId, platform = 'google') {
    const externalId = 'mock-ext-' + Math.random().toString(36).slice(2, 10);
    run(
      `INSERT INTO reviews
        (business_id, platform, reviewer_name, rating, review_text,
         external_id, created_at, sentiment)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'positive')`,
      [businessId, platform, 'Mock Reviewer', 5, 'Loved it!', externalId]
    );
    return get(
      `SELECT * FROM reviews WHERE business_id = ? AND external_id = ?`,
      [businessId, externalId]
    );
  }

  // Connect a mock-flavored "google" platform connection. In test env
  // (NODE_ENV=test), getProvider() falls back to MockProvider for any
  // unconfigured real provider — so the connection just needs to exist.
  function insertGoogleConnection(businessId) {
    run(
      `INSERT INTO platform_connections
        (business_id, provider, external_account_id, created_at)
       VALUES (?, 'google', 'ChIJ_test_place', datetime('now'))`,
      [businessId]
    );
  }

  beforeEach(() => {
    // Default to "auto-post enabled for google" — matches the prod default
    // when REPLY_TO_PLATFORMS is unset (see CLAUDE.md gotcha).
    delete process.env.REPLY_TO_PLATFORMS;
  });

  after(() => {
    delete process.env.REPLY_TO_PLATFORMS;
  });

  test('happy path: respond → response_posted_at set → badge data flows to GET', async () => {
    const u = await makeUserWithBusiness('Test Co', 'pro');
    insertGoogleConnection(u.businessId);
    const review = insertExternalReview(u.businessId, 'google');

    const resp = await request(app).post(`/api/reviews/${review.id}/respond`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Thank you so much!' });

    assert.strictEqual(resp.status, 200, 'respond endpoint should succeed');

    // Re-fetch to confirm response_posted_at got persisted (the UI badge
    // depends on this column being readable on subsequent GETs, not just
    // present in the in-flight response).
    const fresh = get(`SELECT response_posted_at FROM reviews WHERE id = ?`, [review.id]);
    assert.ok(fresh.response_posted_at, 'response_posted_at must be set after a successful post');

    const list = await request(app).get('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`);
    const found = list.body.reviews.find(r => r.id === review.id);
    assert.ok(found.response_posted_at, 'GET /reviews must surface response_posted_at for badge');
  });

  test('REPLY_TO_PLATFORMS empty string disables auto-post (badge stays blank)', async () => {
    // The opt-out path: setting REPLY_TO_PLATFORMS='' (empty) tells the
    // server "don't post replies anywhere." Useful for staging or
    // pre-launch. The reply still saves, but nothing posts → no badge.
    process.env.REPLY_TO_PLATFORMS = '';
    const u = await makeUserWithBusiness('Test Co', 'pro');
    insertGoogleConnection(u.businessId);
    const review = insertExternalReview(u.businessId, 'google');

    const resp = await request(app).post(`/api/reviews/${review.id}/respond`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Thanks!' });
    assert.strictEqual(resp.status, 200);

    const fresh = get(`SELECT response_posted_at FROM reviews WHERE id = ?`, [review.id]);
    assert.strictEqual(fresh.response_posted_at, null,
      'response_posted_at must NOT be set when auto-post is disabled');
  });

  test('REPLY_TO_PLATFORMS=facebook does not post google replies', async () => {
    // Selective opt-in: only facebook is in the list, so a google review
    // should not trigger a post even though the wiring exists.
    process.env.REPLY_TO_PLATFORMS = 'facebook';
    const u = await makeUserWithBusiness('Test Co', 'pro');
    insertGoogleConnection(u.businessId);
    const review = insertExternalReview(u.businessId, 'google');

    await request(app).post(`/api/reviews/${review.id}/respond`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Thanks!' });

    const fresh = get(`SELECT response_posted_at FROM reviews WHERE id = ?`, [review.id]);
    assert.strictEqual(fresh.response_posted_at, null,
      'google must not post when only facebook is enabled');
  });

  test('review without external_id (manual entry) does not attempt to post', async () => {
    // Manually-created reviews have no external_id (the platform never
    // gave us one). They should reply-save successfully but skip the
    // post-back step entirely — there's nowhere to post TO.
    const u = await makeUserWithBusiness('Test Co', 'pro');
    insertGoogleConnection(u.businessId);
    const create = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Walk-in', rating: 5, review_text: 'Noted in person' });
    const reviewId = create.body.review.id;

    const resp = await request(app).post(`/api/reviews/${reviewId}/respond`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Thanks!' });
    assert.strictEqual(resp.status, 200);

    const fresh = get(`SELECT response_posted_at FROM reviews WHERE id = ?`, [reviewId]);
    assert.strictEqual(fresh.response_posted_at, null,
      'manual-entry review (no external_id) must not get a posted timestamp');
  });
});
