# Deploy Notes — Business Owner Review Responses

Feature ships two new tables (`business_claims`, `review_responses`) and the
following routes:

- `POST/GET /api/businesses/:id/claim`
- `GET/POST /api/admin/claims`, `POST /api/admin/claims/:id/{approve,deny}`
- `GET/POST/PUT/DELETE /api/reviews/:id/response`
- `GET /api/public/businesses/:id/reviews` (now returns `owner_response` inline)
- Frontend `/owner` dashboard route

## Schema migration

The new tables are created by `initSchema()` in `server/src/db/schema.js`
inside `CREATE TABLE IF NOT EXISTS` blocks. `getDb()` is invoked at boot
from `server/src/index.js`, so on first server restart against an existing
populated SQLite DB the tables are added automatically. No manual migration
step is required. The migration is idempotent: subsequent restarts no-op.

## Pre-deploy

1. **Backup the production DB.** Run on the live host BEFORE pulling the new image:

   ```bash
   cd /app/server && npm run backup
   # confirm a fresh file appeared in backups/
   ls -lt backups/ | head -3
   ```

2. Confirm `ADMIN_EMAIL` is set in production env — the admin claim queue
   is gated by it. Without it, `/api/admin/claims` returns 404 to everyone
   (intentional, but no admin can approve claims either).

3. Confirm the Sentry forwarder env var (`SENTRY_DSN`) is still set — error
   paths in the new routes log via `console.error` only (consistent with
   existing route pattern); uncaught exceptions still flow through the
   global error middleware and into Sentry.

## Deploy

Standard image rebuild + container replace. The Dockerfile already copies
`src/` and `scripts/` — no `.dockerignore` change is needed for the new
routes or the smoke-test script.

```bash
docker build -t reviewhub-api ./server
docker stop reviewhub-api-prev || true
docker run -d --init --name reviewhub-api-new \
  --env-file .env -p 3001:3001 \
  -v rh-data:/app/data -v rh-backups:/app/backups \
  reviewhub-api
```

Boot logs should NOT contain any `[DB] business_claims / review_responses
table creation:` errors. A clean boot prints `[DB] integrity check: ok`.

## Post-deploy verification

1. Hit `/api/health` — must return `{"ok":true}`.
2. Run the smoke test against the live host:

   ```bash
   BASE_URL=https://api.reviewhub.example.com \
   USER_TOKEN=... ADMIN_TOKEN=... \
   BUSINESS_ID=42 REVIEW_ID=1234 \
     ./server/scripts/smoke-test-responses.sh
   ```

   All eight steps must print `OK`. Step 5 returns 402 if the test user is
   on the free plan — that's an upgrade-gate, not a bug.

3. Spot-check the `/owner` dashboard in the browser as a logged-in user
   with at least one approved claim.

## Monitor (24h)

- Sentry: filter by `path: /api/businesses/*/claim` and `path: /api/reviews/*/response`. Expected baseline: zero. Any 5xx is a bug.
- Logs: `grep "[DB] business_claims" server.log` — should only appear once
  on the boot after this deploy (table creation), never again.
- Rate-limit headers (`RateLimit-*`) are exposed; if support reports
  legitimate users hitting `429`, raise the per-route mutate cap (currently
  30/min for responses, 10/min for claims, plus a 50/day owner cap on
  response creation).
- Watch `business_claims` row growth — sudden spikes may indicate a
  griefing attempt against a high-profile business. The `(user_id,
  business_id) WHERE status IN ('pending','approved')` partial unique
  index already prevents duplicate active claims per user.

## Rollback

If the routes misbehave but the schema is fine, redeploy the previous image
— the new tables will simply sit unused (no FK references from older
tables, both have `CREATE TABLE IF NOT EXISTS` semantics so re-rolling
forward is safe).

If a corruption is suspected, stop the container, restore the pre-deploy
backup over `data/reviews.db`, restart the OLD image. The new tables will
be re-created on the next forward deploy.
