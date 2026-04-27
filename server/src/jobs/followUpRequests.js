// Automatic review-request follow-up job.
//
// Finds review requests that were sent N days ago, haven't been clicked, and
// haven't already received a follow-up, then resends the email once.
//
// Requires Starter plan or higher (same gate as bulk sends).
// follow_up_after_days=0 on the user row means disabled (default).
//
// Design:
//   - Idempotent: follow_up_sent_at prevents a second follow-up even if the
//     scheduler ticks again before the window closes.
//   - No spam: one follow-up ever. After follow_up_sent_at is set, the row
//     is excluded from all future runs regardless of click state.
//   - Silent on already-clicked: if the customer clicked between the original
//     send and when the job runs, we skip — no need to follow up.

const { all, run } = require('../db/schema');
const { sendReviewRequest } = require('../lib/email');
const { generateToken } = require('../lib/tokens');
const { planAllows } = require('../lib/billing/plans');
const { captureException } = require('../lib/errorReporter');

async function runFollowUp() {
  // One query joins review_requests → businesses → users → subscriptions and
  // applies the time-window check in SQL (julianday delta >= the user's
  // configured threshold). Plan gating happens in JS afterwards because
  // `planAllows` is the cross-cutting source of truth for feature flags.
  // Upper bound on how old a request can be before we stop following up.
  // Protects against two scenarios:
  //   1. On first deploy: legacy requests from months ago would otherwise all
  //      match the window and fire a burst of retroactive follow-ups.
  //   2. Edge case where a user bumps follow_up_after_days from 3 to 14 — we
  //      don't want to suddenly flood them with follow-ups for anything sent
  //      between those two thresholds.
  const MAX_AGE_DAYS = 30;

  const pending = all(
    `SELECT rr.id, rr.customer_email, rr.customer_name, rr.platform, rr.message,
            b.business_name,
            u.id AS user_id, s.plan
     FROM review_requests rr
     JOIN businesses b ON b.id = rr.business_id
     JOIN users u ON u.id = b.user_id
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE u.follow_up_after_days > 0
       AND rr.clicked_at IS NULL
       AND rr.follow_up_sent_at IS NULL
       AND (julianday('now') - julianday(rr.sent_at)) >= u.follow_up_after_days
       AND (julianday('now') - julianday(rr.sent_at)) <= ?`,
    [MAX_AGE_DAYS]
  );

  if (pending.length === 0) return { sent: 0 };

  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  let sent = 0;

  for (const rr of pending) {
    if (!planAllows(rr.plan || 'free', 'templates')) continue;
    try {
      const { plaintext, hash } = generateToken();
      const trackUrl = `${baseUrl}/api/review-requests/track/${plaintext}`;

      // Regenerate token so the follow-up link works (old token stays valid
      // until this update overwrites it, which is fine — first click wins).
      run(
        "UPDATE review_requests SET token_hash = ?, follow_up_sent_at = datetime('now') WHERE id = ?",
        [hash, rr.id]
      );

      await sendReviewRequest({
        customerEmail: rr.customer_email,
        customerName: rr.customer_name,
        businessName: rr.business_name,
        platform: rr.platform,
        message: rr.message,
        trackUrl,
        isFollowUp: true,
      });
      sent++;
    } catch (err) {
      console.error(`[FOLLOW-UP] Failed for request ${rr.id}:`, err.message);
      captureException(err, { job: 'followUpRequests', op: 'sendOne', requestId: rr.id });
    }
  }

  return { sent };
}

let _handle = null;

function startFollowUpScheduler() {
  // Default: check every 6 hours. Override via FOLLOW_UP_INTERVAL_MS.
  const intervalMs = parseInt(process.env.FOLLOW_UP_INTERVAL_MS || String(6 * 3600 * 1000), 10);
  if (!intervalMs) {
    console.log('[FOLLOW-UP] Scheduler disabled (FOLLOW_UP_INTERVAL_MS=0)');
    return;
  }
  // Initial run 60s after boot to catch any missed sends from restarts.
  setTimeout(() => {
    runFollowUp().then(
      (r) => { if (r.sent > 0) console.log(`[FOLLOW-UP] initial: sent ${r.sent} follow-up(s)`); },
      (e) => { console.error('[FOLLOW-UP] initial failed:', e.message); captureException(e, { job: 'followUpRequests', op: 'initial' }); }
    );
  }, 60_000).unref?.();
  _handle = setInterval(() => {
    runFollowUp().then(
      (r) => { if (r.sent > 0) console.log(`[FOLLOW-UP] sent ${r.sent} follow-up(s)`); },
      (e) => { console.error('[FOLLOW-UP] run failed:', e.message); captureException(e, { job: 'followUpRequests', op: 'tick' }); }
    );
  }, intervalMs);
  _handle.unref?.();
  console.log(`[FOLLOW-UP] Scheduler active (every ${Math.round(intervalMs / 3600 / 1000)}h)`);
}

function stopFollowUpScheduler() {
  if (_handle) { clearInterval(_handle); _handle = null; }
}

module.exports = { runFollowUp, startFollowUpScheduler, stopFollowUpScheduler };
