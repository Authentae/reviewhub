// POST /api/waitlist — capture email-on-pricing-page demand signal for
// gated plans (Pro / Business). Public (no auth). Idempotent via
// UNIQUE(email, plan) at the DB layer — same email + same plan = 200
// without inserting twice.
//
// Why this exists: pre-revenue, Pro/Business marketing pages were
// fake-shelf (visible, click-to-pay blocked server-side). The strategic
// audit (2026-05-18) flagged this as a credibility risk AND a wasted
// research opportunity. Replacing the dead "Coming soon" button with
// an email capture converts every pricing-page visitor who DOES want
// more than Starter into a quantifiable signal we can review weekly:
//   "Of N pricing visitors, M opted into Pro waitlist."
// If M is 0 over 30 days, we kill Pro/Business with confidence. If M
// is meaningful, we build what those M people most asked for.

const express = require('express');
const router = express.Router();
const { insert, get } = require('../db/schema');
const { captureException } = require('../lib/errorReporter');

// Tightish rate limit — public endpoint, no auth, easy spam target.
// Keep cost low: 5 submissions per IP per 15 min covers honest
// re-clicks (double-submit, typo retry) but stops mass insertion.
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again in a few minutes' },
});

// Allowlist of plan IDs we accept. Prevents arbitrary strings filling
// the table. Keep in sync with server/src/lib/billing/plans.js coming_soon
// flags — if we ungate a plan, drop it here so we stop accepting waitlist
// signups for the now-sellable tier.
const VALID_PLANS = new Set(['pro', 'business']);

// Loose email validator — same shape as auth.js isValidEmail. We
// don't need RFC-grade strictness; we just want to reject obvious
// garbage. Real verification happens when we email the waitlist
// later (bounces = invalid).
function isValidEmail(s) {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

router.post('/', limiter, async (req, res) => {
  try {
    const rawEmail = (req.body?.email || '').toString().trim().toLowerCase();
    const rawPlan = (req.body?.plan || '').toString().trim().toLowerCase();
    const rawSource = (req.body?.source || 'pricing').toString().trim().toLowerCase().slice(0, 32);

    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (!VALID_PLANS.has(rawPlan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // INSERT OR IGNORE: same (email, plan) twice = no error, no
    // duplicate row. Frontend can treat 200 as success regardless of
    // whether this was a first-time signup or a re-submit.
    const existing = get('SELECT id, created_at FROM waitlist_signups WHERE email = ? AND plan = ?', [rawEmail, rawPlan]);
    if (existing) {
      return res.status(200).json({ ok: true, already: true });
    }

    insert(
      `INSERT INTO waitlist_signups (email, plan, source) VALUES (?, ?, ?)`,
      [rawEmail, rawPlan, rawSource]
    );

    // Founder alert — same pattern as the Stripe-signup alert in
    // /auth/register. Email goes to FOUNDER_ALERT_EMAIL so Earth sees
    // every Pro/Business waitlist signup in his Gmail and can decide
    // whether the demand justifies actually building the tier.
    try {
      const founderAlert = process.env.FOUNDER_ALERT_EMAIL || 'earth.reviewhub@gmail.com';
      const { getTransporter } = require('../lib/email');
      const transporter = typeof getTransporter === 'function' ? getTransporter() : null;
      if (transporter) {
        // Aggregate-since-launch count for context — tells Earth at a
        // glance if this is signup #1 or signup #47.
        const { all } = require('../db/schema');
        const countRow = all('SELECT COUNT(*) AS n FROM waitlist_signups WHERE plan = ?', [rawPlan])[0];
        const total = countRow?.n || 1;
        transporter.sendMail({
          from: process.env.SMTP_FROM || 'ReviewHub <hello@reviewhub.review>',
          to: founderAlert,
          subject: `📊 ${rawPlan} waitlist signup — ${rawEmail} (total: ${total})`,
          text:
            `Someone just joined the ${rawPlan} waitlist on /pricing.\n\n` +
            `Email: ${rawEmail}\nPlan: ${rawPlan}\nSource: ${rawSource}\n` +
            `Total ${rawPlan} signups since launch: ${total}\n\n` +
            `Decision threshold: 5+ signups = consider building ${rawPlan} features.\n` +
            `Below threshold = keep collecting demand signal.\n\n` +
            `View all signups in admin (when /admin/waitlist exists) or query:\n` +
            `  SELECT email, source, created_at FROM waitlist_signups WHERE plan='${rawPlan}' ORDER BY created_at DESC;\n`,
        }).catch(() => { /* fire-and-forget; we don't want SMTP delay blocking the signup ack */ });
      }
    } catch (alertErr) {
      // Founder alert is best-effort. A SMTP hiccup must not break the
      // user-facing signup — the row is in the DB either way.
      captureException(alertErr, { kind: 'waitlist.founder-alert', email: rawEmail, plan: rawPlan });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    captureException(err, { route: 'waitlist', op: 'create' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
