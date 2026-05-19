// Tests for the plan catalogue:
//   - GET /api/plans (public route in routes/plans.js)
//   - planAllows / planMax / wouldExceed helpers in lib/billing/plans.js
//
// These are the source of truth for "what does each plan get." The Pricing
// page reads /api/plans to render cards, and every quota gate across the
// server calls planAllows()/wouldExceed(). A regression here silently
// downgrades paying customers, or worse, silently un-gates a paid feature
// for Free users.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request } = require('./helpers');
const {
  PLANS,
  PLAN_IDS,
  DEFAULT_PLAN,
  getPlan,
  planAllows,
  planMax,
  wouldExceed,
} = require('../src/lib/billing/plans');

describe('GET /api/plans', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('returns 200 with a non-empty plans array', async () => {
    const r = await request(app).get('/api/plans');
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.plans), 'plans should be an array');
    assert.ok(r.body.plans.length >= 3, 'should expose at least free/starter/pro');
  });

  test('every plan has the contract the Pricing page expects', async () => {
    const r = await request(app).get('/api/plans');
    for (const p of r.body.plans) {
      assert.ok(p.id, `plan missing id: ${JSON.stringify(p)}`);
      assert.ok(p.name, `plan ${p.id} missing name`);
      assert.strictEqual(typeof p.priceMonthlyUsd, 'number');
      assert.strictEqual(typeof p.priceMonthlyThb, 'number');
      assert.ok(p.features, `plan ${p.id} missing features bag`);
      assert.strictEqual(typeof p.features.ai_drafts, 'boolean');
    }
  });

  test('sets a non-zero Cache-Control max-age (plans change rarely)', async () => {
    const r = await request(app).get('/api/plans');
    const cc = r.headers['cache-control'] || '';
    assert.ok(/max-age=\d+/.test(cc), `Cache-Control should set max-age, got: "${cc}"`);
  });

  test('exposes the free, starter, pro and business plan IDs', async () => {
    const r = await request(app).get('/api/plans');
    const ids = r.body.plans.map((p) => p.id);
    for (const required of ['free', 'starter', 'pro', 'business']) {
      assert.ok(ids.includes(required), `${required} plan missing from /api/plans`);
    }
  });
});

describe('plans.js helpers', () => {
  test('PLAN_IDS includes the expected tiers', () => {
    for (const required of ['free', 'starter', 'pro', 'business']) {
      assert.ok(PLAN_IDS.includes(required), `${required} missing from PLAN_IDS`);
    }
  });

  test('DEFAULT_PLAN is free', () => {
    assert.strictEqual(DEFAULT_PLAN, 'free');
    assert.ok(PLANS[DEFAULT_PLAN], 'DEFAULT_PLAN must reference an actual plan');
  });

  test('getPlan returns the plan object for a known ID', () => {
    const p = getPlan('starter');
    assert.ok(p, 'getPlan(starter) should return an object');
    assert.strictEqual(p.id, 'starter');
  });

  test('getPlan returns null for an unknown ID', () => {
    assert.strictEqual(getPlan('platinum-unicorn'), null);
    assert.strictEqual(getPlan(''), null);
    assert.strictEqual(getPlan(undefined), null);
  });

  test('planAllows returns false for unknown plan IDs (does not throw)', () => {
    assert.strictEqual(planAllows('platinum-unicorn', 'ai_drafts'), false);
    assert.strictEqual(planAllows(null, 'ai_drafts'), false);
  });

  test('planAllows reflects the free plan having ai_drafts but not weekly_digest', () => {
    // ai_drafts is true on Free but quota-capped — feature gate vs quota are
    // separate concerns. weekly_digest is hard-locked behind a paid tier.
    assert.strictEqual(planAllows('free', 'ai_drafts'), true);
    assert.strictEqual(planAllows('free', 'weekly_digest'), false);
  });

  test('planAllows reflects starter has email alerts but not priority_support', () => {
    assert.strictEqual(planAllows('starter', 'email_alerts_new'), true);
    assert.strictEqual(planAllows('starter', 'priority_support'), false);
  });

  test('planAllows returns false for unknown feature flags', () => {
    // Defensive — typo'd feature name must not silently return truthy.
    assert.strictEqual(planAllows('free', 'this_feature_does_not_exist'), false);
  });

  test('planMax returns the configured cap for known capacityKey', () => {
    // Free is configured with maxAiDraftsPerMonth: 3
    assert.strictEqual(planMax('free', 'maxAiDraftsPerMonth'), 3);
    assert.strictEqual(planMax('free', 'maxPlatforms'), 1);
  });

  test('planMax returns 0 for unknown plan IDs', () => {
    assert.strictEqual(planMax('platinum-unicorn', 'maxPlatforms'), 0);
  });

  test('wouldExceed: false when under the cap, true when at-or-over', () => {
    // Free maxAiDraftsPerMonth is 3.
    assert.strictEqual(wouldExceed('free', 'maxAiDraftsPerMonth', 0), false);
    assert.strictEqual(wouldExceed('free', 'maxAiDraftsPerMonth', 2), false);
    assert.strictEqual(wouldExceed('free', 'maxAiDraftsPerMonth', 3), true);
    assert.strictEqual(wouldExceed('free', 'maxAiDraftsPerMonth', 99), true);
  });

  test('wouldExceed: null cap means unlimited — never exceeds', () => {
    // Starter maxAiDraftsPerMonth is null (unlimited).
    assert.strictEqual(wouldExceed('starter', 'maxAiDraftsPerMonth', 0), false);
    assert.strictEqual(wouldExceed('starter', 'maxAiDraftsPerMonth', 1e6), false);
  });
});
