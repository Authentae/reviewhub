// One-shot: insert a fixture audit_preview for visual review.
//
// ⚠ `railway run` does NOT execute this on the prod container —
// it runs locally with prod env vars, but uses the LOCAL filesystem
// at `server/data/reviews.db` (a sandbox) instead of
// `/app/data/reviews.db` on the Railway volume. So a fixture
// inserted via `railway run` will NOT appear on the live site.
// Memory file: `feedback_railway_run_db_divergence.md`.
//
// Right way to insert a fixture into PROD:
//   railway ssh --service reviewhub \
//     "node /app/scripts/create-fixture-audit.js"
// (requires SSH key in ~/.ssh/).
// OR just create one via the dashboard /outbound-audits UI in an
// authed browser session — the API call hits the prod volume.

(async () => {
  const crypto = require('crypto');
  const { getDb, get, insert } = require('../src/db/schema');
  await getDb();

  const owner = get('SELECT id FROM users ORDER BY id ASC LIMIT 1');
  if (!owner) {
    console.error('No users in DB — aborting');
    process.exit(1);
  }

  const token = crypto.randomBytes(24).toString('hex');
  const reviewsJson = JSON.stringify([
    {
      reviewer_name: 'Sarah K.',
      rating: 5,
      text: 'Stayed for 4 nights and the canal view from my room at sunrise was unreal. Owner came down to recommend a noodle place around the corner — best laksa I had in Bangkok. Tiny place, big heart.',
      draft: 'Thank you so much Sarah — really happy you enjoyed the canal view at sunrise. That noodle place is one of our favourites too; glad it lived up to it. Hope to host you again next time you\'re in Bangkok. — Lamphu Tree House',
    },
    {
      reviewer_name: 'Marco P.',
      rating: 4,
      text: 'Lovely property, very atmospheric. Wifi was a bit spotty in the back rooms but the staff fixed it within an hour when I asked. Good location for Old Town walks.',
      draft: 'Thank you Marco — really glad to hear the team fixed the wifi quickly. We\'ve since added a second access point in the back wing so newer guests don\'t hit the same dead-spot. Hope to see you back when you\'re next in town! — Lamphu Tree House',
    },
    {
      reviewer_name: 'Anonymous',
      rating: 2,
      text: 'รถติดมาก เดินทางลำบาก หาแท็กซี่ยากในเย็น',
      draft: null,
    },
  ]);

  const id = insert(
    `INSERT INTO audit_previews (owner_user_id, business_name, reviews_json, share_token)
     VALUES (?, ?, ?, ?)`,
    [owner.id, 'Lamphu Tree House (fixture)', reviewsJson, token]
  );

  console.log(`Inserted audit_preview id=${id}`);
  console.log(`Share URL: https://reviewhub.review/audit-preview/${token}`);
  console.log('To clean up later: DELETE FROM audit_previews WHERE id = ' + id + ';');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
