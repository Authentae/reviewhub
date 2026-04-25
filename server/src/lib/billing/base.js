// Base class for a billing provider (Stripe, Paddle, LemonSqueezy, Omise).
//
// Each provider implements the same interface so swapping one for another
// is a config change, not a code rewrite. The surface is intentionally
// small — everything more specific lives inside the provider.
//
// Method contract:
//   createCheckoutSession({userId, email, planId, successUrl, cancelUrl})
//     → { url }  — redirect the browser here
//   createPortalSession({customerId, returnUrl})
//     → { url }  — Stripe-style customer-portal hosted page
//   handleWebhook(rawBody, signature) → { event, subscription, customer }
//     — parse + verify webhook. Caller reconciles DB state from the result.
//
// Providers declare `name` and `isConfigured` the same way the review-platform
// providers do.

class BaseBillingProvider {
  get name() { return 'base'; }
  get isConfigured() { return false; }

  async createCheckoutSession(_opts) {
    throw new Error(`${this.constructor.name}.createCheckoutSession not implemented`);
  }
  async createPortalSession(_opts) {
    throw new Error(`${this.constructor.name}.createPortalSession not implemented`);
  }
  async handleWebhook(_rawBody, _signature) {
    throw new Error(`${this.constructor.name}.handleWebhook not implemented`);
  }
}

module.exports = { BaseBillingProvider };
