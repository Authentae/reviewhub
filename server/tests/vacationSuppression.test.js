// Vacation suppression — assert that creating a review during an active
// vacation window (business.vacation_until >= today) does NOT trigger
// the new-review email or LINE notification.
//
// Why this matters: the founder closes the restaurant for a 2-week trip,
// sets vacation mode, expects to come back to a clean inbox. If the
// suppression silently breaks (e.g. someone refactors the
// `onVacation` check in routes/reviews.js), the founder gets paged 50
// times during their vacation and trust collapses. Worth a test.

const { test, describe, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');
const { run } = require('../src/db/schema');

// Spy on the email + LINE modules. Both are required inline by routes/
// reviews.js, so we monkey-patch their exported functions to count calls
// without restructuring production code. Restored in beforeEach.
const emailLib = require('../src/lib/email');
const lineLib = require('../src/lib/notifications/line');

let emailCalls = [];
let lineCalls = [];
const _origEmail = emailLib.sendNewReviewNotification;
const _origLine = lineLib.notifyNewReview;

emailLib.sendNewReviewNotification = async (...args) => {
  emailCalls.push(args);
  return _origEmail.apply(emailLib, args);
};
lineLib.notifyNewReview = (...args) => {
  lineCalls.push(args);
  return _origLine.apply(lineLib, args);
};

after(() => {
  // Restore originals so subsequent test files aren't affected.
  emailLib.sendNewReviewNotification = _origEmail;
  lineLib.notifyNewReview = _origLine;
});

describe('vacation suppression', () => {
  let app;
  before(async () => { app = await getAgent(); });

  beforeEach(() => {
    emailCalls = [];
    lineCalls = [];
  });

  function setVacationUntil(businessId, isoDate) {
    // Direct DB write — bypasses the PUT validation so we can also test
    // edge cases (e.g. yesterday's date) that the API would reject.
    run('UPDATE businesses SET vacation_until = ? WHERE id = ?', [isoDate, businessId]);
  }

  async function postReview(token) {
    return request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'google', reviewer_name: 'Tourist', rating: 5, review_text: 'Great!' });
  }

  test('NO vacation set → email + LINE notification fire', async () => {
    const u = await makeUserWithBusiness('Test Co', 'pro');
    const res = await postReview(u.token);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(emailCalls.length, 1, 'expected 1 new-review email');
    assert.strictEqual(lineCalls.length, 1, 'expected 1 LINE notification');
  });

  test('vacation_until = today → both notifications suppressed', async () => {
    const u = await makeUserWithBusiness('Test Co', 'pro');
    const todayIso = new Date().toISOString().slice(0, 10);
    setVacationUntil(u.businessId, todayIso);

    await postReview(u.token);

    assert.strictEqual(emailCalls.length, 0, 'expected NO email during vacation');
    assert.strictEqual(lineCalls.length, 0, 'expected NO LINE during vacation');
  });

  test('vacation_until = future date → both notifications suppressed', async () => {
    const u = await makeUserWithBusiness('Test Co', 'pro');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    setVacationUntil(u.businessId, futureDate.toISOString().slice(0, 10));

    await postReview(u.token);

    assert.strictEqual(emailCalls.length, 0);
    assert.strictEqual(lineCalls.length, 0);
  });

  test('vacation_until = yesterday → notifications fire normally (vacation expired)', async () => {
    // The check is `business.vacation_until >= todayIso` — yesterday is <
    // today so suppression should NOT apply. Important guard against an
    // off-by-one where stale vacation values would silently keep
    // suppressing forever.
    const u = await makeUserWithBusiness('Test Co', 'pro');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setVacationUntil(u.businessId, yesterday.toISOString().slice(0, 10));

    await postReview(u.token);

    assert.strictEqual(emailCalls.length, 1, 'expired vacation must NOT suppress');
    assert.strictEqual(lineCalls.length, 1);
  });

  test('vacation suppression does NOT block the review from ingesting', async () => {
    // The whole point of vacation mode: reviews still come in, you just
    // don't get pinged. If the suppression accidentally short-circuited
    // the ingestion itself, the owner would come back from vacation to
    // an empty dashboard — the worst possible outcome.
    const u = await makeUserWithBusiness('Test Co', 'pro');
    setVacationUntil(u.businessId, new Date().toISOString().slice(0, 10));

    const post = await postReview(u.token);
    assert.strictEqual(post.status, 201);

    const list = await request(app).get('/api/reviews')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.reviews.length, 1, 'review must still be in dashboard');
    assert.strictEqual(list.body.reviews[0].reviewer_name, 'Tourist');
  });

  test('clearing vacation_until restores notifications', async () => {
    const u = await makeUserWithBusiness('Test Co', 'pro');
    setVacationUntil(u.businessId, new Date().toISOString().slice(0, 10));
    await postReview(u.token);
    assert.strictEqual(emailCalls.length, 0, 'sanity: vacation suppresses');

    // Clear vacation via the API (the way real users would)
    await request(app).put(`/api/businesses/${u.businessId}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ vacation_until: '' });

    emailCalls = [];
    lineCalls = [];
    await postReview(u.token);
    assert.strictEqual(emailCalls.length, 1, 'after clearing vacation, emails resume');
    assert.strictEqual(lineCalls.length, 1);
  });
});
