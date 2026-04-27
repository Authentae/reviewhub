# Launch-day runbook

> The one document to follow on the day you flip ReviewHub from
> "private beta" to "public, paying customers welcome." Estimated time:
> one focused 4-hour block. Do this on a Tuesday or Wednesday morning
> Bangkok time — never Friday afternoon.

---

## T–24 hours: pre-flight checks

Run all of these the day before. If any fail, postpone launch.

### Production health

```bash
curl https://reviewhub.review/api/health
```

Expected JSON:
```json
{
  "ok": true,
  "components": {
    "db": "ok",
    "smtp": "configured",
    "ai": "live",
    "billing": "configured"   ← MUST be "configured", not "free-only"
  }
}
```

If `billing: "free-only"` — **stop**, finish [LAUNCH-CHECKLIST.md
step 2](../LAUNCH-CHECKLIST.md) (LemonSqueezy wiring) before launching.

If `ai: "template-fallback"` — Anthropic key is unset. AI drafts will
fall back to canned templates. Either set the key or hold launch.

### End-to-end flow test (you, on a real account)

Open `https://reviewhub.review` in an Incognito window:

- [ ] Landing page renders, hero says "Every Google review, answered in 10 seconds"
- [ ] No mention of Yelp/Facebook/etc. as currently working (only "coming soon")
- [ ] Click "Try the free tool first" → reply generator works in <10s
- [ ] Click "Start free" → register → email verification arrives
- [ ] Click verification link → land on dashboard with empty state
- [ ] Empty state copy says "Connect your Google business" (not "all platforms")
- [ ] Click "Load demo data" → 5 reviews appear
- [ ] Click any review → "Draft with AI" → real AI draft (not template) returns in <8s
- [ ] Edit + save the draft → success toast
- [ ] Visit /pricing → click "Choose Pro" → LemonSqueezy checkout opens
- [ ] Use test card `4242 4242 4242 4242` → checkout completes
- [ ] Land back on dashboard → user.plan should be `pro` within 5 seconds (webhook)
- [ ] /api/health now reports `subs_paying: 1` in admin stats

If any step fails, **don't launch**. Fix it, re-run all 12.

### Backup the database

```bash
# Railway dashboard → ReviewHub service → Variables → BACKUP_INTERVAL_HOURS
# should be 24. Check the latest backup exists in the mounted volume:
railway run "ls -la /app/backups/" | head -3
```

The most recent file should be from <24h ago.

---

## T–0: Launch sequence

### Hour 0: announce internally first

Before any external traffic, tell:
- Your closest 3 friends (Telegram/LINE)
- Your Twitter/LinkedIn followers (one-line "we're live" post)
- The Thai SMB Facebook groups you've been seeding for 2 weeks

This is your **canary release**. If something breaks, your friends
catch it before strangers.

### Hour 0 → 1: monitor for 60 minutes

Open three windows:

1. `https://reviewhub.review/api/admin/metrics` (refresh every 5 min) — watch for 5xx spikes
2. Sentry → Issues — any new error in the last hour?
3. Railway logs — any repeated stack traces?

If everything's quiet for 60 minutes and you have at least 3 signups
from your canary list — go to the next phase.

### Hour 1 → 4: send the first 10 cold emails

From [docs/cold-email-templates.md](../cold-email-templates.md). Use
template T1 for businesses with negative reviews, T3 for all-positive.

**Send one every ~20 minutes** — not all at once. Gmail flags burst
sends from a fresh sender. While you wait between sends, refresh
Sentry and `/api/admin/metrics` once.

If anyone replies asking a question:
- Answer within 1 hour. This is the most important conversation
  you'll have today.
- Don't sell. Listen. Ask "what would have to be true for this to
  work for you?"
- Take notes. The first 5 people who reply teach you everything you
  need to know about the next 50.

### Hour 4: announce externally

Now post to:
- LinkedIn (English market)
- Twitter/X
- Thai cafe/restaurant Facebook groups (the ones you've been
  contributing to, not cold posts)
- Hacker News? — only if you want a tech-audience traffic spike. SaaS
  for Thai SMBs is unusual on HN, can land well, can also flop. Decide
  based on your appetite for volatility.

**Don't post on Product Hunt yet.** Save PH for when you have 5+ paying
customers and 2 case studies. PH on day 1 with no proof = wasted shot.

---

## What to do when something goes wrong

### "AI drafts are returning errors for everyone"

```bash
curl https://reviewhub.review/api/health
# components.ai: "live" but errors → Anthropic credit hit zero
```

Fix: Add credit at <https://console.anthropic.com/settings/billing>.
Drafts will work again within 30 seconds (no redeploy needed).

### "LemonSqueezy webhook is failing — payments aren't reflecting in plans"

```bash
# Check Railway logs for "[webhook]" entries
railway logs | grep webhook
```

Two common causes — check both:

1. **Wrong URL in LemonSqueezy webhook config.** The handler with raw-body
   HMAC verification is at **`/api/billing/webhook`** — NOT
   `/api/webhooks/lemonsqueezy`. If the URL is wrong, requests hit the
   JSON parser first, the body bytes change, HMAC fails, every webhook
   returns 401. Symptom in Railway logs: a stream of
   `POST /api/webhooks/... 401` from User-Agent `LemonSqueezy-Hookshot`.

2. **Secret mismatch.** `LEMONSQUEEZY_WEBHOOK_SECRET` doesn't match what's
   configured in LemonSqueezy → Settings → Webhooks. The secret must be
   ≤40 chars (LS API constraint). Re-copy and re-set the env var.

Either way: **manually upgrade affected users** to their paid plan via
`/admin` while the webhook catches up. Existing test subs whose
`subscription_created` already failed past LS's retry window won't
auto-recover — cancel + re-checkout for those.

### "Site is down (502/504)"

```bash
curl -I https://reviewhub.review
```

If 502/504: Railway's container is crashing or out of memory.
- Check Railway logs for the last error before the crash
- Check `/api/health` from a different IP (might be a Cloudflare edge issue, not your app)
- If real downtime: rollback to the previous commit
  ```bash
  git revert HEAD --no-edit && git push
  ```

### "I'm getting hammered with signups and the DB is slow"

Unlikely on day 1. If it happens:
- SQLite scales fine to ~thousands of writes/day
- The bottleneck is Railway's small instance — upgrade to Pro tier ($20/mo)
- Don't migrate to Postgres until you have ~10k+ users

### "Sentry inbox has 100 errors and I'm panicking"

Take a breath. Sort by "users affected." Anything affecting 1 user is
boring. Anything affecting >5 users in <1 hour is a real problem. Fix
those; ignore the rest until tomorrow.

---

## End of launch day: write the post-mortem

Even if launch went smoothly. Spend 30 minutes writing:

1. **Numbers**: signups, paying customers, refunds, cold-email reply rate
2. **What broke**: every error, even silly ones, gets a one-liner
3. **What surprised you**: 3 things you didn't predict
4. **What to do tomorrow**: the top 3 actions, ranked

Save as `docs/post-mortems/2026-XX-XX-launch.md`. Read it before next
launch (every PR/feature/campaign launch).

---

## What success looks like

**Day 1 realistic targets:**
- 50–200 unique visitors (depends on your reach)
- 10–30 signups (5–15% landing → register conversion)
- 1–3 paying customers (8–15% trial → paid in week 1)
- 2–5 cold-email replies (10% reply rate from 50 sends)

**Day 1 stretch targets:**
- 500+ visitors (only if you got lucky on social)
- 50+ signups
- 5+ paying customers

**Day 1 disappointment threshold (don't panic, just iterate):**
- <10 visitors → distribution problem, not product
- <2 signups from 50 visitors → landing page problem, rewrite the hero
- 0 cold-email replies from 10 sends → message problem, rewrite T1

If you hit the disappointment threshold: **don't quit, don't pivot,
don't rebuild**. Talk to the next 5 people on your prospect list. They
will tell you what's wrong faster than any analytics tool.

---

## What NOT to do on launch day

- ❌ **Don't ship new features.** The product is what it is today.
- ❌ **Don't change the landing copy.** Even if it feels off — you'll
  lose attribution data on what version converted.
- ❌ **Don't get into Twitter arguments.** If someone trash-talks
  ReviewHub publicly, ignore. Or reply once, professionally, and stop.
- ❌ **Don't celebrate before midnight.** 80% of launch-day signups
  happen in the last 4 hours.
- ❌ **Don't refresh /api/admin/stats every 30 seconds.** Check at
  hour-marks. Otherwise you'll spiral.

The launch isn't over at midnight. It's over when you have your
**10th paying customer**, sometime in the following 4–6 weeks.
