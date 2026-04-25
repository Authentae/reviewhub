// Stripe billing provider (stub).
//
// Activates when STRIPE_SECRET_KEY is set. Full implementation requires
// npm install stripe plus plan-to-price-ID mapping in env (STRIPE_PRICE_STARTER,
// STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS).
//
// Implementation notes for when wiring this up:
//   1. Create Products + Prices in the Stripe dashboard (one Price per plan
//      per currency). Store the Price IDs in env vars.
//   2. In createCheckoutSession, call stripe.checkout.sessions.create with
//      mode='subscription', line_items=[{price: STRIPE_PRICE_<PLAN>, quantity: 1}],
//      customer_email, success_url, cancel_url, metadata: {userId}.
//   3. In handleWebhook, verify the signature with
//      stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
//      and handle checkout.session.completed, customer.subscription.updated,
//      customer.subscription.deleted, invoice.payment_failed.
//   4. On successful checkout, update the user's subscriptions row with
//      plan, billing_provider='stripe', billing_provider_id=customer,
//      billing_subscription_id=subscription, status='active', renewal_date.

const { BaseBillingProvider } = require('./base');

class StripeBillingProvider extends BaseBillingProvider {
  get name() { return 'stripe'; }
  get isConfigured() { return !!process.env.STRIPE_SECRET_KEY; }

  async createCheckoutSession(opts) {
    if (!this.isConfigured) {
      throw new Error('Stripe not configured: set STRIPE_SECRET_KEY');
    }
    // TODO: const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    //       const session = await stripe.checkout.sessions.create({ … });
    //       return { url: session.url };
    throw new Error('Stripe provider not yet implemented — see file header for wiring steps');
  }

  async createPortalSession(opts) {
    if (!this.isConfigured) throw new Error('Stripe not configured');
    throw new Error('Stripe portal not yet implemented');
  }

  async handleWebhook(rawBody, signature) {
    if (!this.isConfigured) throw new Error('Stripe not configured');
    throw new Error('Stripe webhook handling not yet implemented');
  }
}

module.exports = { StripeBillingProvider };
