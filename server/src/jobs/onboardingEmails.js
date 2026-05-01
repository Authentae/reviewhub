// Lifecycle / onboarding emails.
//
// For each user that's verified their email AND has notif_onboarding=1 AND
// hasn't already received the day-N email, send the day-N template. Runs
// every 6h. Idempotent via the onboarding_emails table's UNIQUE(user_id,
// day_number) constraint — even if two ticks overlap, only one row wins.
//
// Schedule (matches docs/gtm/onboarding-email-sequence.md):
//   day 0  : >= 30 min after verification (gives the welcome flow time to land)
//   day 1  : >= 24h after verification, ONLY if user hasn't connected a platform
//   day 3  : >= 72h after verification
//   day 7  : >= 168h after verification, ONLY if still on free plan
//   day 14 : >= 336h after verification, ONLY if still on free plan
//
// Suppression: any user with plan != 'free' is skipped from day 7 onward —
// they've converted, no need to keep pitching them. Day 0/1/3 still go to
// new paid signups so they get product-orientation, not just lifecycle pitch.

const { all, run, get } = require('../db/schema');
const { sendOnboardingEmail } = require('../lib/email');
const { makeUnsubToken } = require('../lib/tokens');
const { captureException } = require('../lib/errorReporter');

// Minimum hours between verify and each day's send. Day 0 fires almost
// immediately (gives transactional welcome a head-start) but with a small
// floor so the user isn't bombed in the first 60 seconds.
const DAY_THRESHOLDS_HOURS = {
  0: 0.5,   // 30 min after verification
  1: 24,
  3: 72,
  7: 168,
  14: 336,
};

// Free-plan-only days. Sending day-7/14 to paid users would be off-tone
// (they've already converted — pitching the upgrade insults them).
const FREE_ONLY_DAYS = new Set([7, 14]);

// Day-1 has an extra "no platform connected" guard: if the user already
// connected a Google/Wongnai/etc account, the "stuck on setup?" copy is
// stale. They get day-3 onwards as normal.
const PLATFORM_CHECK_DAYS = new Set([1]);

async function runOnboardingEmails() {
  // Users in the onboarding window: verified, opted-in, and within 14d of verify.
  // The 14d upper bound caps history scans — we never re-trigger for users who
  // signed up months ago. Users created before this feature shipped can be
  // backfilled by setting their email_verified_at; absent that, they don't
  // get the lifecycle.
  const candidates = all(
    `SELECT u.id, u.email, u.preferred_lang, u.email_verified_at,
            COALESCE(s.plan, 'free') AS plan
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
      WHERE u.notif_onboarding = 1
        AND u.email_verified_at IS NOT NULL
        AND (julianday('now') - julianday(u.email_verified_at)) <= 21`
  );

  const sent = [];
  for (const user of candidates) {
    const hoursSinceVerify =
      (Date.now() - new Date(user.email_verified_at + 'Z').getTime()) / 3600 / 1000;

    for (const dayNumber of [0, 1, 3, 7, 14]) {
      const threshold = DAY_THRESHOLDS_HOURS[dayNumber];
      if (hoursSinceVerify < threshold) continue;

      // Skip free-only days for paid users
      if (FREE_ONLY_DAYS.has(dayNumber) && user.plan !== 'free') continue;

      // Already sent?
      const existing = get(
        `SELECT 1 FROM onboarding_emails WHERE user_id = ? AND day_number = ?`,
        [user.id, dayNumber]
      );
      if (existing) continue;

      // Day-1: skip if user has connected a platform (the setup-stuck pitch
      // doesn't make sense once they're past that step). Connection lives in
      // platform_connections — any row for this user counts.
      if (PLATFORM_CHECK_DAYS.has(dayNumber)) {
        const conn = get(
          `SELECT 1 FROM platform_connections pc
             JOIN businesses b ON b.id = pc.business_id
            WHERE b.user_id = ?`,
          [user.id]
        );
        if (conn) {
          // Mark as "skipped" so we don't re-check next tick. Insert the row
          // anyway; the user just doesn't get the email.
          run(`INSERT OR IGNORE INTO onboarding_emails (user_id, day_number) VALUES (?, ?)`, [user.id, dayNumber]);
          continue;
        }
      }

      const lang = (user.preferred_lang === 'th') ? 'th' : 'en';
      const apiBase = process.env.CLIENT_URL || 'http://localhost:5173';
      const unsubToken = makeUnsubToken(user.id, 'onboarding');
      const unsubUrl = `${apiBase}/api/auth/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

      try {
        await sendOnboardingEmail(user.email, dayNumber, lang, unsubUrl);
        // Insert AFTER successful send — a transient SMTP failure shouldn't
        // permanently mark the day as "done". UNIQUE constraint protects
        // against a concurrent tick double-sending.
        run(
          `INSERT OR IGNORE INTO onboarding_emails (user_id, day_number) VALUES (?, ?)`,
          [user.id, dayNumber]
        );
        sent.push({ userId: user.id, day: dayNumber });
      } catch (err) {
        console.error(`[ONBOARDING] day-${dayNumber} failed for ${user.email}:`, err.message);
        captureException(err, { job: 'onboardingEmails', op: 'sendOne', userId: user.id, day: dayNumber });
      }
    }
  }

  return { sent: sent.length, details: sent };
}

let _onboardingHandle = null;

function startOnboardingScheduler() {
  // Default 6h. Override via ONBOARDING_INTERVAL_MS. Set 0 to disable.
  const intervalMs = parseInt(process.env.ONBOARDING_INTERVAL_MS || String(6 * 3600 * 1000), 10);
  if (!intervalMs) {
    console.log('[ONBOARDING] Scheduler disabled (ONBOARDING_INTERVAL_MS=0)');
    return;
  }
  // Initial tick 60s after boot — give the rest of the boot path time to
  // finish (DB migrations, SMTP verify, etc) before scanning users.
  setTimeout(() => {
    runOnboardingEmails().then(
      (r) => { if (r.sent > 0) console.log(`[ONBOARDING] initial: ${r.sent} email(s) sent`); },
      (e) => { console.error('[ONBOARDING] initial failed:', e.message); captureException(e, { job: 'onboardingEmails', op: 'initial' }); }
    );
  }, 60_000).unref?.();
  _onboardingHandle = setInterval(() => {
    runOnboardingEmails().then(
      (r) => { if (r.sent > 0) console.log(`[ONBOARDING] tick: ${r.sent} email(s) sent`); },
      (e) => { console.error('[ONBOARDING] tick failed:', e.message); captureException(e, { job: 'onboardingEmails', op: 'tick' }); }
    );
  }, intervalMs);
  _onboardingHandle.unref?.();
  console.log(`[ONBOARDING] Scheduler active (every ${Math.round(intervalMs / 3600 / 1000)}h)`);
}

function stopOnboardingScheduler() {
  if (_onboardingHandle) { clearInterval(_onboardingHandle); _onboardingHandle = null; }
}

module.exports = { runOnboardingEmails, startOnboardingScheduler, stopOnboardingScheduler };
