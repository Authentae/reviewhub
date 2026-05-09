// One-shot diagnostic: list outbound audit_previews + view counts.
// Run in prod via: railway run --service reviewhub node server/scripts/audit-views-diagnostic.js
//
// Helps decide if Wave 4 needs new pitches or just better follow-up — if
// prior audit URLs were never opened, the bottleneck is "email got read but
// CTA didn't compel" or "email never got read." Different fixes.

(async () => {
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
