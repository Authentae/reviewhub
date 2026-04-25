# ReviewHub Runbook

**Last updated:** 2026-04-24
**Purpose:** step-by-step procedures for production incidents. Written so a trusted VA, friend, or future-you at 3am can execute without prior context. Every command here is copy-paste ready.

Keep this file under source control. When you change prod behavior, update this file in the same commit.

## Quick reference

| Thing | Where |
| --- | --- |
| Server process manager | `pm2 list` on the prod box |
| DB file | `$DATABASE_PATH` (default: `./reviewhub.db`) |
| Env file | `/opt/reviewhub/.env` |
| Backup script | `/opt/reviewhub/backup.sh` (run hourly via cron) |
| Offsite backup destination | [fill in when configured — Backblaze B2 / S3 / similar] |
| Domain & TLS | [fill in provider + renewal date] |
| Billing provider | LemonSqueezy — dashboard.lemonsqueezy.com |
| OAuth provider (Google) | console.cloud.google.com → APIs & Services → Credentials |
| Email transport | SMTP via `$SMTP_HOST` — [fill in provider] |
| Error reporting | [Sentry DSN in `.env` — fill in once wired] |
| Uptime monitor | [UptimeRobot dashboard URL — fill in once configured] |

## Environment variables

Critical ones. Full list lives in `.env.example`.

```
DATABASE_PATH           path to SQLite file (default: ./reviewhub.db)
CLIENT_URL              public-facing URL; used in emails
SMTP_HOST/PORT/USER/PASS/FROM   transactional email
ANTHROPIC_API_KEY       AI drafts (falls back to templates if missing)
LEMONSQUEEZY_API_KEY    billing
LEMONSQUEEZY_WEBHOOK_SECRET   webhook HMAC verification
GOOGLE_OAUTH_CLIENT_ID        platform sync
GOOGLE_OAUTH_CLIENT_SECRET
FOLLOW_UP_INTERVAL_MS   scheduler tick (default 6h, 0 disables)
DIGEST_INTERVAL_MS      weekly digest tick (default 7d)
SEED_DEMO               set to `1` only for demo tenants
AUDIT_RETENTION_DAYS    audit_log trim (default 365)
```

## Daily ops

### 1. Check service health

```bash
# SSH to prod
ssh reviewhub@<host>

# Is the server up?
pm2 list

# Recent logs?
pm2 logs reviewhub --lines 100

# Health ping
curl -sS https://reviewhub.app/api/health || echo "UNHEALTHY"
```

Expected: `pm2 list` shows `reviewhub` in `online` state. Logs contain `Server running on http://localhost:3001` at boot and no unhandled rejections.

### 2. Watch for warnings

Tail logs for ~10 seconds and look for:

```bash
pm2 logs reviewhub --lines 200 --nostream | grep -Ei "error|failed|unhandled|FOLLOW-UP.*Failed|DIGEST.*Failed|webhook.*fail"
```

## Incidents

### Server won't start or crashed

```bash
# 1. See the actual error
pm2 logs reviewhub --err --lines 50

# 2. If it's "SQLITE_CORRUPT" or similar — skip to "Restore from backup" below.

# 3. If it's a transient boot error (migration, port conflict, env var missing):
pm2 restart reviewhub

# 4. If pm2 is gone entirely:
cd /opt/reviewhub/server
npm ci --production
pm2 start src/index.js --name reviewhub --time
pm2 save
```

### Database corruption / disk loss → restore from backup

```bash
# 1. Stop the server so it doesn't write to the broken DB
pm2 stop reviewhub

# 2. Move the broken file aside (don't delete — we might salvage it)
mv /opt/reviewhub/reviewhub.db /opt/reviewhub/reviewhub.db.broken

# 3. Pull the most recent backup from offsite
# Example for rclone + Backblaze B2:
rclone copy b2:reviewhub-backups/latest.db /opt/reviewhub/reviewhub.db

# 4. Start the server
pm2 start reviewhub

# 5. Verify
curl -sS https://reviewhub.app/api/health
```

Quarterly: verify backups actually restore. Spin up a scratch container, restore yesterday's backup, log in as a known test user, confirm review list renders.

### All AI drafts failing

**Symptom:** users report the "AI Draft" button is failing; logs show `anthropic.draft_failed`.

```bash
# 1. Is the API key set and valid?
pm2 env 0 | grep ANTHROPIC_API_KEY
# If not set, the system silently falls back to template pool — no action needed.

# 2. Anthropic status check: https://status.anthropic.com
# If upstream is down, the template fallback already covers it. Verify users
# are getting template-based drafts rather than errors.

# 3. If key was rotated, update .env and restart:
nano /opt/reviewhub/.env   # update ANTHROPIC_API_KEY
pm2 restart reviewhub
```

### Review sync stopped for a user

**Symptom:** user complains "no new reviews showing." Usually an OAuth token expiry.

```bash
# 1. Find the user
sqlite3 /opt/reviewhub/reviewhub.db \
  "SELECT u.id, u.email, pc.provider, pc.last_sync_error, pc.last_synced_at
   FROM users u JOIN businesses b ON b.user_id = u.id
   JOIN platform_connections pc ON pc.business_id = b.id
   WHERE u.email = 'user@example.com';"

# 2. If last_sync_error mentions invalid_grant / token expired:
#    → Tell the user to re-connect Google in Settings → Connected Platforms.
#    The UI surfaces this error (shipped 2026-04-24).

# 3. If last_synced_at is stale but no error: trigger a manual sync from
#    the admin endpoint, or just wait for the next scheduler tick.
```

### Follow-up emails went out when they shouldn't have

**First action:** stop the scheduler to prevent further sends.

```bash
# 1. Disable the scheduler without a full redeploy
pm2 stop reviewhub
# edit .env: add FOLLOW_UP_INTERVAL_MS=0
pm2 start reviewhub

# 2. Figure out what went out
sqlite3 /opt/reviewhub/reviewhub.db \
  "SELECT COUNT(*) FROM review_requests
   WHERE follow_up_sent_at > datetime('now', '-1 day');"

# 3. If it was retroactive spam (sent_at much older than follow_up_after_days):
#    check the schema_meta backfill flag ran.
sqlite3 /opt/reviewhub/reviewhub.db \
  "SELECT * FROM schema_meta WHERE key LIKE 'follow_up%';"
#    If missing, the one-shot migration didn't run — investigate why and
#    execute it manually:
sqlite3 /opt/reviewhub/reviewhub.db \
  "UPDATE review_requests SET follow_up_sent_at = datetime('now')
   WHERE follow_up_sent_at IS NULL AND clicked_at IS NULL
     AND sent_at < datetime('now', '-30 days');
   INSERT INTO schema_meta (key, value) VALUES ('follow_up_backfill_v1', 'manual');"

# 4. Re-enable the scheduler once root cause is understood.
```

### Billing webhook not arriving

```bash
# 1. Check webhook delivery log in LemonSqueezy dashboard
#    → https://app.lemonsqueezy.com → Settings → Webhooks → History
#
# 2. If LS reports delivery success but our DB shows no change:
pm2 logs reviewhub | grep -i "webhook\|lemonsqueezy"
#    Usually: signature verification failed (secret drifted) OR
#    handler threw but returned 200 (shouldn't happen, but check).
#
# 3. Manual subscription reconciliation — grant a plan to a user who paid
#    but whose DB row is stuck on 'free':
sqlite3 /opt/reviewhub/reviewhub.db \
  "UPDATE subscriptions SET plan = 'pro', status = 'active' WHERE user_id = (SELECT id FROM users WHERE email = 'buyer@example.com');"
```

### Spike in 5xx errors

```bash
# 1. Tail logs, look for the root cause
pm2 logs reviewhub --err --lines 200

# 2. Most common: SQLite "database is locked" under heavy concurrent writes
#    → check if a long-running import/seed is holding a transaction
#    → restart is safe: pm2 restart reviewhub (graceful — WAL checkpoints first)

# 3. If it's "ECONNREFUSED" to SMTP / Anthropic / LS — upstream issue.
#    Verify on their status page; most handlers degrade gracefully.
```

## Deploy

See `deploy-checklist` skill output + the checklist in this repo's release PR description. Short version:

```bash
# 1. On local: confirm tests green
cd server && node --test tests/*.test.js     # expect pass, fail 0
cd ../client && npx vitest run               # expect all green

# 2. On prod:
cd /opt/reviewhub
git pull origin main
cd server && npm ci --production
cd ../client && npm ci && npm run build
pm2 restart reviewhub

# 3. Smoke: curl /api/health, log in manually, look for migration logs
```

## Rollback

Same flow in reverse. Schema migrations are additive-only (new columns have defaults, new indexes are IF NOT EXISTS) — reverting code is safe. Never drop columns or indexes on rollback.

```bash
cd /opt/reviewhub
git log --oneline -5                   # find the previous deploy's SHA
git checkout <previous-sha>
cd server && npm ci --production
cd ../client && npm run build
pm2 restart reviewhub
```

If schema was broken by a buggy migration, restore the pre-deploy DB backup per "Database corruption" above.

## Founder unavailability — handoff

If you need someone else to keep the service alive while you're unreachable:

1. Give them SSH access (short-lived key).
2. Point them at this file.
3. Grant read-only LemonSqueezy dashboard access (Team settings).
4. Grant read-only Google Cloud Console access if they may need to refresh OAuth credentials.
5. Set an auto-reply on `support@reviewhub.app` with a timeline.

Minimum skills to execute this runbook: basic shell, `sqlite3`, familiarity with `pm2`. No Node.js or React knowledge needed.

## Drills

Run these every 90 days; block a morning on the calendar:

- [ ] Restore yesterday's backup to a scratch DB. Log in as a known user. Confirm review list renders.
- [ ] Rotate the LemonSqueezy webhook secret in the dashboard. Update `.env`, restart. Send a test purchase via a $0 coupon or sandbox. Verify subscription row updated.
- [ ] Rotate the Anthropic API key. Verify AI drafts still generate.
- [ ] `pm2 stop reviewhub` → wait 60s → `pm2 start reviewhub`. Confirm no WAL orphans remain: `ls /opt/reviewhub/*.db*` should show only the `.db` file.
