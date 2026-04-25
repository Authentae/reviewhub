// Paddle billing provider (stub).
//
// **Why prefer Paddle over Stripe for a solo founder selling globally:**
// Paddle is a Merchant of Record — they become the legal seller of your
// software, collect sales tax/VAT from customers in ~40 countries, and
// remit it to the right authorities. For a solo operator in Thailand
// selling internationally, this eliminates the biggest hidden cost of
// running a SaaS: compliance with dozens of tax regimes (EU VAT, UK VAT,
// US state sales tax after the Wayfair decision, Canadian GST, Australian
// GST, etc.). Stripe does payments only; YOU are the merchant and YOU owe
// the taxes.
//
// Fees: Paddle takes ~5% + $0.50 vs Stripe's ~2.9% + $0.30. The extra 2%
// buys "never think about sales tax again" and is worth it below about
// $100K MRR. Above that, consider bringing compliance in-house with
// Stripe + a tax service like Stripe Tax or Anrok.
//
// LemonSqueezy works similarly (slightly higher fees, simpler UI). The
// interface here is identical so swapping providers is a code-change in
// one file.
//
// Activation:
//   - PADDLE_API_KEY (live or sandbox)
//   - PADDLE_WEBHOOK_SECRET (for signature verification)
//   - PADDLE_PRICE_STARTER, PADDLE_PRICE_PRO, PADDLE_PRICE_BUSINESS (price IDs)
//
// API: https://developer.paddle.com/api-reference

const { BaseBillingProvider } = require('./base');

class PaddleBillingProvider extends BaseBillingProvider {
  get name() { return 'paddle'; }
  get isConfigured() { return !!process.env.PADDLE_API_KEY; }

  async createCheckoutSession(opts) {
    if (!this.isConfigured) throw new Error('Paddle not configured: set PADDLE_API_KEY');
    // TODO: POST https://api.paddle.com/transactions
    //       Headers: Authorization: Bearer {PADDLE_API_KEY}
    //       Body: {items: [{price_id, quantity: 1}], customer: {email},
    //              custom_data: {userId}, collection_mode: 'automatic',
    //              checkout: {url: successUrl}}
    throw new Error('Paddle provider not yet implemented');
  }

  async createPortalSession(_opts) {
    if (!this.isConfigured) throw new Error('Paddle not configured');
    throw new Error('Paddle customer portal not yet implemented');
  }

  async handleWebhook(_rawBody, _signature) {
    if (!this.isConfigured) throw new Error('Paddle not configured');
    throw new Error('Paddle webhook handling not yet implemented');
  }
}

module.exports = { PaddleBillingProvider };
