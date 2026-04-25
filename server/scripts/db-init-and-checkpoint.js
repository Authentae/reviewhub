#!/usr/bin/env node
// Materialise the latest schema and checkpoint the WAL.
//
// Why we need this:
//   - schema.js runs CREATE TABLE IF NOT EXISTS on every getDb() call, but the
//     dev DB only sees those CREATEs when the server actually boots. After
//     pulling a branch that adds tables, it's possible to have a DB file
//     where the old tables exist but the new ones (business_claims,
//     review_responses, GDPR tables, …) have never been materialised.
//   - WAL files grow until SQLite decides to checkpoint. On dev DBs that
//     receive few writes between restarts, the WAL can be 100x the main DB.
//     A manual TRUNCATE checkpoint compacts it.
//
// Safe to run on a live DB.

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getDb } = require('../src/db/schema');

async function main() {
  // getDb() runs initSchema() which is idempotent (CREATE IF NOT EXISTS, plus
  // PRAGMA-guarded column adds). After this call, every table+column the code
  // expects is guaranteed to exist.
  const db = await getDb();

  // List the tables that NOW exist, so we can confirm the new ones materialised.
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  ).all();
  console.log(`[INIT] Tables present: ${tables.length}`);
  for (const { name } of tables) console.log(`  - ${name}`);

  // TRUNCATE checkpoint: flush WAL → main DB and reset the WAL file to zero.
  // PASSIVE wouldn't truncate; FULL waits for readers; TRUNCATE is the right
  // call for a maintenance script that wants the WAL minimised.
  const ckpt = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  console.log(`[INIT] WAL checkpoint:`, ckpt);

  process.exit(0);
}

main().catch((err) => {
  console.error(`[INIT] FAILED: ${err.message}`);
  process.exit(2);
});
