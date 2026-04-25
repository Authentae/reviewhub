// Pricing plan catalogue.
//
// Source of truth for plan metadata. The billing abstraction renders plan
// cards from this, route handlers gate features with `planAllows(plan, feature)`,
// and enforcement middleware reads capacity caps from `planMax(plan, key)`.
//
// Design principle: **the free tier IS the trial.** We deliberately do NOT
// offer a 14-day everything-unlocked trial — for this product, the value is
// heavily front-loaded (catching up on a backlog of unresponded reviews),
// so a full-feature trial lets customers extract all the value and leave.
// Instead:
//   - Free tier is permanent, with limits that prevent backlog-blasting:
//     * 1 platform only
//     * 3 AI drafts per month (enough to try the magic, not enough to
//       respond to 40 historical reviews)
//     * Manual responses unlimited (you can still use the service, just slowly)
//     * No email alerts (ongoing-value feature, gated to paid)
//   - Paid tiers unlock features that compound in value over time:
//     * Email alerts → caught early, respond within minutes not days
//     * Weekly digest → only meaningful after accumulating data
//     * Trend analytics → meaningful over months
//     * Negative-review instant alert → highest-ROI feature, Pro+ only
//
// Annual pricing gives a 20% discount and is paid in one up-front charge.
// This both filters out short-term abusers AND improves cash flow for the
// solo founder. Billing provider is responsible for monthly vs annual
// invoicing; the plan catalogue just publishes both prices.

const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthlyUsd: 0,
    priceAnnualUsd: 0,
    priceMonthlyThb: 0,
    priceAnnualThb: 0,
    description: 'Try ReviewHub — no credit card, no time limit',
    maxPlatforms: 1,
    maxReviewsPerMonth: null, // unlimited manual responses; the real cap is AI drafts
    maxAiDraftsPerMonth: 3,
    maxBusinesses: 1,
    features: {
      ai_drafts: true, // but capped at 3/month
      email_alerts_new: false,
      email_alerts_negative: false,
      weekly_digest: false,
      csv_export: false,
      templates: false,
      trend_analytics: false,
      multi_location: false,
      priority_support: false,
      api_access: false,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthlyUsd: 14,
    priceAnnualUsd: 134, // ~$11.17/mo, 20% off
    priceMonthlyThb: 499,
    priceAnnualThb: 4790,
    description: 'Everything a single shop needs to respond quickly',
    maxPlatforms: 2,
    maxReviewsPerMonth: null,
    maxAiDraftsPerMonth: null, // unlimited
    maxBusinesses: 1,
    features: {
      ai_drafts: true,
      email_alerts_new: true,
      email_alerts_negative: true,
      weekly_digest: false,
      csv_export: false,
      templates: true,
      trend_analytics: false,
      multi_location: false,
      priority_support: false,
      api_access: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthlyUsd: 29,
    priceAnnualUsd: 278, // ~$23.17/mo, 20% off
    priceMonthlyThb: 999,
    priceAnnualThb: 9590,
    description: 'For busy businesses across every major platform',
    maxPlatforms: 6,
    maxReviewsPerMonth: null,
    maxAiDraftsPerMonth: null,
    maxBusinesses: 1,
    features: {
      ai_drafts: true,
      email_alerts_new: true,
      email_alerts_negative: true,
      weekly_digest: true,
      csv_export: true,
      templates: true,
      trend_analytics: true,
      multi_location: false,
      priority_support: false,
      api_access: false,
    },
  },
  business: {
    id: 'business',
    name: 'Business',
    priceMonthlyUsd: 59,
    priceAnnualUsd: 567, // 20% off
    priceMonthlyThb: 1990,
    priceAnnualThb: 19100,
    description: 'Multi-location businesses and agencies',
    maxPlatforms: 6,
    maxReviewsPerMonth: null,
    maxAiDraftsPerMonth: null,
    maxBusinesses: 5,
    features: {
      ai_drafts: true,
      email_alerts_new: true,
      email_alerts_negative: true,
      weekly_digest: true,
      csv_export: true,
      templates: true,
      trend_analytics: true,
      multi_location: true,
      priority_support: true,
      api_access: true,
    },
  },
};

const PLAN_IDS = Object.keys(PLANS);
const DEFAULT_PLAN = 'free';

function getPlan(id) {
  return PLANS[id] || null;
}

function planAllows(planId, feature) {
  const plan = PLANS[planId];
  if (!plan) return false;
  return !!plan.features[feature];
}

function planMax(planId, capacityKey) {
  const plan = PLANS[planId];
  if (!plan) return 0;
  const v = plan[capacityKey];
  return v === undefined ? 0 : v; // null = unlimited, caller must check
}

// Helper for clear "limit reached" checks. Returns true if adding one more
// of `capacityKey` would exceed the plan cap. `null` on a cap means unlimited.
function wouldExceed(planId, capacityKey, currentCount) {
  const max = planMax(planId, capacityKey);
  if (max === null) return false; // unlimited
  return currentCount >= max;
}

module.exports = { PLANS, PLAN_IDS, DEFAULT_PLAN, getPlan, planAllows, planMax, wouldExceed };
