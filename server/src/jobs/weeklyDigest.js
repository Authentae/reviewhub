// Weekly digest emailer.
//
// For each user with notif_weekly_summary = 1, computes a short digest of
// review activity over the last 7 days and emails it. Runs once a week
// (configurable) on a fire-and-forget schedule managed alongside the sync
// scheduler in jobs/syncReviews.js.
//
// Design:
//   - Stateless: we recompute from scratch each run. No digest_sent_at
//     column yet; duplicate sends are possible if the process restarts
//     inside a tick, but the cost (one extra email) is acceptable for MVP.
//     Add idempotency via a last_digest_sent_at column when users complain.
//   - Silent when there's no activity: users with zero new reviews in the
//     last 7 days get no email (the alternative is weekly "0 reviews"
//     emails which train users to ignore the channel).
//   - Uses the same nodemailer transporter as review notifications; if
//     SMTP isn't configured, logs to console like the rest of the email lib.

const { all, get, run } = require('../db/schema');
const { sendWeeklyDigest } = require('../lib/email');

// Minimum hours between digests for the same user. Prevents duplicate sends
// when the scheduler tick happens multiple times in a week (e.g. the operator
// restarts the server, or an adhoc manual trigger fires soon after the regular
// one). Slightly less than 7 days so drift doesn't push the next send out a
// week — 6.5d means "at least once per 7-day window."
const MIN_HOURS_BETWEEN_DIGESTS = 156; // 6.5 days

async function runWeeklyDigest() {
  // Users opted in to the digest who haven't received one in the last 6.5 days.
  // Idempotency check is in SQL rather than JS so concurrent ticks can't both
  // select the same user. The julianday() delta is in days.
  //
  // Also plan-gated: the weekly digest is a paid feature. A Pro user who
  // enabled it then downgraded to Free keeps notif_weekly_summary=1 on
  // their row, but shouldn't keep receiving the paid perk. Checking the
  // subscription plan in the JOIN scopes the set correctly.
  const { planAllows } = require('../lib/billing/plans');
  const rows = all(
    `SELECT u.id, u.email, s.plan
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE u.notif_weekly_summary = 1
       AND u.email_verified_at IS NOT NULL
       AND (u.last_digest_sent_at IS NULL
            OR (julianday('now') - julianday(u.last_digest_sent_at)) * 24 >= ?)`,
    [MIN_HOURS_BETWEEN_DIGESTS]
  );
  const users = rows.filter((u) => planAllows(u.plan || 'free', 'weekly_digest'));

  const sent = [];
  for (const user of users) {
    const business = get('SELECT id, business_name FROM businesses WHERE user_id = ?', [user.id]);
    if (!business) continue;

    // Aggregate the last 7 days of reviews for this business.
    const stats = get(
      `SELECT
         COUNT(*) AS total,
         ROUND(AVG(rating), 1) AS avg_rating,
         SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) AS positive,
         SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) AS negative,
         SUM(CASE WHEN response_text IS NULL OR response_text = '' THEN 1 ELSE 0 END) AS unresponded
       FROM reviews
       WHERE business_id = ?
         AND created_at >= datetime('now', '-7 days')`,
      [business.id]
    );

    if (!stats || !stats.total) continue; // no activity → no email (see note above)

    // Fetch up to 3 review excerpts for the week: most negative first (most
    // actionable), then most recent. Unresponded ones float to the top within
    // each rating tier so the user sees what needs attention.
    const recentReviews = all(
      `SELECT reviewer_name, rating, platform, review_text, response_text
       FROM reviews
       WHERE business_id = ?
         AND created_at >= datetime('now', '-7 days')
       ORDER BY rating ASC,
                (CASE WHEN response_text IS NULL OR response_text = '' THEN 0 ELSE 1 END) ASC,
                created_at DESC
       LIMIT 3`,
      [business.id]
    );

    try {
      await sendWeeklyDigest(user.email, {
        userId: user.id,
        business_name: business.business_name,
        total: stats.total,
        avg_rating: stats.avg_rating,
        positive: stats.positive || 0,
        negative: stats.negative || 0,
        unresponded: stats.unresponded || 0,
        recentReviews,
      });
      // Mark the send so the next tick (and the next restart) skips this user
      // until the window reopens. Done after the await so a transient SMTP
      // failure doesn't burn the week's quota.
      run(`UPDATE users SET last_digest_sent_at = datetime('now') WHERE id = ?`, [user.id]);
      sent.push(user.email);
    } catch (err) {
      console.error(`[DIGEST] Failed for ${user.email}:`, err.message);
    }
  }
  return { sent: sent.length, recipients: sent };
}

let _digestHandle = null;
function startDigestScheduler() {
  // Default weekly (7 days). Override via DIGEST_INTERVAL_MS. Set to 0 to disable.
  const intervalMs = parseInt(process.env.DIGEST_INTERVAL_MS || String(7 * 24 * 3600 * 1000), 10);
  if (!intervalMs) {
    console.log('[DIGEST] Scheduler disabled (DIGEST_INTERVAL_MS=0)');
    return;
  }
  // Initial run ~30s after boot so restart-after-missed-tick still delivers
  // this week's digest. Idempotency (last_digest_sent_at) prevents a spam
  // loop if the process restarts repeatedly.
  setTimeout(() => {
    runWeeklyDigest().then(
      (r) => { if (r.sent > 0) console.log(`[DIGEST] initial: sent to ${r.sent} user(s)`); },
      (e) => console.error('[DIGEST] initial failed:', e.message)
    );
  }, 30_000).unref?.();
  _digestHandle = setInterval(() => {
    runWeeklyDigest().then(
      (r) => { if (r.sent > 0) console.log(`[DIGEST] sent to ${r.sent} user(s)`); },
      (e) => console.error('[DIGEST] run failed:', e.message)
    );
  }, intervalMs);
  _digestHandle.unref?.();
  console.log(`[DIGEST] Scheduler active (every ${Math.round(intervalMs / 3600 / 1000)}h)`);
}

function stopDigestScheduler() {
  if (_digestHandle) { clearInterval(_digestHandle); _digestHandle = null; }
}

module.exports = { runWeeklyDigest, startDigestScheduler, stopDigestScheduler };
