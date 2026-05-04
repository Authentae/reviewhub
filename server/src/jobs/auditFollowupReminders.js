// Audit follow-up reminders.
//
// When a prospect opens an outbound audit URL but the founder hasn't
// followed up within 48h, this job emails the founder a "time to nudge
// them" reminder with a copy-pasteable follow-up template. Closes the
// "they opened it, I forgot, the warm window passed" attribution leak.
//
// Why we don't auto-send to the prospect: we don't have their email on
// record. The founder DM'd or emailed them themselves; ReviewHub only
// stores business_name + share_token. The reminder is a nudge to the
// founder, not the prospect.
//
// Schedule: runs every 6h (matches onboardingEmails cadence). Each
// audit row gets at most one reminder — last_followup_reminder_sent_at
// is set the moment we send, so a slow scan or restart can't double-fire.
//
// Suppression rules:
//   - first_viewed_at IS NULL → prospect never opened, nothing to nudge
//   - first_viewed_at < 48h ago → too early
//   - marked_as_replied_at IS NOT NULL → founder already followed up
//   - last_followup_reminder_sent_at IS NOT NULL → already nudged
//   - expires_at <= now → audit already expired, no point reminding

const { all, run, get } = require('../db/schema');
const { sendAuditFollowupReminder } = require('../lib/email');
const { captureException } = require('../lib/errorReporter');

const REMINDER_THRESHOLD_HOURS = 48;

async function runAuditFollowupReminders() {
  // Pull candidates: viewed >= 48h ago, not replied, not yet reminded,
  // not expired. Owner email + lang joined in so we don't need a second
  // query per row.
  const candidates = all(
    `SELECT a.id, a.business_name, u.email AS owner_email, u.preferred_lang
       FROM audit_previews a
       JOIN users u ON u.id = a.owner_user_id
      WHERE a.first_viewed_at IS NOT NULL
        AND a.marked_as_replied_at IS NULL
        AND a.last_followup_reminder_sent_at IS NULL
        AND datetime(a.first_viewed_at, '+' || ? || ' hours') <= datetime('now')
        AND datetime(a.expires_at) > datetime('now')
      LIMIT 500`,
    [REMINDER_THRESHOLD_HOURS]
  );

  const sent = [];
  for (const row of candidates) {
    if (!row.owner_email) continue;
    try {
      // Mark BEFORE the SMTP call so a slow mailer can't let a parallel
      // tick grab the same row and double-send. If the send then fails
      // the founder misses one reminder, which is strictly better than
      // getting two.
      run(
        `UPDATE audit_previews SET last_followup_reminder_sent_at = datetime('now') WHERE id = ?`,
        [row.id]
      );
      await sendAuditFollowupReminder(row.owner_email, {
        businessName: row.business_name,
        lang: row.preferred_lang || 'en',
      });
      sent.push({ id: row.id, business: row.business_name });
    } catch (err) {
      captureException(err, { job: 'auditFollowupReminders', auditId: row.id });
    }
  }

  return { sent: sent.length, details: sent };
}

let _handle = null;

function startAuditFollowupScheduler() {
  // Default 6h. Override via AUDIT_FOLLOWUP_INTERVAL_MS. Set 0 to disable.
  const intervalMs = parseInt(
    process.env.AUDIT_FOLLOWUP_INTERVAL_MS || String(6 * 3600 * 1000),
    10
  );
  if (!intervalMs) {
    console.log('[AUDIT-FOLLOWUP] Scheduler disabled (AUDIT_FOLLOWUP_INTERVAL_MS=0)');
    return;
  }
  // Initial tick 90s after boot — let other migrations and SMTP verify
  // settle first. Slightly later than onboardingEmails (60s) to avoid
  // a thundering-herd on outbound mail at startup.
  setTimeout(() => {
    runAuditFollowupReminders().then(
      (r) => { if (r.sent > 0) console.log(`[AUDIT-FOLLOWUP] initial: ${r.sent} reminder(s) sent`); },
      (e) => { console.error('[AUDIT-FOLLOWUP] initial failed:', e.message); captureException(e, { job: 'auditFollowupReminders', op: 'initial' }); }
    );
  }, 90_000).unref?.();
  _handle = setInterval(() => {
    runAuditFollowupReminders().then(
      (r) => { if (r.sent > 0) console.log(`[AUDIT-FOLLOWUP] tick: ${r.sent} reminder(s) sent`); },
      (e) => { console.error('[AUDIT-FOLLOWUP] tick failed:', e.message); captureException(e, { job: 'auditFollowupReminders', op: 'tick' }); }
    );
  }, intervalMs);
  _handle.unref?.();
  console.log(`[AUDIT-FOLLOWUP] Scheduler active (every ${Math.round(intervalMs / 3600 / 1000)}h)`);
}

function stopAuditFollowupScheduler() {
  if (_handle) { clearInterval(_handle); _handle = null; }
}

module.exports = {
  runAuditFollowupReminders,
  startAuditFollowupScheduler,
  stopAuditFollowupScheduler,
};
