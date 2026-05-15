// Stripe Payment Links — manual checkout while LemonSqueezy + Stripe
// ReviewHub account complete their KYC reviews. Real money flows through
// these; Stripe holds funds in the ReviewHub account balance until
// payouts unlock (after Stripe's 2-3 day business verification).
//
// Per-plan link IDs were created in the ReviewHub Stripe account
// (acct_xxxx — Authentae organization → ReviewHub account) on
// 2026-05-15. Each link:
//  - Recurring monthly subscription at the listed USD price
//  - Collects customer name + business name
//  - Allows promo codes + tax IDs
//  - Redirects post-payment to /register?from=stripe&plan=X&checkout_success=1
//
// Provisioning is manual until we wire a Stripe webhook for this
// account: Stripe emails Earth on each new subscription, then he
// matches the customer email to the just-signed-up ReviewHub account
// in the DB and grants paid status.
const STRIPE_PAYMENT_LINKS = {
  starter:  'https://buy.stripe.com/8x27sLfzsgP4eragJs1ZS02',
  pro:      'https://buy.stripe.com/4gM6oH4UO42igzi50K1ZS01',
  business: 'https://buy.stripe.com/aFa7sL1IC7eu3Mw78S1ZS00',
};

// Plan IDs gated as coming-soon on the server (plans.js `coming_soon`
// field). Mirroring the gate client-side prevents accidental Stripe
// checkout for these tiers from cached URLs, stale tabs, or any UI
// surface that calls getStripeCheckoutUrl() without first reading
// plan.coming_soon. Keep this list in sync with plans.js — when a plan
// flips back to live, delete it from here.
const COMING_SOON_PLAN_IDS = new Set(['pro', 'business']);

/**
 * Resolve a plan id ('starter'|'pro'|'business') to its Stripe Payment
 * Link URL. Returns null for unknown plan ids OR plans gated as
 * coming-soon (caller should fall back to the legacy /register path
 * or show a disabled CTA — never offer Stripe checkout for a tier we
 * cannot currently fulfil).
 */
export function getStripeCheckoutUrl(planId) {
  if (COMING_SOON_PLAN_IDS.has(planId)) return null;
  return STRIPE_PAYMENT_LINKS[planId] || null;
}

export const STRIPE_CHECKOUT_PLANS = STRIPE_PAYMENT_LINKS;
