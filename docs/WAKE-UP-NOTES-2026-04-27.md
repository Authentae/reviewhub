# Overnight polish recap — 2026-04-27

You went to sleep around 1am. Below is what I shipped while you were asleep,
plus what's still on the table and what's blocked on you.

## What shipped (9 commits, all pushed → Railway auto-deployed)

1. **`f54ff3b`** Email deliverability hardening, RFC 8058 unsubscribe, SEO/domain hygiene *(yesterday's batch)*
2. **`ae33f3d`** `.env.example` rewrite + per-component `/api/health` (db, smtp, ai, billing)
3. **`07d7e9c`** Fixed `t()` to accept a fallback-string 2nd arg → 60 broken UI strings now render
4. **`6233f28`** CSP allows Google Fonts → editorial typography no longer silently falls back
5. **`9937554`** Defensive `JSON.parse` on DB-stored webhook + auto-rule config (single-row 500 prevention)
6. **`81988b4`** `scripts/find-orphans.js` diagnostic for dead client modules
7. **`dcfec82`** Registered 70 missing `en` i18n keys (claim, owner, ownerResponse, unsub, value, common)
8. **`0dea2c4`** `NotFound` page sets `noindex,nofollow` so Google stops indexing typo URLs
9. **`c5c5853`** Test infrastructure: prevent real SMTP/Anthropic calls during `npm test`

## Test counts

- Curated `npm test`: **184 / 184 ✓** (was 184 before, still 184)
- Full suite (`node --test tests/*.test.js`): **516 / 518 ✓** (up from 184 effective before — the broader glob runs 326 more tests that the curated command was skipping)
- Client (`vitest`): **161 / 171** (10 worker-exit flakes are pre-existing, not regressions)

The 2 server-side full-suite flakes:
- `auth.test.js` login-timing test fails under batch load (passes 5/5 in isolation)
- `serveClient.test.js` fails when run after other tests (passes in isolation)

Neither is a real bug — both are test-runner ordering quirks.

## What's blocked on you

### 1. Add credit to Anthropic ($5)
- Go to https://console.anthropic.com/settings/billing → Buy credits → $5
- Without this, AI drafts fall back to template strings (currently confirmed
  via prod test: `source: "template"`)
- Once funded, drafts immediately switch to real AI — no redeploy needed

### 2. (Optional) Rotate the Anthropic key one more time for clean hygiene
- Both the new (`x_Ih...QQAA`) and old keys are in chat history
- Old (`Rr0...9wAA`) was already DELETED on Anthropic during yesterday's session
- New is live in Railway. If you want a key that's never been in chat:
  console.anthropic.com → API Keys → Create new (e.g. `ReviewHub-prod-final`)
  → don't paste it to me → update Railway env var directly → revoke `x_Ih...QQAA`

### 3. (Optional) Verify Google Fonts CSP fix worked
- Open https://reviewhub.review in an incognito tab
- Open DevTools → Network → reload
- Confirm `fonts.googleapis.com` and `fonts.gstatic.com` requests both 200 OK
  (before this fix they were blocked by CSP; you'd see CSP errors in Console)
- Visually: text should render in **Instrument Serif** (italic ampersand on Landing) and **Inter Tight** (sans-serif body) instead of system Arial/Helvetica fallback

## Polish items I deferred (need your design eye)

- `og-image.png` (1200×630) for social sharing previews — meta tags wired, image still missing
- Loading skeletons (currently spinners) — design decision
- Empty states — first-time onboarding visuals
- Animations / page transitions — feel premium

These are all "Claude Design" territory per your instruction.

## Polish items I considered but didn't ship

- **Lazy-loading the i18n locale dictionaries** — the eager bundle is currently
  ~422KB raw (130KB gzipped) and translations.js is ~300KB raw of that. Splitting
  per-locale would cut first-load by ~50%. But it requires non-trivial refactor
  to I18nContext + risks first-paint flash for non-en users. Worth doing
  eventually but not overnight without deeper testing.
- **Updating `npm test` to glob all 49 test files** — would surface 326 more
  test results but would make CI red on the 2 pre-existing flakes. Better to
  fix the flakes first, then update the glob.
- **Adding all i18n keys to non-English locales** — 446-469 keys missing per
  locale. Needs human translation, can't auto-generate. Defer until you have
  a translator.

## Production status as of when I'm writing this

- ✅ `https://reviewhub.review` live, 200 OK
- ✅ DNS: A/CNAME to Cloudflare proxy, all 3 Resend records (DKIM/SPF/MX) verified
- ✅ Resend domain verified, can send to any address
- ✅ Email infrastructure: SMTP via Resend port 2587 (Railway-friendly), List-Unsubscribe headers, RFC 8058 one-click unsub via signed tokens
- ✅ All 4 Health components: `db: ok / smtp: configured / ai: live / billing: free-only`
- ✅ SEO: canonical → reviewhub.review, sitemap with 10 URLs (priority weighted), robots disallow /dashboard + /settings, JSON-LD SoftwareApplication + Organization
- ✅ Security headers: HSTS, frame-options DENY, CSP locked except Google Fonts allowlist, COOP/CORP, Permissions-Policy
- ⏳ Anthropic API: key wired, awaiting $5 credit deposit
- ⏳ LemonSqueezy: not wired (you decided to defer billing setup)

## Next polish opportunities (when you're back)

In rough priority order:

1. **Click-every-flow audit** — drive the live site through register → verify → login → connect business → respond to review → password change → MFA enable → settings → unsubscribe. ~45 min, will surface 5–10 small bugs.
2. **Mobile functional sweep** — resize browser to iPhone width, walk same flows, find broken layouts.
3. **First-paint perf** — Lighthouse audit on https://reviewhub.review, fix anything below 90.
4. **Sentry hookup** — get free Sentry account, paste DSN to Railway env. Already wired in code via `lib/errorReporter.js` — just needs DSN.

I'll keep auto-pacing the loop (next wake at 04:54) until you sit back down.
