#!/usr/bin/env node
// One-shot diagnostic: audit-preview view-count report.
//
// Read-only. Prints a per-prospect summary of:
//   - business_name (the prospect)
//   - view_count (how many times the share URL was opened)
//   - first_viewed_at / last_viewed_at (when they engaged)
//   - marked_as_replied_at (founder marked them as replied)
//   - hours since send (how stale)
//   - hours since last view (active vs cold)
//   - audit URL (for follow-up reference)
//
// Used during outreach waves to answer "did anyone open it" without
// having to load the dashboard. Especially useful Tuesday/Wednesday
// mornings during Wave 4 where the founder wants a fast check.
//
// Run locally: `node server/scripts/audit-views.js`
// Run against prod: `railway run node server/scripts/audit-views.js`
//
// Optional filter: pass a string and only audits whose business_name
// contains it (case-insensitive) are shown.
//   node server/scripts/audit-views.js Old   # Old Capital only
//   node server/scripts/audit-views.js bang  # Bangkok* properties

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');

const SRC = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'reviews.db');
const filter = (process.argv[2] || '').toLowerCase();

function hoursSince(ts) {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts.replace(' ', 'T') + 'Z').getTime();
  return Math.round(ms / 36e5 * 10) / 10;
}

function fmt(h) {
  if (h === null) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${Math.round(h / 24)}d`;
}

function statusFor(row) {
  if (row.marked_as_replied_at) return 'REPLIED ✓';
  if (row.view_count > 0) return 'OPENED';
  return 'cold';
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[audit-views] DB not found at ${SRC}`);
    console.error('  Hint: run via `railway run` to query the production DB.');
    process.exit(1);
  }

  const db = new Database(SRC, { readonly: true });

  // Handle missing-table case (fresh dev DB, schema not migrated yet)
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='audit_previews'"
  ).get();
  if (!tableExists) {
    console.error(`[audit-views] Table audit_previews not found at ${SRC}.`);
    console.error('  Hint: run `railway run node server/scripts/audit-views.js` against production.');
    process.exit(1);
  }

  let rows = db.prepare(`
    SELECT id, business_name, share_token, view_count,
           first_viewed_at, last_viewed_at,
           marked_as_replied_at, created_at, expires_at
      FROM audit_previews
     WHERE datetime(expires_at) > datetime('now')
     ORDER BY created_at DESC
     LIMIT 100
  `).all();

  if (filter) {
    rows = rows.filter(r => (r.business_name || '').toLowerCase().includes(filter));
  }

  if (rows.length === 0) {
    console.log('[audit-views] No active audits found' + (filter ? ` for filter "${filter}"` : '.'));
    return;
  }

  const baseUrl = process.env.CLIENT_URL || 'https://reviewhub.review';

  // Quick summary first
  const total = rows.length;
  const opened = rows.filter(r => r.view_count > 0).length;
  const replied = rows.filter(r => r.marked_as_replied_at).length;
  const totalViews = rows.reduce((acc, r) => acc + (r.view_count || 0), 0);

  console.log('');
  console.log(`[audit-views] ${total} active audits  ·  ${opened} opened  ·  ${replied} replied  ·  ${totalViews} total views`);
  console.log('');

  // Header
  console.log(
    'Status'.padEnd(11) +
    'Views'.padEnd(7) +
    'Sent'.padEnd(7) +
    'Last opened'.padEnd(13) +
    'Business'
  );
  console.log('-'.repeat(80));

  for (const r of rows) {
    const sentH = hoursSince(r.created_at);
    const lastViewH = hoursSince(r.last_viewed_at);
    console.log(
      statusFor(r).padEnd(11) +
      String(r.view_count || 0).padEnd(7) +
      fmt(sentH).padEnd(7) +
      fmt(lastViewH).padEnd(13) +
      (r.business_name || '(unnamed)')
    );
  }

  // Recently active — properties opened in last 48h, sorted by recency
  const recentOpens = rows
    .filter(r => r.last_viewed_at && hoursSince(r.last_viewed_at) < 48)
    .sort((a, b) => new Date(b.last_viewed_at) - new Date(a.last_viewed_at));

  if (recentOpens.length > 0) {
    console.log('');
    console.log('Recently active (last 48h):');
    for (const r of recentOpens) {
      console.log(
        `  ${r.business_name || '(unnamed)'}` +
        `  ·  ${r.view_count} view${r.view_count === 1 ? '' : 's'}` +
        `  ·  last ${fmt(hoursSince(r.last_viewed_at))} ago` +
        `\n    ${baseUrl}/audit-preview/${r.share_token}`
      );
    }
  }

  console.log('');
}

main();
