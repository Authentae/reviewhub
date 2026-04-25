// Daily SQLite backup scheduler.
//
// Why it lives in-process (not as a host cron):
//   - Railway / Render / Fly.io don't give you reliable host cron. The supported
//     pattern is "do scheduled work inside the long-running web process."
//   - Keeps deployment a single artifact: container starts, backups happen.
//     No second worker, no extra bill.
//
// What it does:
//   - Every BACKUP_INTERVAL_HOURS (default 24h) takes a hot copy of reviews.db
//     into /app/backups via SQLite's online backup API (no writer block).
//   - Trims backups older than BACKUP_RETENTION_DAYS (default 30).
//   - Skipped in test env (would leak intervals into node:test runs).
//
// Persisting the backups across deploys:
//   - On Railway, mount a Volume at /app/backups (and /app/data for the live DB).
//   - Without a mounted volume, backups die with the container. That's a misconfig.
//
// Where to send backups OFF the box (recommended next step):
//   - Set BACKUP_S3_BUCKET / BACKUP_S3_KEY_PREFIX and we'll add S3 upload.
//   - Until then, backups live on the volume and are recoverable via the
//     hosting provider's volume snapshot feature.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_RETENTION_DAYS = 30;

let _handle = null;

function tsStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function runBackup() {
  const src = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'reviews.db');
  const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');

  if (!fs.existsSync(src)) {
    console.warn(`[BACKUP] Source DB missing at ${src}; skipping`);
    return { ok: false, reason: 'no-src' };
  }

  fs.mkdirSync(backupDir, { recursive: true });
  const dest = path.join(backupDir, `reviews-${tsStamp()}.db`);

  // Open read-only for the online backup. Concurrent writers on the live DB
  // are unaffected — SQLite's backup API copies pages while writes continue.
  const db = new Database(src, { readonly: true, fileMustExist: true });
  try {
    await db.backup(dest);
    const sizeMb = (fs.statSync(dest).size / 1024 / 1024).toFixed(2);
    console.log(`[BACKUP] OK dest=${dest} size=${sizeMb}MB`);

    // Retention sweep: delete backups older than N days. Doing it after a
    // successful new backup so a long failure streak doesn't accidentally
    // wipe the last good copy.
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS), 10);
    if (Number.isFinite(retentionDays) && retentionDays > 0) {
      const cutoff = Date.now() - retentionDays * 24 * 3600 * 1000;
      let trimmed = 0;
      for (const f of fs.readdirSync(backupDir)) {
        if (!f.startsWith('reviews-') || !f.endsWith('.db')) continue;
        const full = path.join(backupDir, f);
        try {
          if (fs.statSync(full).mtimeMs < cutoff) {
            fs.unlinkSync(full);
            trimmed++;
          }
        } catch { /* skip */ }
      }
      if (trimmed > 0) console.log(`[BACKUP] retention: trimmed ${trimmed} old file(s)`);
    }

    return { ok: true, dest };
  } catch (err) {
    console.error(`[BACKUP] FAILED: ${err.message}`);
    try { fs.unlinkSync(dest); } catch { /* ignore */ }
    return { ok: false, reason: err.message };
  } finally {
    db.close();
  }
}

function startBackupScheduler() {
  const intervalHours = parseFloat(process.env.BACKUP_INTERVAL_HOURS || String(DEFAULT_INTERVAL_HOURS));
  if (!intervalHours || intervalHours <= 0) {
    console.log('[BACKUP] Scheduler disabled (BACKUP_INTERVAL_HOURS=0)');
    return;
  }
  const intervalMs = Math.round(intervalHours * 3600 * 1000);

  // Run a backup ~60s after boot so a freshly-deployed container has a
  // recovery point even if it crashes within the first few hours. The cost
  // is one extra backup per deploy, which is fine.
  setTimeout(() => { runBackup().catch((e) => console.error('[BACKUP] initial:', e.message)); }, 60_000).unref?.();

  _handle = setInterval(() => {
    runBackup().catch((e) => console.error('[BACKUP] tick:', e.message));
  }, intervalMs);
  _handle.unref?.();
  console.log(`[BACKUP] Scheduler active (every ${intervalHours}h)`);
}

function stopBackupScheduler() {
  if (_handle) { clearInterval(_handle); _handle = null; }
}

module.exports = { runBackup, startBackupScheduler, stopBackupScheduler };
