// One-shot diagnostic: list outbound audit_previews + view counts.
//
// ⚠ DO NOT run via `railway run --service reviewhub node ...` — that
// connects Railway env vars but executes on the LOCAL machine's
// filesystem, querying `server/data/reviews.db` (a stale sandbox),
// NOT `/app/data/reviews.db` on the Railway volume where prod lives.
// You'll get 0 rows even when prod has plenty. Memory file:
// `feedback_railway_run_db_divergence.md`.
//
// Right way to query prod audit_previews:
//   1. Open https://reviewhub.review in an authed Chrome MCP tab
//   2. Run: fetch('/api/audit-previews', {credentials:'include'}).then(r=>r.json())
//   3. The response includes view_count + first/last_viewed_at per audit
// Or `railway ssh --service reviewhub "node /app/scripts/audit-views-diagnostic.js"`
// (requires SSH key in ~/.ssh/).

(async () => {
  const path = require('path');
  const dbPath = process.env.DATABASE_PATH ||
    path.join(__dirname, '../data/reviews.db');
  console.log(`[DIAG] DB path: ${dbPath}`);
  console.log(`[DIAG] cwd: ${process.cwd()}`);
  if (!dbPath.startsWith('/app/')) {
    console.warn('[DIAG] ⚠ DB path is NOT inside /app/ — this is a local sandbox, NOT prod.');
    console.warn('[DIAG]   Results will reflect local filesystem, not Railway volume.');
  }
  const { getDb, all } = require('../src/db/schema');
  await getDb();
  const rows = all(
    `SELECT business_name,
            view_count,
            first_viewed_at,
            last_viewed_at,
            datetime(created_at) AS created_at,
            substr(share_token, 1, 8) AS token_prefix
       FROM audit_previews
      ORDER BY created_at DESC
      LIMIT 50`
  );
  console.log(`audit_previews rows: ${rows.length}`);
  console.log('');
  const withViews = rows.filter((r) => r.view_count > 0);
  console.log(`With view_count > 0: ${withViews.length} (${rows.length ? Math.round(100 * withViews.length / rows.length) : 0}%)`);
  console.log('');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
