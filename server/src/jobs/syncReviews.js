// Review sync worker.
//
// Iterates all platform_connections, asks each provider for new reviews, and
// upserts them into the reviews table. Dedup is enforced by the partial
// UNIQUE index on (business_id, platform, external_id) — a race-safe guarantee
// that re-running a sync never creates duplicate rows.
//
// Design choices worth noting:
//   - Synthesised reviews from the sync worker skip email notifications.
//     Otherwise the first sync would blast the owner's inbox with 5 alerts
//     for historical backfill. If/when email-on-sync is desired, gate it on
//     the age of the review (e.g. created_at within the last hour).
//   - Errors are caught per-connection so one broken provider doesn't stop
//     the rest. The error string is stored in last_sync_error for surfacing
//     in the UI.
//   - Each connection's sync runs inside a transaction — either all its new
//     reviews land and last_synced_at advances, or nothing changes.

const { get, all, insert, run, transaction } = require('../db/schema');
const { getProvider } = require('../lib/providers');
const { analyzeSentiment } = require('../db/seed');
const { captureException } = require('../lib/errorReporter');

// Only platforms with an implemented provider (lib/providers/*.js) belong
// here — the cron job will skip rows whose platform isn't on this list.
// This is intentionally narrower than lib/platforms.VALID_PLATFORMS, which
// covers manual + webhook ingestion paths that don't need a provider class.
const VALID_PLATFORMS = ['google', 'yelp', 'facebook', 'tripadvisor', 'trustpilot', 'wongnai', 'mock'];

// Sync a single connection row. Returns { inserted, error }.
async function syncOne(connectionId) {
  const conn = get('SELECT * FROM platform_connections WHERE id = ?', [connectionId]);
  if (!conn) return { inserted: 0, error: 'Connection not found' };

  let provider;
  try {
    provider = getProvider(conn);
  } catch (err) {
    run(
      'UPDATE platform_connections SET last_sync_error = ? WHERE id = ?',
      [err.message, conn.id]
    );
    return { inserted: 0, error: err.message };
  }

  let reviews;
  try {
    reviews = await provider.fetchReviews({ since: conn.last_synced_at });
  } catch (err) {
    run(
      'UPDATE platform_connections SET last_sync_error = ?, last_synced_at = datetime(\'now\') WHERE id = ?',
      [err.message, conn.id]
    );
    return { inserted: 0, error: err.message };
  }

  // Upsert reviews inside a transaction for atomicity.
  let inserted = 0;
  try {
    transaction((tx) => {
      for (const r of reviews) {
        // Dedup check: the partial UNIQUE index would reject the insert, but
        // an explicit pre-check keeps the inserted counter accurate and
        // avoids "UNIQUE constraint failed" noise in the logs.
        const existing = get(
          'SELECT id FROM reviews WHERE business_id = ? AND platform = ? AND external_id = ?',
          [conn.business_id, conn.provider, r.external_id]
        );
        if (existing) continue;

        const sentiment = analyzeSentiment(r.rating, r.review_text || '');
        tx.run(
          `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text,
                                sentiment, external_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            conn.business_id,
            conn.provider, // 'google' / 'yelp' / 'facebook' — kept even when mock provider generated the data, so UI platform filters behave consistently
            r.reviewer_name,
            r.rating,
            r.review_text || '',
            sentiment,
            r.external_id,
            r.created_at || new Date().toISOString(),
            r.created_at || new Date().toISOString(),
          ]
        );
        inserted++;
      }
      tx.run(
        `UPDATE platform_connections
         SET last_synced_at = datetime('now'),
             last_sync_error = NULL,
             reviews_synced_count = reviews_synced_count + ?
         WHERE id = ?`,
        [inserted, conn.id]
      );
    });
  } catch (err) {
    run(
      'UPDATE platform_connections SET last_sync_error = ? WHERE id = ?',
      [`Sync transaction failed: ${err.message}`, conn.id]
    );
    return { inserted: 0, error: err.message };
  }

  return { inserted, error: null };
}

// Sync every connection in the DB. Called by the scheduler on a timer and
// optionally by the manual-sync route.
async function syncAll(filter = {}) {
  const connections = filter.businessId
    ? all('SELECT id FROM platform_connections WHERE business_id = ?', [filter.businessId])
    : all('SELECT id FROM platform_connections');

  let totalInserted = 0;
  const results = [];
  for (const { id } of connections) {
    const r = await syncOne(id);
    totalInserted += r.inserted;
    results.push({ connectionId: id, ...r });
  }
  return { totalInserted, connectionCount: connections.length, results };
}

// Periodic scheduler. Runs shortly after boot then on an interval.
// Configurable via SYNC_INTERVAL_MS (default 15 min). Set to 0 to disable.
//
// Overlap guard: syncAll iterates N platform connections with N external
// API calls. On a Business account with many locations, or during a
// provider outage with long timeouts, one tick can easily exceed the
// interval. Without a running-flag, the next tick fires on top of the
// previous, hitting providers twice concurrently (which triggers the
// provider's per-client rate limiter and makes both fail). `running`
// guards against that.
let _intervalHandle = null;
let _running = false;
async function runSyncTickSafely(label) {
  if (_running) {
    console.warn(`[SYNC] ${label}: previous tick still running — skipping`);
    return;
  }
  _running = true;
  try {
    const r = await syncAll();
    if (r.totalInserted > 0 || label === 'initial') {
      console.log(`[SYNC] ${label}: ${r.totalInserted} new review(s) across ${r.connectionCount} connection(s)`);
    }
  } catch (e) {
    console.error(`[SYNC] ${label} failed:`, e.message);
    captureException(e, { job: 'syncReviews', op: label });
  } finally {
    _running = false;
  }
}
function startSyncScheduler() {
  const intervalMs = parseInt(process.env.SYNC_INTERVAL_MS || '900000', 10);
  if (!intervalMs) {
    console.log('[SYNC] Scheduler disabled (SYNC_INTERVAL_MS=0)');
    return;
  }
  // First sync 5 s after boot — gives the DB time to settle, keeps boot fast.
  setTimeout(() => { runSyncTickSafely('initial'); }, 5000);
  _intervalHandle = setInterval(() => { runSyncTickSafely('tick'); }, intervalMs);
  _intervalHandle.unref?.(); // don't keep the process alive just for this timer
  console.log(`[SYNC] Scheduler active (every ${Math.round(intervalMs / 1000)}s)`);
}

function stopSyncScheduler() {
  if (_intervalHandle) { clearInterval(_intervalHandle); _intervalHandle = null; }
}

module.exports = { syncOne, syncAll, startSyncScheduler, stopSyncScheduler, VALID_PLATFORMS };
