// Billing routes: checkout, customer portal, and webhook.
//
// Webhooks require the RAW request body (the JSON bytes as-is, not parsed)
// for HMAC signature verification. The app's top-level express.json()
// middleware would consume the body before we get here, so the webhook
// route uses express.raw() attached directly on itself — this has to happen
// BEFORE any JSON parsing, which is why the webhook is mounted on a distinct
// path that app.js excludes from the global json parser.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, run, all } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { getBilling } = require('../lib/billing');
const { PLANS, getPlan } = require('../lib/billing/plans');
const { logAudit } = require('../lib/audit');
const { captureException } = require('../lib/errorReporter');

const router = express.Router();

// Rate limit checkout — users shouldn't need to hit this more than a few
// times per minute.
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many checkout attempts, please wait a moment' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/billing/checkout — requires auth. Body: { plan, cycle }.
// Returns { url } for the frontend to redirect to.
router.post('/checkout', checkoutLimiter, authMiddleware, async (req, res) => {
  try {
    const { plan, cycle = 'monthly' } = req.body || {};
    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan. Valid plans: ' + Object.keys(PLANS).join(', ') });
    }
    if (plan === 'free') {
      return res.status(400).json({ error: 'Free plan does not require checkout' });
    }
    if (!['monthly', 'annual'].includes(cycle)) {
      return res.status(400).json({ error: 'Invalid cycle. Must be monthly or annual.' });
    }

    const user = get('SELECT id, email FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Block checkout when the user already has an active paid subscription.
    // Without this, a user on Starter could hit Pro's Upgrade button and
    // end up with TWO active LS subscriptions, double-billed. Send them to
    // the customer portal to change plan via LS's plan-switch flow.
    const currentSub = get(
      `SELECT plan, status, billing_subscription_id FROM subscriptions WHERE user_id = ?`,
      [req.user.id]
    );
    const activePaid =
      currentSub &&
      currentSub.status === 'active' &&
      currentSub.plan && currentSub.plan !== 'free' &&
      currentSub.billing_subscription_id;
    if (activePaid) {
      return res.status(409).json({
        error: 'You already have an active paid subscription. Use "Manage billing" in Settings to change plan or cancel.',
        code: 'already_subscribed',
      });
    }

    const billing = getBilling();
    if (!billing) {
      return res.status(503).json({ error: 'Billing is not configured on this deployment' });
    }
    if (!billing.isConfigured) {
      return res.status(503).json({ error: 'Billing provider credentials are not set' });
    }

    const base = process.env.CLIENT_URL || 'http://localhost:5173';
    const session = await billing.createCheckoutSession({
      userId: user.id,
      email: user.email,
      planId: plan,
      cycle,
      successUrl: `${base}/settings?upgraded=1`,
      cancelUrl: `${base}/pricing?checkout=cancelled`,
    });

    logAudit(req, 'billing.checkout_started', {
      userId: user.id,
      metadata: { plan, cycle, provider: billing.name },
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json({ url: session.url });
  } catch (err) {
    captureException(err, { kind: 'billing.checkout', userId: req.user?.id });
    res.status(500).json({ error: 'Could not start checkout. Please try again or contact support.' });
  }
});

// POST /api/billing/portal — requires auth + existing subscription. Returns
// a URL to the provider's customer portal where the user can manage their
// subscription (change card, cancel, upgrade).
// Same cadence as checkout — these endpoints both produce provider URLs.
// 10/min/user is plenty for a UI button and blunts spam if the user's
// session is compromised.
router.post('/portal', checkoutLimiter, authMiddleware, async (req, res) => {
  try {
    const sub = get(
      `SELECT billing_provider, billing_provider_id
       FROM subscriptions WHERE user_id = ?`,
      [req.user.id]
    );
    if (!sub?.billing_provider_id) {
      return res.status(400).json({
        error: 'No active subscription — upgrade first before accessing the billing portal',
      });
    }

    const billing = getBilling();
    if (!billing || !billing.isConfigured) {
      return res.status(503).json({ error: 'Billing not configured' });
    }

    const base = process.env.CLIENT_URL || 'http://localhost:5173';
    const session = await billing.createPortalSession({
      customerId: sub.billing_provider_id,
      returnUrl: `${base}/settings`,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json({ url: session.url });
  } catch (err) {
    captureException(err, { kind: 'billing.portal', userId: req.user?.id });
    res.status(500).json({ error: 'Could not open billing portal. Please try again.' });
  }
});

// POST /api/billing/webhook — RAW body, signature verified by the provider.
// Mounted separately in app.js with express.raw() so req.body here is a Buffer.
// Returns 200 fast; any DB work happens before return but shouldn't block
// longer than ~1 second (LS retries on timeout).
async function webhookHandler(req, res) {
  try {
    const billing = getBilling();
    if (!billing || !billing.isConfigured) {
      // If billing isn't configured, 200 the webhook anyway so the provider
      // doesn't retry endlessly against a dev-mode deployment.
      return res.status(200).json({ ok: true, note: 'billing not configured' });
    }

    const signature =
      req.headers['x-signature'] ||
      req.headers['x-lemonsqueezy-signature'] ||
      req.headers['x-webhook-signature'] ||
      '';

    const parsed = await billing.handleWebhook(req.body, signature);

    // Idempotency: LemonSqueezy retries on network errors. A second delivery
    // of the same webhook should return 200 without re-running the DB write.
    // Prefer the header event id (what LS echoes on retry), fall back to
    // parsing the raw payload's meta.webhook_id if available.
    const eventId =
      req.headers['x-event-id'] ||
      req.headers['x-webhook-id'] ||
      parsed.eventId ||
      null;

    // Idempotency: atomically claim the event_id. INSERT OR IGNORE returns
    // changes=1 if THIS request wrote the row, changes=0 if a previous
    // delivery already claimed it. SQLite serialises writes so concurrent
    // deliveries can't both win.
    //
    // We can't put the claim + the async reconcile into a single sync
    // transaction (reconcile is async), so we claim first and ROLL BACK the
    // claim if reconcile throws. Without the rollback, a retry would be
    // falsely deduped and the reconcile would be permanently lost.
    const { getDb } = require('../db/schema');
    const db = await getDb();
    if (eventId) {
      const info = db.prepare(
        `INSERT OR IGNORE INTO webhook_events (event_id, provider, event_name) VALUES (?, ?, ?)`
      ).run(String(eventId), 'lemonsqueezy', parsed.eventName || null);
      if (info.changes === 0) {
        return res.status(200).json({ ok: true, event: parsed.eventName, deduped: true });
      }
    }

    try {
      await reconcileFromWebhook(parsed);
    } catch (reconcileErr) {
      // Release the claim so a retry actually re-runs reconcile. Best-effort;
      // if the release itself fails we still throw the ORIGINAL error below.
      if (eventId) {
        try {
          db.prepare(`DELETE FROM webhook_events WHERE event_id = ?`).run(String(eventId));
        } catch { /* swallow */ }
      }
      throw reconcileErr;
    }

    res.status(200).json({ ok: true, event: parsed.eventName });
  } catch (err) {
    // Signature-verify failures → 401. Parse failures → 400. Everything else → 500.
    // Never echo err.message — can leak SDK internals or provider error payloads.
    const status = err.status || (err.message?.includes('signature') ? 401 : err.message?.includes('JSON') ? 400 : 500);
    // Don't page on 401 — a bad signature usually means a misconfigured
    // webhook secret in Railway, not a code defect, and LemonSqueezy will
    // retry on every event so a single bad-secret minute can flood Sentry.
    // Still log a warning-level breadcrumb (downgraded from exception) so
    // the operator sees it; just doesn't trip alert routing.
    if (status === 401) {
      console.warn('[billing.webhook] signature verification failed — check LEMONSQUEEZY_WEBHOOK_SECRET');
    } else {
      captureException(err, { kind: 'billing.webhook', status });
    }
    res.status(status).json({ error: status === 401 ? 'Invalid signature' : status === 400 ? 'Invalid payload' : 'Webhook processing failed' });
  }
}
router.post('/webhook', webhookHandler);

// Reconcile our DB state from a verified webhook event.
// LS events we care about:
//   - subscription_created     → plan activated, store customer + sub IDs
//   - subscription_updated     → status change (active/past_due/cancelled/expired)
//   - subscription_cancelled   → user cancelled; access until current period ends
//   - subscription_expired     → grace period ended; downgrade to free
//   - subscription_resumed     → re-subscribed; reactivate
//   - subscription_paused / _unpaused → status changes we mirror
//
// Strategy: fetch the user by custom_data.user_id (set at checkout) and
// update their subscription row. Idempotent — multiple deliveries of the
// same event just write the same values.
async function reconcileFromWebhook({ eventName, custom, data }) {
  const userId = parseInt(custom.user_id, 10);
  if (!Number.isInteger(userId)) {
    throw new Error(`Webhook missing user_id in custom_data (event=${eventName})`);
  }
  const attrs = data?.attributes || {};
  const subscriptionId = data?.id || null;
  const customerId = attrs.customer_id ? String(attrs.customer_id) : null;
  const status = attrs.status || 'unknown';
  const renewalDate = attrs.renews_at || null;

  // Map LS event + status to our subscription columns.
  switch (eventName) {
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_resumed':
    case 'subscription_unpaused': {
      const plan = custom.plan || mapVariantIdToPlan(attrs.variant_id);
      run(
        `UPDATE subscriptions
           SET plan = COALESCE(?, plan),
               status = ?,
               billing_provider = 'lemonsqueezy',
               billing_provider_id = ?,
               billing_subscription_id = ?,
               renewal_date = ?,
               cancel_at = NULL
         WHERE user_id = ?`,
        [plan, status === 'active' ? 'active' : status, customerId, subscriptionId, renewalDate, userId]
      );
      break;
    }
    case 'subscription_cancelled':
    case 'subscription_paused': {
      run(
        `UPDATE subscriptions
           SET status = ?, cancel_at = ?
         WHERE user_id = ?`,
        [status, attrs.ends_at || renewalDate, userId]
      );
      break;
    }
    case 'subscription_expired': {
      // Grace period ended — downgrade to free.
      run(
        `UPDATE subscriptions
           SET plan = 'free', status = 'active',
               billing_subscription_id = NULL,
               cancel_at = NULL,
               renewal_date = NULL
         WHERE user_id = ?`,
        [userId]
      );
      break;
    }
    default:
      // Not a subscription event we care about (e.g., order_created). No-op.
      return;
  }

  // Audit trail — every state change is worth logging
  const { logAudit } = require('../lib/audit');
  logAudit(null, `billing.${eventName}`, {
    userId,
    metadata: { status, subscriptionId, customerId },
  });
}

// Map LS variant ID → our plan slug. This only runs if custom_data is
// missing (defensive — the checkout flow always sets it). The matching
// env vars are the same ones the checkout uses.
function mapVariantIdToPlan(variantId) {
  if (!variantId) return null;
  const str = String(variantId);
  const pairs = [
    ['starter', process.env.LS_VARIANT_STARTER_MONTHLY],
    ['starter', process.env.LS_VARIANT_STARTER_ANNUAL],
    ['pro', process.env.LS_VARIANT_PRO_MONTHLY],
    ['pro', process.env.LS_VARIANT_PRO_ANNUAL],
    ['business', process.env.LS_VARIANT_BUSINESS_MONTHLY],
    ['business', process.env.LS_VARIANT_BUSINESS_ANNUAL],
  ];
  for (const [plan, vid] of pairs) {
    if (vid && str === String(vid)) return plan;
  }
  return null;
}

// GET /api/billing/promptpay?plan=starter&cycle=monthly
//
// Returns an EMVCo PromptPay QR payload string for Thai customers paying
// directly from a banking app. Inert (501) until PROMPTPAY_ID env is set.
//
// Note: this is a manual rail — we don't auto-confirm payment. The customer
// pays, screenshots their banking-app receipt, and the operator manually
// flips them to a paid plan via /admin. For low-volume Thai SMB accounts
// this is significantly cheaper than card processing fees, even with the
// reconciliation overhead.
router.get('/promptpay', authMiddleware, (req, res) => {
  try {
    const { isConfigured, buildPayload } = require('../lib/promptpay');
    if (!isConfigured()) {
      return res.status(501).json({ error: 'PromptPay is not configured on this deployment' });
    }
    const planKey = String(req.query.plan || '').toLowerCase();
    const cycle = req.query.cycle === 'annual' ? 'annual' : 'monthly';
    if (!planKey || !PLANS[planKey] || planKey === 'free') {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    const plan = PLANS[planKey];
    // Convert USD plan price → THB for the PromptPay amount. Use a fixed
    // rate from env to avoid runtime FX dependence; operator updates env
    // when the rate drifts >5%. Reasonable default: 1 USD ≈ 36 THB.
    const usd = cycle === 'annual' ? plan.priceAnnualUsd : plan.priceMonthlyUsd;
    const fx = parseFloat(process.env.PROMPTPAY_USD_THB || '36');
    const amountThb = Math.round(usd * fx);
    const payload = buildPayload({ id: process.env.PROMPTPAY_ID, amount: amountThb });
    if (!payload) return res.status(500).json({ error: 'Failed to build QR payload' });
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({
      payload,
      amount_thb: amountThb,
      amount_usd: usd,
      receiver_name: process.env.PROMPTPAY_NAME || 'ReviewHub',
      plan: planKey,
      cycle,
    });
  } catch (err) {
    captureException(err, { route: 'billing.promptpay' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.webhookHandler = webhookHandler;
