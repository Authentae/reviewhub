// Plan enforcement helpers.
//
// These live between route handlers and the database. Each function answers
// "can this user do X right now?" and returns either {allowed: true} or
// {allowed: false, reason, status} so the route can surface a precise error.
//
// All checks read the user's current subscription row; we don't cache because
// plan changes need to take effect immediately after upgrade/cancel.

const { get, run, transaction } = require('../../db/schema');
const { getPlan, planAllows, planMax } = require('./plans');

// Plan ladder used to compute the right "upgrade to X" target for a given
// gate. Defined once at top so all enforcement helpers can reach it.
const PLAN_LADDER = ['free', 'starter', 'pro', 'business'];

// Walk the ladder for the first tier with a STRICTLY HIGHER capacity than
// the user's current plan. Returns null if there is no higher tier (e.g.
// Business hitting its own cap, Pro hitting a cap that Business shares).
function findHigherCapacityTier(currentPlanId, capacityKey) {
  const idx = PLAN_LADDER.indexOf(currentPlanId);
  if (idx === -1) return null;
  const currentMax = planMax(currentPlanId, capacityKey);
  for (let i = idx + 1; i < PLAN_LADDER.length; i++) {
    const tierMax = planMax(PLAN_LADDER[i], capacityKey);
    if (tierMax === null && currentMax !== null) return PLAN_LADDER[i];
    if (tierMax !== null && currentMax !== null && tierMax > currentMax) return PLAN_LADDER[i];
  }
  return null;
}

// Walk the ladder for the first tier above the user's current that includes
// the requested feature. Without this, the wall message would always tell
// the user to "upgrade to Starter" — wrong for a Starter user clicking a
// Pro feature.
function findUpgradeTier(currentPlanId, featureKey) {
  const idx = PLAN_LADDER.indexOf(currentPlanId);
  if (idx === -1) return 'starter';
  for (let i = idx + 1; i < PLAN_LADDER.length; i++) {
    if (planAllows(PLAN_LADDER[i], featureKey)) return PLAN_LADDER[i];
  }
  return PLAN_LADDER[PLAN_LADDER.length - 1];
}

// Returns the current ISO month prefix (YYYY-MM-01) — used as the period
// boundary for monthly quotas. New period => reset counter.
function currentPeriodStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

// Returns the user's subscription with plan hydrated. Creates a free-tier
// subscription on-the-fly if none exists — this is defensive; register()
// should always insert one, but older accounts predating the billing
// refactor might lack a row.
function getSubscription(userId) {
  let sub = get('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);
  if (!sub) {
    run(
      `INSERT INTO subscriptions (user_id, status, plan, price)
       VALUES (?, 'active', 'free', 0)`,
      [userId]
    );
    sub = get('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);
  }
  return sub;
}

// Check whether the user can request one more AI draft this month.
// On allowed, caller MUST call recordAiDraftUsed() after the draft lands.
// On denied, the route should return 402 (Payment Required) or 403 with a
// message prompting an upgrade.
function canUseAiDraft(userId) {
  const sub = getSubscription(userId);
  const plan = getPlan(sub.plan);
  if (!plan) return { allowed: false, reason: 'Unknown plan', status: 500 };
  if (!plan.features.ai_drafts) {
    return { allowed: false, reason: 'AI drafts are not included in your plan', status: 402, upgradeTo: 'starter' };
  }
  const max = planMax(sub.plan, 'maxAiDraftsPerMonth');
  if (max === null) return { allowed: true, sub, plan }; // unlimited

  // Reset counter if we've rolled into a new month.
  const period = currentPeriodStart();
  let used = sub.ai_drafts_used || 0;
  if (sub.ai_drafts_period_start !== period) {
    used = 0;
  }

  if (used >= max) {
    return {
      allowed: false,
      reason: `You've used all ${max} AI drafts included in your ${plan.name} plan this month. Upgrade to unlock unlimited drafts.`,
      status: 402,
      upgradeTo: 'starter',
      used,
      max,
    };
  }
  return { allowed: true, sub, plan, used, max };
}

// Atomically increment the counter, resetting if we've rolled into a new month.
// Returns the new {used, max} so the caller can surface "2/3 used" back to the client.
function recordAiDraftUsed(userId) {
  const period = currentPeriodStart();
  transaction((tx) => {
    const sub = get('SELECT ai_drafts_period_start, ai_drafts_used FROM subscriptions WHERE user_id = ?', [userId]);
    if (!sub) return; // defensive; getSubscription creates one upstream
    const newUsed = sub.ai_drafts_period_start === period ? (sub.ai_drafts_used || 0) + 1 : 1;
    tx.run(
      `UPDATE subscriptions SET ai_drafts_used = ?, ai_drafts_period_start = ? WHERE user_id = ?`,
      [newUsed, period, userId]
    );
  });
}

// Atomically reserve a draft slot. Returns {allowed:true} if we incremented
// the counter within the plan's cap, {allowed:false, ...} if over cap.
//
// This fixes a concurrency hole in the two-phase canUseAiDraft + recordAiDraftUsed
// flow: under parallel requests from the same user, multiple `canUseAiDraft`
// calls could read the same pre-increment count and all pass, letting N > cap
// drafts through before any of them recorded. Reserving up-front and refunding
// on template-fallback closes the gap.
//
// The UPDATE uses a WHERE guard so over-cap requests don't mutate the row.
// When the month rolls over we reset-and-claim in a single UPDATE too.
function reserveAiDraft(userId) {
  const sub = getSubscription(userId);
  const plan = getPlan(sub.plan);
  if (!plan) return { allowed: false, reason: 'Unknown plan', status: 500 };
  if (!plan.features.ai_drafts) {
    return { allowed: false, reason: 'AI drafts are not included in your plan', status: 402, upgradeTo: 'starter' };
  }
  const max = planMax(sub.plan, 'maxAiDraftsPerMonth');
  const period = currentPeriodStart();

  // Unlimited plan — no counter maintenance needed, just admit.
  if (max === null) return { allowed: true, sub, plan };

  return transaction((tx) => {
    // Re-read inside the transaction so we see the live counter.
    const row = get(
      'SELECT ai_drafts_period_start, ai_drafts_used FROM subscriptions WHERE user_id = ?',
      [userId]
    );
    if (!row) return { allowed: false, reason: 'No subscription', status: 500 };

    const sameMonth = row.ai_drafts_period_start === period;
    const current = sameMonth ? (row.ai_drafts_used || 0) : 0;
    if (current >= max) {
      return {
        allowed: false,
        reason: `You've used all ${max} AI drafts included in your ${plan.name} plan this month. Upgrade to unlock unlimited drafts.`,
        status: 402,
        upgradeTo: 'starter',
        used: current,
        max,
      };
    }
    const newUsed = current + 1;
    tx.run(
      'UPDATE subscriptions SET ai_drafts_used = ?, ai_drafts_period_start = ? WHERE user_id = ?',
      [newUsed, period, userId]
    );
    return { allowed: true, used: newUsed, max, sub, plan };
  });
}

// Refund a reserved slot — call this if the AI path didn't actually run
// (e.g. fell back to template because ANTHROPIC_API_KEY wasn't set).
// Never takes the counter below zero.
function refundAiDraft(userId) {
  const period = currentPeriodStart();
  transaction((tx) => {
    tx.run(
      `UPDATE subscriptions
         SET ai_drafts_used = MAX(0, ai_drafts_used - 1)
       WHERE user_id = ? AND ai_drafts_period_start = ?`,
      [userId, period]
    );
  });
}

// Can the user connect one more platform to a business they own?
// The caller passes the current count of platform_connections for that business.
function canConnectPlatform(userId, currentPlatformCount) {
  const sub = getSubscription(userId);
  const plan = getPlan(sub.plan);
  const max = planMax(sub.plan, 'maxPlatforms');
  if (max === null) return { allowed: true };
  if (currentPlatformCount >= max) {
    // Pro and Business both have 6 platforms — a Pro user at 6 platforms
    // shouldn't be told to "upgrade to Business" because Business won't
    // add capacity. findHigherCapacityTier returns null in that case.
    const nextTier = findHigherCapacityTier(sub.plan, 'maxPlatforms');
    return {
      allowed: false,
      reason: nextTier
        ? `Your ${plan.name} plan supports up to ${max} platform(s). Upgrade to connect more.`
        : `You're at the platform cap for our top tier. Email support if you need more.`,
      status: 402,
      upgradeTo: nextTier, // may be null
      current: currentPlatformCount,
      max,
    };
  }
  return { allowed: true };
}

// Feature-gate helper for boolean features (email alerts, CSV export, etc.).
// Returns the same shape as canUseAiDraft for consistent route handling.
// Uses findUpgradeTier (defined at top) so a Starter user clicking on a
// Pro-tier feature gets pointed at Pro, not at Starter (which they already
// have).
function requireFeature(userId, featureKey) {
  const sub = getSubscription(userId);
  if (planAllows(sub.plan, featureKey)) return { allowed: true };
  const plan = getPlan(sub.plan);
  return {
    allowed: false,
    reason: `${featureKey.replace(/_/g, ' ')} is not included in your ${plan?.name || 'current'} plan`,
    status: 402,
    upgradeTo: findUpgradeTier(sub.plan, featureKey),
  };
}

module.exports = {
  getSubscription,
  canUseAiDraft,
  recordAiDraftUsed,
  reserveAiDraft,
  refundAiDraft,
  canConnectPlatform,
  requireFeature,
  currentPeriodStart,
};
