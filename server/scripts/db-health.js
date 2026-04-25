#!/usr/bin/env node
// One-shot DB maintenance + health report.
//
// Run after shipping a feature that adds tables/indexes (like business_claims
// and review_responses). Does three things:
//
//   1. ANALYZE  — refresh SQLite's query-planner stats so newly-added indexes
//                 actually get picked. Without this, the planner may still pick
//                 a full-scan plan for the new tables until stats accumulate.
//   2. Integrity check — quick_check (page-level corruption).
//   3. Size + row-count report — table-by-table, plus DB file size on disk.
//
// Read-mostly: ANALYZE writes a small stats table but is safe on a live DB.
// Does NOT run VACUUM (locks the DB; run that during a maintenance window).

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');

const SRC = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'reviews.db');

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[DB-HEALTH] DB not found at ${SRC}`);
    process.exit(1);
  }

  const fileSize = fs.statSync(SRC).size;
  console.log(`[DB-HEALTH] DB file: ${SRC}`);
  console.log(`[DB-HEALTH] Size on disk: ${fmtBytes(fileSize)}`);

  const db = new Database(SRC);
  try {
    // 1. Integrity check
    const ic = db.prepare('PRAGMA quick_check').get();
    const icStatus = Object.values(ic || {})[0];
    console.log(`[DB-HEALTH] Integrity: ${icStatus}`);

    // 2. ANALYZE — refresh planner stats
    const t0 = Date.now();
    db.exec('ANALYZE');
    console.log(`[DB-HEALTH] ANALYZE: done in ${Date.now() - t0}ms`);

    // 3. Per-table row counts
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    ).all();

    console.log(`[DB-HEALTH] Tables (${tables.length}):`);
    let total = 0;
    for (const { name } of tables) {
      try {
        const { c } = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get();
        total += c;
        console.log(`  ${name.padEnd(30)} ${String(c).padStart(8)} rows`);
      } catch (err) {
        console.log(`  ${name.padEnd(30)} ERROR: ${err.message}`);
      }
    }
    console.log(`[DB-HEALTH] Total rows: ${total}`);

    // 4. Index inventory — count how many indexes per table (sanity check that
    //    the new tables got their indexes)
    const indexes = db.prepare(
      `SELECT tbl_name, COUNT(*) AS n
         FROM sqlite_master
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
        GROUP BY tbl_name
        ORDER BY tbl_name`
    ).all();
    console.log(`[DB-HEALTH] Indexes per table:`);
    for (const { tbl_name, n } of indexes) {
      console.log(`  ${tbl_name.padEnd(30)} ${String(n).padStart(3)} index(es)`);
    }

    // 5. WAL size (if WAL present) — useful to see if checkpoint pressure is building
    const walPath = `${SRC}-wal`;
    if (fs.existsSync(walPath)) {
      console.log(`[DB-HEALTH] WAL file size: ${fmtBytes(fs.statSync(walPath).size)}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(`[DB-HEALTH] FAILED: ${err.message}`);
    process.exit(2);
  } finally {
    db.close();
  }
}

main();
