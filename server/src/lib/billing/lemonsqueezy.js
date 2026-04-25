// LemonSqueezy billing provider — real implementation (not a stub).
//
// LemonSqueezy is a Merchant of Record: they're the legal seller, collect
// sales tax / VAT in ~40 countries, and pay us the net. For a Thai solo
// founder selling globally, this removes the single biggest operational
// burden (global tax compliance).
//
// Integration model:
//   - Prices (products/variants) are configured in the LS dashboard. Each
//     plan (Starter, Pro, Business) has a variant ID per billing cycle
//     (monthly / annual). Those IDs live in env vars (see setup below).
//   - createCheckoutSession() → calls LS API to create a checkout URL
//     scoped to a specific variant + customer email + metadata. Returns
//     {url} the frontend redirects to.
//   - Webhook (/api/billing/webhook) receives subscription_created,
//     subscription_updated, subscription_cancelled events. We verify
//     HMAC signature, then reconcile the user's subscription row.
//
// Required env vars:
//   LEMONSQUEEZY_API_KEY              — from Settings → API in LS dashboard
//   LEMONSQUEEZY_STORE_ID             — numeric store id (check URL)
//   LEMONSQUEEZY_WEBHOOK_SECRET       — per-webhook, from Settings → Webhooks
//   LS_VARIANT_STARTER_MONTHLY        — variant id for Starter monthly
//   LS_VARIANT_STARTER_ANNUAL         — variant id for Starter annual
//   LS_VARIANT_PRO_MONTHLY            — and so on...
//   LS_VARIANT_PRO_ANNUAL
//   LS_VARIANT_BUSINESS_MONTHLY
//   LS_VARIANT_BUSINESS_ANNUAL

const crypto = require('crypto');
const { BaseBillingProvider } = require('./base');

// Lazy-load the SDK so that when LEMONSQUEEZY_API_KEY is missing (dev / tests),
// the module loads without bombing. Initialisation happens inside the first
// method call that actually uses it.
let _lsClient = null;
function lsClient() {
  if (_lsClient) return _lsClient;
  const { lemonSqueezySetup } = require('@lemonsqueezy/lemonsqueezy.js');
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY,
    onError: (err) => {
      const { captureException } = require('../errorReporter');
      captureException(err, { kind: 'lemonsqueezy.sdk_error' });
    },
  });
  _lsClient = true; // setup is global; flag that we've done it
  return _lsClient;
}

// Map {planId, cycle} → LS variant ID from env vars. If the env var for a
// combination is missing, we refuse the checkout (instead of silently
// routing to the wrong product).
function resolveVariantId(planId, cycle = 'monthly') {
  const key = `LS_VARIANT_${planId.toUpperCase()}_${cycle.toUpperCase()}`;
  const id = process.env[key];
  if (!id) {
    throw new Error(
      `LemonSqueezy variant not configured for ${planId}/${cycle}. ` +
      `Set env var ${key} to the variant ID from your LS dashboard.`
    );
  }
  return id;
}

class LemonSqueezyBillingProvider extends BaseBillingProvider {
  get name() { return 'lemonsqueezy'; }

  get isConfigured() {
    return !!(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID);
  }

  // Create a hosted-checkout session and return the URL to redirect to.
  // opts: { userId, email, planId ('starter'|'pro'|'business'),
  //         cycle ('monthly'|'annual'), successUrl, cancelUrl }
  async createCheckoutSession(opts) {
    if (!this.isConfigured) {
      throw new Error('LemonSqueezy not configured: set LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID');
    }
    lsClient();

    const variantId = resolveVariantId(opts.planId, opts.cycle || 'monthly');
    const { createCheckout } = require('@lemonsqueezy/lemonsqueezy.js');

    const { data, error } = await createCheckout(
      process.env.LEMONSQUEEZY_STORE_ID,
      variantId,
      {
        checkoutOptions: {
          // Thai-friendly: LS detects locale from browser; nothing extra needed.
          embed: false,
          media: false, // cleaner checkout without marketing media
        },
        checkoutData: {
          email: opts.email,
          // Custom data rides back to us on the webhook so we can match the
          // LS subscription to our internal user.id. Do NOT put anything
          // sensitive here — it's sent to LS and echoed in webhooks.
          custom: {
            user_id: String(opts.userId),
            plan: opts.planId,
            cycle: opts.cycle || 'monthly',
          },
        },
        productOptions: {
          // Redirect URLs after successful / cancelled payment.
          redirectUrl: opts.successUrl,
        },
      }
    );
    if (error) throw new Error(`LemonSqueezy checkout creation failed: ${error.message}`);
    if (!data?.data?.attributes?.url) throw new Error('LemonSqueezy returned no checkout URL');
    return { url: data.data.attributes.url };
  }

  // Create a customer portal session — LS provides a hosted portal for
  // customers to manage their subscription (upgrade/cancel/update card).
  // opts: { customerId, returnUrl }
  async createPortalSession(opts) {
    if (!this.isConfigured) throw new Error('LemonSqueezy not configured');
    lsClient();
    const { getCustomer } = require('@lemonsqueezy/lemonsqueezy.js');
    const { data, error } = await getCustomer(opts.customerId);
    if (error) throw new Error(`LemonSqueezy portal fetch failed: ${error.message}`);
    const url = data?.data?.attributes?.urls?.customer_portal;
    if (!url) throw new Error('No customer portal URL returned');
    return { url };
  }

  // Verify an incoming webhook's HMAC signature. LS signs the raw body with
  // the webhook secret using HMAC-SHA256. If this doesn't match, the event
  // could be forged — reject.
  verifyWebhookSignature(rawBody, signature) {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) throw new Error('LEMONSQUEEZY_WEBHOOK_SECRET not set');
    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    // Timing-safe compare — same pattern we use everywhere else
    try {
      return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }

  // Parse + verify a webhook. Returns a normalised { eventName, eventId,
  // custom, data } the caller can act on without knowing LS-specific shape
  // details.
  async handleWebhook(rawBody, signature) {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      const err = new Error('Invalid webhook signature');
      err.status = 401;
      throw err;
    }
    const payload = JSON.parse(rawBody.toString('utf8'));
    const eventName = payload.meta?.event_name;
    const custom = payload.meta?.custom_data || {};
    // LS emits a per-delivery webhook_id in `meta.webhook_id` — use it as
    // our idempotency key when headers don't carry one (X-Event-Id is an
    // alternate but not guaranteed).
    const eventId = payload.meta?.webhook_id || null;
    return { eventName, eventId, custom, data: payload.data };
  }
}

module.exports = { LemonSqueezyBillingProvider };
