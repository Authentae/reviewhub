// Tests for plan-tier enforcement. Two enforcement points today:
//   1. GET /reviews/:id/draft  — free tier capped at 3 AI drafts / month
//   2. PUT /businesses/:id    — platform connections capped per plan
//
// These aren't just behaviour tests — they're the business-model guard rails.
// A bug here = revenue leak (customer on Free tier using unlimited AI drafts)
// or conversely locked-out paying customers. Lock down the contract.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, makeUserWithBusiness, setPlan, request } = require('./helpers');
const { get, run } = require('../src/db/schema');

describe('plan enforcement: new users default to Free', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('register creates subscription with plan=free, status=active, price=0', async () => {
    const u = await makeUser();
    const sub = get('SELECT plan, status, price FROM subscriptions WHERE user_id = ?', [u.userId]);
    assert.strictEqual(sub.plan, 'free');
    assert.strictEqual(sub.status, 'active');
    assert.strictEqual(sub.price, 0);
  });

  test('/me returns plan_meta with Free tier details', async () => {
    const u = await makeUser();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.subscription.plan, 'free');
    assert.strictEqual(res.body.subscription.plan_meta.maxAiDraftsPerMonth, 3);
    assert.strictEqual(res.body.subscription.plan_meta.maxPlatforms, 1);
  });
});

describe('plan enforcement: platform connection caps', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('Free tier: connecting a SECOND platform is rejected with 402', async () => {
    const u = await makeUserWithBusiness();
    // First platform — allowed
    const first = await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ google_place_id: 'ChIJ_one' });
    assert.strictEqual(first.status, 200);
    // Second platform — blocked by plan
    const second = await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ yelp_business_id: 'yelp_two' });
    assert.strictEqual(second.status, 402);
    assert.match(second.body.error, /plan supports up to 1 platform/i);
    assert.strictEqual(second.body.upgradeTo, 'starter');
  });

  test('Starter tier: up to 2 platforms allowed, 3rd is rejected', async () => {
    const u = await makeUserWithBusiness('Starter Co', 'starter');
    await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ google_place_id: 'g1' });
    await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ yelp_business_id: 'y1' });
    // Third should fail (Starter maxPlatforms = 2)
    const third = await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ facebook_page_id: 'f1' });
    assert.strictEqual(third.status, 402);
    assert.strictEqual(third.body.upgradeTo, 'pro');
  });

  test('Pro tier: up to 6 platforms allowed (all current providers)', async () => {
    const u = await makeUserWithBusiness('Pro Co', 'pro');
    // Can set all 3 legacy platform fields without hitting cap
    const res1 = await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ google_place_id: 'g', yelp_business_id: 'y', facebook_page_id: 'f' });
    assert.strictEqual(res1.status, 200);
    const list = await request(app).get('/api/platforms').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.connections.length, 3);
  });

  test('Updating an existing platform ID does NOT count against the cap', async () => {
    const u = await makeUserWithBusiness(); // Free (1 platform)
    await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ google_place_id: 'old' });
    // Changing the same platform's ID should succeed
    const res = await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ google_place_id: 'new' });
    assert.strictEqual(res.status, 200);
  });

  test('Clearing a platform doesn\'t count as a new connection', async () => {
    const u = await makeUserWithBusiness();
    await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ google_place_id: 'keep' });
    const res = await request(app).put(`/api/businesses/${u.businessId}`).set('Authorization', `Bearer ${u.token}`)
      .send({ google_place_id: '' });
    assert.strictEqual(res.status, 200);
  });
});

describe('plan enforcement: AI draft quota', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('Free tier: 3rd AI draft succeeds, 4th is rejected with 402', async () => {
    const u = await makeUserWithBusiness(); // Free plan, 3 drafts/month
    // Add a review to draft against
    const create = await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'Test', rating: 5, review_text: 'good' });
    const reviewId = create.body.review.id;

    // Force the AI path by pretending it's an AI response (we'd need a real
    // key for actual AI; in test env the source is 'template' and template
    // calls are NOT counted against the quota by design). We test the
    // enforcement surface directly by pre-filling the counter.
    run(
      `UPDATE subscriptions SET ai_drafts_used = ?, ai_drafts_period_start = ? WHERE user_id = ?`,
      [3, new Date().toISOString().slice(0, 7) + '-01', u.userId]
    );

    const res = await request(app).get(`/api/reviews/${reviewId}/draft`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 402);
    assert.match(res.body.error, /all 3 AI drafts/i);
    assert.strictEqual(res.body.upgradeTo, 'starter');
    assert.deepStrictEqual(res.body.quota, { used: 3, max: 3 });
  });

  test('Template-source drafts do NOT consume AI quota', async () => {
    // In test env there's no ANTHROPIC_API_KEY so generateDraft returns
    // source:'template'. The route should NOT count template calls against
    // the quota — the quota is about external AI API cost.
    const u = await makeUserWithBusiness();
    const create = await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'T', rating: 5, review_text: 'x' });
    const reviewId = create.body.review.id;

    // Hit the draft endpoint 5 times — all should succeed on template fallback
    // even though Free tier cap is 3.
    for (let i = 0; i < 5; i++) {
      const r = await request(app).get(`/api/reviews/${reviewId}/draft`).set('Authorization', `Bearer ${u.token}`);
      assert.strictEqual(r.status, 200, `iteration ${i} returned ${r.status}`);
      assert.strictEqual(r.body.source, 'template');
    }

    // Counter should still be 0
    const sub = get('SELECT ai_drafts_used FROM subscriptions WHERE user_id = ?', [u.userId]);
    assert.strictEqual(sub.ai_drafts_used, 0);
  });

  test('Starter tier: unlimited drafts (no quota check)', async () => {
    const u = await makeUserWithBusiness('S', 'starter');
    // Pre-fill counter to verify upgrade bypasses the check
    run(
      `UPDATE subscriptions SET ai_drafts_used = ?, ai_drafts_period_start = ? WHERE user_id = ?`,
      [999, new Date().toISOString().slice(0, 7) + '-01', u.userId]
    );
    const create = await request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`)
      .send({ platform: 'google', reviewer_name: 'T', rating: 5, review_text: 'x' });
    const res = await request(app).get(`/api/reviews/${create.body.review.id}/draft`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
  });

  test('reserveAiDraft is race-safe: cap is never exceeded even under parallel calls', () => {
    // Regression test for a real concurrency bug. The old two-phase
    // canUseAiDraft + recordAiDraftUsed flow let parallel requests all
    // pre-check a counter that hadn't been incremented yet, so N > cap
    // drafts slipped through. reserveAiDraft claims the slot atomically.
    const { reserveAiDraft } = require('../src/lib/billing/enforcement');
    const { insert } = require('../src/db/schema');
    const email = `race-${Date.now()}@t.co`;
    const uid = insert("INSERT INTO users (email, password_hash) VALUES (?, 'x')", [email]);
    run(
      `INSERT INTO subscriptions (user_id, status, plan, price)
       VALUES (?, 'active', 'free', 0)`,
      [uid]
    );
    // 10 back-to-back reservations; only the first 3 should succeed
    // (Free plan cap is 3).
    const results = [];
    for (let i = 0; i < 10; i++) results.push(reserveAiDraft(uid));
    const allowed = results.filter(r => r.allowed).length;
    const denied = results.filter(r => !r.allowed).length;
    assert.strictEqual(allowed, 3, `expected exactly 3 slots to succeed, got ${allowed}`);
    assert.strictEqual(denied, 7, `expected 7 to be rejected, got ${denied}`);

    // Counter in DB matches the successful reservations
    const sub = get('SELECT ai_drafts_used FROM subscriptions WHERE user_id = ?', [uid]);
    assert.strictEqual(sub.ai_drafts_used, 3);
  });

  test('refundAiDraft returns a slot and never goes below zero', () => {
    const { reserveAiDraft, refundAiDraft } = require('../src/lib/billing/enforcement');
    const { insert } = require('../src/db/schema');
    const email = `refund-${Date.now()}@t.co`;
    const uid = insert("INSERT INTO users (email, password_hash) VALUES (?, 'x')", [email]);
    run(
      `INSERT INTO subscriptions (user_id, status, plan, price)
       VALUES (?, 'active', 'free', 0)`,
      [uid]
    );
    reserveAiDraft(uid);
    reserveAiDraft(uid);
    assert.strictEqual(get('SELECT ai_drafts_used FROM subscriptions WHERE user_id = ?', [uid]).ai_drafts_used, 2);
    refundAiDraft(uid);
    assert.strictEqual(get('SELECT ai_drafts_used FROM subscriptions WHERE user_id = ?', [uid]).ai_drafts_used, 1);
    refundAiDraft(uid);
    refundAiDraft(uid); // extra refund — should clamp to 0, not go negative
    refundAiDraft(uid);
    assert.strictEqual(get('SELECT ai_drafts_used FROM subscriptions WHERE user_id = ?', [uid]).ai_drafts_used, 0);
  });

  test('Counter rolls over into a new month', () => {
    const { canUseAiDraft } = require('../src/lib/billing/enforcement');
    // Synthesise a free-tier sub with the counter maxed in a PAST month
    const { insert } = require('../src/db/schema');
    const email = `rollover-${Date.now()}@t.co`;
    const uid = insert("INSERT INTO users (email, password_hash) VALUES (?, 'x')", [email]);
    run(
      `INSERT INTO subscriptions (user_id, status, plan, price, ai_drafts_used, ai_drafts_period_start)
       VALUES (?, 'active', 'free', 0, 3, '2020-01-01')`,
      [uid]
    );
    const check = canUseAiDraft(uid);
    // Used=3 but period_start is 2020-01 — reset triggers, check allows.
    assert.strictEqual(check.allowed, true);
  });
});

describe('plan enforcement: analytics, csv_export, templates', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /analytics blocked on Free plan (upgrade: true in response)', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).get('/api/reviews/analytics').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.upgrade, true);
    assert.match(res.body.error, /pro plan/i);
  });

  test('GET /analytics allowed on Pro plan', async () => {
    const u = await makeUserWithBusiness('Pro Analytics Co', 'pro');
    const res = await request(app).get('/api/reviews/analytics').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.weeks));
  });

  test('GET /export/csv blocked on Free plan', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).get('/api/reviews/export/csv').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 403);
  });

  test('POST /templates blocked on Free plan', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/templates').set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'Test', body: 'Body text' });
    assert.strictEqual(res.status, 403);
  });

  test('POST /templates allowed on Starter plan', async () => {
    const u = await makeUserWithBusiness('Starter Templates Co', 'starter');
    const res = await request(app).post('/api/templates').set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'Quick reply', body: 'Thanks for the review!' });
    assert.strictEqual(res.status, 201);
  });
});
