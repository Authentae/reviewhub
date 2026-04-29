// Tests for the business-owner review-response feature:
//   * business claim flow (submit, admin approve/deny)
//   * public response create/edit/delete (auth + plan gate)
//   * sanitization (no HTML injection)
//   * 50/day rate limit
//   * public business reviews endpoint includes nested responses

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, makeUserWithBusiness, setPlan, request } = require('./helpers');
const { run, get, insert } = require('../src/db/schema');

// Seed a review against an existing business — bypasses sentiment/email
// machinery since we're testing the response surface, not review intake.
function seedReview(businessId, overrides = {}) {
  const r = {
    platform: 'google',
    reviewer_name: 'Reviewer',
    rating: 4,
    review_text: 'Sample review',
    sentiment: 'positive',
    ...overrides,
  };
  return insert(
    `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [businessId, r.platform, r.reviewer_name, r.rating, r.review_text, r.sentiment]
  );
}

describe('business claims', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('POST /businesses/:id/claim creates a pending claim', async () => {
    const owner = await makeUserWithBusiness('Claim Co');
    const claimer = await makeUser();
    const res = await request(app)
      .post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimer.token}`)
      .send({ evidence: 'I am the manager' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'pending');
    assert.strictEqual(res.body.business_id, owner.businessId);
  });

  test('Second claim while pending returns 409', async () => {
    const owner = await makeUserWithBusiness('Dup Co');
    const claimer = await makeUser();
    await request(app).post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimer.token}`).send({});
    const res = await request(app).post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimer.token}`).send({});
    assert.strictEqual(res.status, 409);
  });

  test('GET /businesses/:id/claim returns caller\'s claim status', async () => {
    const owner = await makeUserWithBusiness('Status Co');
    const claimer = await makeUser();
    await request(app).post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimer.token}`).send({ evidence: 'foo' });
    const res = await request(app).get(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimer.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.claim.status, 'pending');
    assert.strictEqual(res.body.claim.evidence, 'foo');
  });

  test('Admin can approve a pending claim', async () => {
    process.env.ADMIN_EMAIL = 'admin-claims@test.local';
    // Register an admin user with that email
    const adminEmail = 'admin-claims@test.local';
    const adminReg = await request(app)
      .post('/api/auth/register')
      .send({ email: adminEmail, password: 'TestPass-9f2A!xQ', acceptedTerms: true, ageConfirmed: true });
    const adminToken = adminReg.body.token;

    const owner = await makeUserWithBusiness('Admin Approve Co');
    const claimer = await makeUser();
    const claimRes = await request(app).post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimer.token}`).send({});
    const claimId = claimRes.body.id;

    const approve = await request(app).post(`/api/admin/claims/${claimId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`).send({});
    assert.strictEqual(approve.status, 200);
    assert.strictEqual(approve.body.status, 'approved');

    delete process.env.ADMIN_EMAIL;
  });

  test('Non-admin cannot reach admin claims endpoint (404)', async () => {
    process.env.ADMIN_EMAIL = 'someone-else@test.local';
    const u = await makeUser();
    const res = await request(app).get('/api/admin/claims')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 404);
    delete process.env.ADMIN_EMAIL;
  });
});

describe('review responses: auth + plan gate', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('Free-tier owner is rejected with 402 (paid plan required)', async () => {
    const owner = await makeUserWithBusiness('Free Co'); // direct owner, free plan
    const reviewId = seedReview(owner.businessId);
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'Thanks for the review!' });
    assert.strictEqual(res.status, 402);
    assert.match(res.body.error, /Starter/i);
  });

  test('Starter-tier direct owner can post a response', async () => {
    const owner = await makeUserWithBusiness('Paid Co', 'starter');
    const reviewId = seedReview(owner.businessId);
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'Thanks for the review!' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.response.response_text, 'Thanks for the review!');
  });

  test('Non-owner without approved claim is rejected 403', async () => {
    const owner = await makeUserWithBusiness('Owned Co', 'starter');
    const reviewId = seedReview(owner.businessId);
    const intruder = await makeUser();
    setPlan(intruder.userId, 'starter');
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ response_text: 'I should not be allowed' });
    assert.strictEqual(res.status, 403);
  });

  test('Approved claimant on paid plan can post a response', async () => {
    const owner = await makeUserWithBusiness('Claim2 Co');
    const reviewId = seedReview(owner.businessId);
    const claimer = await makeUser();
    setPlan(claimer.userId, 'starter');
    const claim = await request(app).post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimer.token}`).send({});
    // Approve via DB directly so we don't need to set ADMIN_EMAIL again
    run(`UPDATE business_claims SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?`,
        [claim.body.id]);
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${claimer.token}`)
      .send({ response_text: 'Thank you for stopping by!' });
    assert.strictEqual(res.status, 201);
  });
});

describe('review responses: validation + sanitization', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('Response shorter than 10 chars is rejected', async () => {
    const owner = await makeUserWithBusiness('Short Co', 'starter');
    const reviewId = seedReview(owner.businessId);
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'Hi' });
    assert.strictEqual(res.status, 400);
  });

  test('Response longer than 2000 chars is rejected', async () => {
    const owner = await makeUserWithBusiness('Long Co', 'starter');
    const reviewId = seedReview(owner.businessId);
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'a'.repeat(2001) });
    assert.strictEqual(res.status, 400);
  });

  test('HTML tags are stripped from stored response', async () => {
    const owner = await makeUserWithBusiness('Sanitize Co', 'starter');
    const reviewId = seedReview(owner.businessId);
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'Thanks <script>alert(1)</script> for the review!' });
    assert.strictEqual(res.status, 201);
    assert.ok(!res.body.response.response_text.includes('<'));
    assert.ok(!res.body.response.response_text.includes('script'));
  });

  test('Cannot post a second response to the same review (409)', async () => {
    const owner = await makeUserWithBusiness('Dup Resp Co', 'starter');
    const reviewId = seedReview(owner.businessId);
    await request(app).post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'First response here' });
    const res = await request(app).post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'Second response here' });
    assert.strictEqual(res.status, 409);
  });
});

describe('review responses: edit + delete', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('Owner can PUT their response', async () => {
    const owner = await makeUserWithBusiness('Edit Co', 'starter');
    const reviewId = seedReview(owner.businessId);
    await request(app).post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'Original text here' });
    const res = await request(app).put(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'Updated text here please' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.response.response_text, 'Updated text here please');
  });

  test('Owner can DELETE their response', async () => {
    const owner = await makeUserWithBusiness('Del Co', 'starter');
    const reviewId = seedReview(owner.businessId);
    await request(app).post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'I will be deleted' });
    const res = await request(app).delete(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`);
    assert.strictEqual(res.status, 200);
    const after = get('SELECT id FROM review_responses WHERE review_id = ?', [reviewId]);
    assert.strictEqual(after, null);
  });
});

describe('review responses: rate limit', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('51st response in 24h is rejected with 429', async () => {
    const owner = await makeUserWithBusiness('Rate Co', 'starter');
    // Pre-seed 50 responses directly in the DB attributed to this owner.
    // Faster than 50 round-trips through the API and exercises the same
    // count-query the limiter uses.
    for (let i = 0; i < 50; i++) {
      const rid = seedReview(owner.businessId);
      run(
        `INSERT INTO review_responses (review_id, owner_user_id, business_id, response_text)
         VALUES (?, ?, ?, ?)`,
        [rid, owner.userId, owner.businessId, `Pre-seeded response number ${i} here`]
      );
    }
    // 51st via the API should be blocked.
    const newReviewId = seedReview(owner.businessId);
    const res = await request(app).post(`/api/reviews/${newReviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'Should be blocked by rate limit' });
    assert.strictEqual(res.status, 429);
    assert.strictEqual(res.body.limit, 50);
  });

  // Regression: the daily cap is per-business, not global per owner.
  // Previously a Business-plan operator with 5 locations was capped at 50
  // responses TOTAL per day (~10 per location); now each business gets its
  // own 50/day budget.
  test('daily cap is per-business — second business retains its 50/day budget', async () => {
    const owner = await makeUserWithBusiness('BizA', 'business');
    // Add a second business owned by the same user
    const { run: dbRun, insert: dbInsert, get: dbGet } = require('../src/db/schema');
    const bizBId = dbInsert('INSERT INTO businesses (user_id, business_name) VALUES (?, ?)', [owner.userId, 'BizB']);

    // Saturate Business A's daily cap (50 pre-seeded responses).
    for (let i = 0; i < 50; i++) {
      const rid = seedReview(owner.businessId);
      dbRun(
        `INSERT INTO review_responses (review_id, owner_user_id, business_id, response_text)
         VALUES (?, ?, ?, ?)`,
        [rid, owner.userId, owner.businessId, `Saturating biz A response ${i}`]
      );
    }

    // Posting to a review on Business B should still succeed — its budget is independent.
    const ridB = dbInsert(
      'INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment) VALUES (?, ?, ?, ?, ?, ?)',
      [bizBId, 'google', 'CrossBiz', 5, 'Loved BizB!', 'positive']
    );
    const res = await request(app).post(`/api/reviews/${ridB}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'BizB has its own daily budget; this should go through.' });
    assert.strictEqual(res.status, 201, `unexpected: ${JSON.stringify(res.body)}`);
  });
});

describe('public business reviews include nested responses', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /api/public/businesses/:id/reviews returns owner_response inline', async () => {
    const owner = await makeUserWithBusiness('Public Co', 'starter');
    const reviewId = seedReview(owner.businessId);
    await request(app).post(`/api/reviews/${reviewId}/response`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ response_text: 'Public-facing response text' });
    const res = await request(app).get(`/api/public/businesses/${owner.businessId}/reviews`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.reviews));
    const target = res.body.reviews.find(r => r.id === reviewId);
    assert.ok(target, 'review should appear in payload');
    assert.ok(target.owner_response, 'owner_response should be populated');
    assert.strictEqual(target.owner_response.response_text, 'Public-facing response text');
  });

  test('Reviews without an owner response have owner_response: null', async () => {
    const owner = await makeUserWithBusiness('NoResp Co');
    const reviewId = seedReview(owner.businessId);
    const res = await request(app).get(`/api/public/businesses/${owner.businessId}/reviews`);
    assert.strictEqual(res.status, 200);
    const target = res.body.reviews.find(r => r.id === reviewId);
    assert.ok(target);
    assert.strictEqual(target.owner_response, null);
  });
});
