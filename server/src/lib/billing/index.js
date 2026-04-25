// Billing provider registry + factory.
//
// Selected via BILLING_PROVIDER env var (default: 'stripe'). Supported values:
//   - 'stripe'         — direct Stripe (you handle tax compliance)
//   - 'paddle'         — Paddle Merchant of Record (they handle tax)
//   - 'lemonsqueezy'   — LemonSqueezy MoR (similar to Paddle)  [not yet wired]
//   - 'omise'          — Thai-domestic (PromptPay, local cards)  [not yet wired]
//   - 'none'           — billing disabled (self-hosted / trial-only mode)
//
// For solo founders selling globally, we recommend 'paddle' or
// 'lemonsqueezy' — see lib/billing/paddle.js header for the reasoning.

const { StripeBillingProvider } = require('./stripe');
const { PaddleBillingProvider } = require('./paddle');
const { LemonSqueezyBillingProvider } = require('./lemonsqueezy');

const REGISTRY = {
  stripe: StripeBillingProvider,
  paddle: PaddleBillingProvider,
  lemonsqueezy: LemonSqueezyBillingProvider,
  // Add omise etc. by implementing BaseBillingProvider and dropping the
  // class in here.
};

let _instance = null;

function getBilling() {
  if (_instance) return _instance;
  // Default to LemonSqueezy — for a solo Thai founder selling globally,
  // Merchant-of-Record providers handle tax compliance (VAT in EU/UK/JP/etc.,
  // sales tax in US states after Wayfair). Override with BILLING_PROVIDER
  // env var to switch to stripe, paddle, or 'none' (self-hosted / trial-only).
  const name = process.env.BILLING_PROVIDER || 'lemonsqueezy';
  if (name === 'none') {
    _instance = null;
    return null;
  }
  const Cls = REGISTRY[name];
  if (!Cls) {
    throw new Error(`Unknown BILLING_PROVIDER: ${name}. Valid: ${Object.keys(REGISTRY).join(', ')}, or 'none'`);
  }
  _instance = new Cls();
  return _instance;
}

function _resetForTests() { _instance = null; }

module.exports = { getBilling, _resetForTests };
