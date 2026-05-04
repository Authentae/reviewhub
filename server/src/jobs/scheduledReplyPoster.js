// Scheduled reply poster.
//
// When a user saves a reply with `scheduled_post_at` set, the /respond
// route stores response_text but does NOT call the platform's reply
// API. This job runs every 5 minutes, finds reviews whose scheduled
// time is now in the past, and fires the platform call. Sets
// response_posted_at on success and clears scheduled_post_at so the
// row's queue/posted state is unambiguous from those two columns.
//
// Why a queued post matters: owners often draft replies at 2am or on
// weekends, but a reply landing publicly at 2am Sunday looks like an
// algorithm or VA, not the owner. Scheduling the post for Monday 9am
// preserves the human-replied-to-me feel.
//
// Idempotency: SET response_posted_at THEN scheduled_post_at = NULL in
// the same UPDATE so no other tick can pick the same row up. If the
// platform call fails, we leave scheduled_post_at intact and bump a
// retry counter (TODO future) — for now, a failure means the next
// tick will try again.

const { all, run, get } = require('../db/schema');
const { captureException } = require('../lib/errorReporter');

async function runScheduledReplyPoster() {
  const sent = [];
  const errors = [];

  // Pull due rows: scheduled time has passed, response_text is set,
  // not yet posted. LIMIT prevents a single tick from spending forever
  // on a backlog after a long outage.
  const dueRows = all(
    `SELECT id, business_id, platform, external_id, response_text, scheduled_post_at
       FROM reviews
      WHERE scheduled_post_at IS NOT NULL
        AND scheduled_post_at <= datetime('now')
        AND response_text IS NOT NULL
        AND response_text <> ''
        AND response_posted_at IS NULL
      ORDER BY scheduled_post_at ASC
      LIMIT 100`
  );

  if (dueRows.length === 0) return { sent: 0, errors: 0 };

  // Resolve which platforms are auto-post-enabled. Same logic as the
  // /respond route. If the operator has explicitly disabled platforms
  // we skip everything — even though the reply was scheduled, the
  // operator's later disable is the latest signal.
  const rawEnv = process.env.REPLY_TO_PLATFORMS;
  const enabled = rawEnv === undefined
    ? ['google']
    : rawEnv.split(',').map(s => s.trim()).filter(Boolean);

  for (const row of dueRows) {
    if (!enabled.includes(row.platform)) {
      // Platform disabled — clear the schedule so we don't keep retrying
      // forever, but DON'T set response_posted_at because we never
      // actually posted. Operator can re-enable and re-schedule later.
      run(
        `UPDATE reviews SET scheduled_post_at = NULL WHERE id = ?`,
        [row.id]
      );
      continue;
    }
    if (!row.external_id) {
      // No external_id means we can't post (only locally-imported
      // reviews lack one). Clear schedule, leave response_text intact.
      run(`UPDATE reviews SET scheduled_post_at = NULL WHERE id = ?`, [row.id]);
      continue;
    }

    try {
      const conn = get(
        `SELECT * FROM platform_connections WHERE business_id = ? AND provider = ?`,
        [row.business_id, row.platform]
      );
      if (!conn) {
        // Platform was disconnected after the user scheduled. Clear
        // schedule so we don't loop; the user has to manually re-post
        // after reconnecting.
        run(`UPDATE reviews SET scheduled_post_at = NULL WHERE id = ?`, [row.id]);
        continue;
      }

      const { getProvider } = require('../lib/providers');
      const provider = getProvider(conn);
      if (!provider || typeof provider.replyToReview !== 'function') {
        run(`UPDATE reviews SET scheduled_post_at = NULL WHERE id = ?`, [row.id]);
        continue;
      }

      await provider.replyToReview(row.external_id, row.response_text);

      // Atomic: set posted_at AND clear schedule in one statement so
      // no other tick can race us into picking this row up again.
      run(
        `UPDATE reviews
            SET response_posted_at = datetime('now'),
                scheduled_post_at = NULL
          WHERE id = ?`,
        [row.id]
      );
      sent.push({ id: row.id, platform: row.platform });
    } catch (err) {
      // Leave scheduled_post_at intact so the next tick retries.
      // Real production fix is exponential backoff + retry-counter,
      // but for v1 a 5-min retry loop is acceptable.
      errors.push({ id: row.id, error: err.message });
      captureException(err, {
        job: 'scheduledReplyPoster',
        reviewId: row.id,
        platform: row.platform,
      });
    }
  }

  return { sent: sent.length, errors: errors.length, details: { sent, errors } };
}

let _handle = null;

function startScheduledReplyPoster() {
  // Default 5 min. Override via SCHEDULED_POSTER_INTERVAL_MS. Set 0 to disable.
  const intervalMs = parseInt(
    process.env.SCHEDULED_POSTER_INTERVAL_MS || String(5 * 60 * 1000),
    10
  );
  if (!intervalMs) {
    console.log('[SCHEDULED-POSTER] Scheduler disabled (SCHEDULED_POSTER_INTERVAL_MS=0)');
    return;
  }
  // Initial tick 30s after boot — soon enough that a server restart
  // doesn't delay queued replies by minutes, but late enough that the
  // rest of the boot path (DB migrations, scheduler init) settles first.
  setTimeout(() => {
    runScheduledReplyPoster().then(
      (r) => { if (r.sent > 0 || r.errors > 0) console.log(`[SCHEDULED-POSTER] initial: ${r.sent} sent, ${r.errors} errors`); },
      (e) => { console.error('[SCHEDULED-POSTER] initial failed:', e.message); captureException(e, { job: 'scheduledReplyPoster', op: 'initial' }); }
    );
  }, 30_000).unref?.();
  _handle = setInterval(() => {
    runScheduledReplyPoster().then(
      (r) => { if (r.sent > 0 || r.errors > 0) console.log(`[SCHEDULED-POSTER] tick: ${r.sent} sent, ${r.errors} errors`); },
      (e) => { console.error('[SCHEDULED-POSTER] tick failed:', e.message); captureException(e, { job: 'scheduledReplyPoster', op: 'tick' }); }
    );
  }, intervalMs);
  _handle.unref?.();
  console.log(`[SCHEDULED-POSTER] Scheduler active (every ${Math.round(intervalMs / 60 / 1000)}min)`);
}

function stopScheduledReplyPoster() {
  if (_handle) { clearInterval(_handle); _handle = null; }
}

module.exports = {
  runScheduledReplyPoster,
  startScheduledReplyPoster,
  stopScheduledReplyPoster,
};
