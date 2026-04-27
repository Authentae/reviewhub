require('dotenv').config();
const { createApp } = require('./app');
const { getDb } = require('./db/schema');
const { createDemoUser } = require('./db/seed');
const { verifySmtp } = require('./lib/email');
const { startSyncScheduler, stopSyncScheduler } = require('./jobs/syncReviews');
const { startDigestScheduler, stopDigestScheduler } = require('./jobs/weeklyDigest');
const { startFollowUpScheduler, stopFollowUpScheduler } = require('./jobs/followUpRequests');
const { startBackupScheduler, stopBackupScheduler } = require('./jobs/dailyBackup');
const { installGlobalHandlers } = require('./lib/errorReporter');

// Install process-wide error handlers before anything else runs so failures
// during boot are surfaced consistently.
installGlobalHandlers();

const PORT = process.env.PORT || 3001;

async function start() {
  await getDb();
  await createDemoUser();
  // Verify SMTP in background — don't block server start
  verifySmtp().catch(() => {});
  // Start the review-sync scheduler. Skip during tests so node:test runs
  // don't leave a dangling interval.
  if (process.env.NODE_ENV !== 'test') {
    startSyncScheduler();
    startDigestScheduler();
    startFollowUpScheduler();
    startBackupScheduler();
  }

  const app = createApp();
  const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

  // Graceful shutdown: drain in-flight requests, then checkpoint the WAL
  // and close the DB so the on-disk file is consolidated (no orphan -wal/-shm).
  function shutdown(signal) {
    console.log(`[${signal}] Shutting down gracefully…`);
    stopSyncScheduler();
    stopDigestScheduler();
    stopFollowUpScheduler();
    stopBackupScheduler();
    server.close(async () => {
      try {
        const db = await getDb();
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
      } catch (e) {
        console.error('DB close failed:', e.message);
      }
      console.log('Server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// If start() throws (bad DATABASE_PATH, schema migration error, missing
// JWT_SECRET in prod, etc.) the unhandledRejection handler in
// errorReporter just logs — it doesn't exit. Without an explicit catch
// here the process would hang in a half-booted state, the orchestrator
// (Railway/Docker) would see a zombie container, and ops would have no
// signal that the boot itself failed. Exit 1 so the supervisor restarts
// cleanly and the failure is visible in logs.
start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[BOOT] start() failed:', err?.stack || err);
  const { captureException } = require('./lib/errorReporter');
  captureException(err, { kind: 'boot-failure' });
  process.exit(1);
});
