// Checkout URLs — provider-agnostic, but currently LemonSqueezy.
//
// Switched from Stripe Payment Links to LemonSqueezy on 2026-05-21 after
// LS's merchant-of-record approval landed. LS handles VAT / sales tax
// compliance globally (EU, US states, JP, AU, etc.) which is critical
// for a solo Thai founder selling internationally. The 2-3% extra fee
// vs Stripe is cheaper than even one tax mistake or hiring a CPA.
//
// Each LS checkout URL:
//  - Recurring monthly subscription at the listed USD price
//  - Collects customer name + email
//  - Allows discount codes (LS dashboard)
//  - Redirects post-payment to /register?from=lemonsqueezy&plan=X&checkout_success=1
//    (configured in the LS product's "Confirmation modal" + "Email receipt"
//    button-link fields)
//
// Provisioning today: manual cross-reference. The customer pays on LS,
// gets redirected to /register, signs up with their email. Earth then
// matches that email to the LS order in the dashboard and grants paid
// status in /admin. The LS webhook (server/src/lib/billing/lemonsqueezy.js)
// is ready to auto-provision but needs LEMONSQUEEZY_WEBHOOK_SECRET +
// LEMONSQUEEZY_API_KEY env vars wired before it can verify events.
//
// Stripe backup: commented-out Payment Links below. Don't use without
// finishing the Stripe Continue-Setup wizard (bank verification still
// pending as of 2026-05-21).
const CHECKOUT_URLS = {
  // LemonSqueezy test-mode URLs. Same URLs work in live mode once Earth
  // flips the store from test → live; the variant UUIDs don't change.
  starter:  'https://reviewhub.lemonsqueezy.com/checkout/buy/6a430dc7-698f-4ec2-8dde-fad8a4942e88',
  pro:      null, // coming_soon — no LS product created yet
  business: null, // coming_soon — no LS product created yet
};

// Stripe Payment Links (backup, paused 2026-05-21).
// Re-enable by swapping the URL in CHECKOUT_URLS.starter if LS proves problematic.
// const STRIPE_BACKUP = {
//   starter:  'https://buy.stripe.com/8x27sLfzsgP4eragJs1ZS02',
//   pro:      'https://buy.stripe.com/4gM6oH4UO42igzi50K1ZS01',
//   business: 'https://buy.stripe.com/aFa7sL1IC7eu3Mw78S1ZS00',
// };

// Plan IDs gated as coming-soon on the server (plans.js `coming_soon`
// field). Mirroring the gate client-side prevents accidental checkout
// for these tiers from cached URLs, stale tabs, or any UI surface that
// calls getCheckoutUrl() without first reading plan.coming_soon. Keep
// in sync with plans.js — when a plan flips to live, delete from here
// AND create the corresponding LS product, AND populate CHECKOUT_URLS.
const COMING_SOON_PLAN_IDS = new Set(['pro', 'business']);

/**
 * Resolve a plan id ('starter'|'pro'|'business') to its checkout URL.
 * Returns null for unknown plan ids OR plans gated as coming-soon
 * (caller should fall back to the legacy /register path or show a
 * disabled CTA — never offer checkout for a tier we cannot fulfil).
 */
export function getCheckoutUrl(planId) {
  if (COMING_SOON_PLAN_IDS.has(planId)) return null;
  return CHECKOUT_URLS[planId] || null;
}

// Backward-compatibility alias — kept because BillingSection.jsx and
// AuditPreview.jsx still import getStripeCheckoutUrl from this module.
// Eventually rename call-sites and remove this; for now zero risk and
// zero behavior change.
export const getStripeCheckoutUrl = getCheckoutUrl;

// Same backward-compat alias for the plans-map export name.
export const STRIPE_CHECKOUT_PLANS = CHECKOUT_URLS;
export const CHECKOUT_PLANS = CHECKOUT_URLS;
