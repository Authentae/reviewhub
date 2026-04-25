#!/usr/bin/env node
// SQLite online-backup script.
//
// Uses better-sqlite3's `db.backup()` which performs a hot backup without
// blocking writers (via SQLite's online backup API) — safe to run against a
// live production DB. Output is a single consolidated file with no -wal/-shm
// sidecars.
//
// Usage:
//   node scripts/backup-db.js                # writes to backups/reviews-YYYYMMDD-HHMMSS.db
//   node scripts/backup-db.js /path/out.db   # explicit destination
//
// Designed to be run from cron / a supervisor:
//   0 3 * * *  cd /app/server && node scripts/backup-db.js && find backups -mtime +30 -delete
//
// Exits 0 on success, non-zero on any failure, with a clear error on stderr.

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');

const SRC = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'reviews.db');

function tsStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[BACKUP] Source DB not found at ${SRC}`);
    process.exit(1);
  }

  const dest = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '..', 'backups', `reviews-${tsStamp()}.db`);

  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const db = new Database(SRC, { readonly: true, fileMustExist: true });
  try {
    // better-sqlite3's backup uses the SQLite online backup API. Returns a
    // promise that resolves when the copy finishes. Chunks internally so
    // large DBs stream rather than loading into memory.
    await db.backup(dest);
    const { size } = fs.statSync(dest);
    const mb = (size / 1024 / 1024).toFixed(2);
    console.log(`[BACKUP] OK  src=${SRC}  dest=${dest}  size=${mb}MB`);
    process.exit(0);
  } catch (err) {
    console.error(`[BACKUP] FAILED: ${err.message}`);
    try { fs.unlinkSync(dest); } catch { /* ignore */ }
    process.exit(2);
  } finally {
    db.close();
  }
}

main();
