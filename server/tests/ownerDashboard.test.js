// /api/owner/businesses tests.
//
// Powers the OwnerDashboard page. The contract: only businesses where the
// caller has an APPROVED claim show up, with accurate review + pending
// response counts. Defense-in-depth on top of the client gating.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, makeUserWithBusiness, request } = require('./helpers');
const { run, insert } = require('../src/db/schema');

function seedReview(businessId, overrides = {}) {
  const r = {
    platform: 'google',
    reviewer_name: 'Reviewer',
    rating: 4,
    review_text: 'Sample',
    sentiment: 'positive',
    ...overrides,
  };
  return insert(
    `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [businessId, r.platform, r.reviewer_name, r.rating, r.review_text, r.sentiment]
  );
}

function approveClaim(userId, businessId) {
  insert(
    `INSERT INTO business_claims (user_id, business_id, status, reviewed_at)
     VALUES (?, ?, 'approved', datetime('now'))`,
    [userId, businessId]
  );
}

describe('owner dashboard', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('requires auth', async () => {
    const res = await request(app).get('/api/owner/businesses');
    assert.strictEqual(res.status, 401);
  });

  test('returns empty list when caller has no approved claims', async () => {
    const u = await makeUser();
    const res = await request(app)
      .get('/api/owner/businesses')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.businesses, []);
  });

  test('lists businesses with approved claims and review counts', async () => {
    const owner = await makeUserWithBusiness('Owner Dash Co');
    const claimer = await makeUser();
    seedReview(owner.businessId);
    seedReview(owner.businessId, { rating: 5 });
    seedReview(owner.businessId, { rating: 1 });
    approveClaim(claimer.userId, owner.businessId);

    const res = await request(app)
      .get('/api/owner/businesses')
      .set('Authorization', `Bearer ${claimer.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.businesses.length, 1);
    const biz = res.body.businesses[0];
    assert.strictEqual(biz.id, owner.businessId);
    assert.strictEqual(biz.name, 'Owner Dash Co');
    assert.strictEqual(biz.total_reviews, 3);
    assert.strictEqual(biz.pending_response_count, 3);
  });

  test('pending_response_count drops as responses are added', async () => {
    const owner = await makeUserWithBusiness('Pending Co');
    const claimer = await makeUser();
    const r1 = seedReview(owner.businessId);
    seedReview(owner.businessId);
    approveClaim(claimer.userId, owner.businessId);
    insert(
      `INSERT INTO review_responses (review_id, owner_user_id, business_id, response_text)
       VALUES (?, ?, ?, ?)`,
      [r1, claimer.userId, owner.businessId, 'thanks']
    );

    const res = await request(app)
      .get('/api/owner/businesses')
      .set('Authorization', `Bearer ${claimer.token}`);
    const biz = res.body.businesses[0];
    assert.strictEqual(biz.total_reviews, 2);
    assert.strictEqual(biz.pending_response_count, 1);
  });

  test('pending claims do NOT appear', async () => {
    const owner = await makeUserWithBusiness('Pending Claim Co');
    const claimer = await makeUser();
    insert(
      `INSERT INTO business_claims (user_id, business_id, status)
       VALUES (?, ?, 'pending')`,
      [claimer.userId, owner.businessId]
    );
    const res = await request(app)
      .get('/api/owner/businesses')
      .set('Authorization', `Bearer ${claimer.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.businesses.length, 0);
  });

  test('one user\'s approved business does not leak to another user', async () => {
    const owner = await makeUserWithBusiness('Private Co');
    const ownerOfClaim = await makeUser();
    const otherUser = await makeUser();
    approveClaim(ownerOfClaim.userId, owner.businessId);

    const res = await request(app)
      .get('/api/owner/businesses')
      .set('Authorization', `Bearer ${otherUser.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.businesses.length, 0);
  });
});
