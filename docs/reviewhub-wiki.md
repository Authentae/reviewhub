# ReviewHub wiki — the business in one searchable file

Karpathy-style memory wiki. Single source of truth for *non-code* facts
about ReviewHub: who's using it, what's making money, what's blocked,
what worked, what didn't. Claude reads this every session before
proposing big changes.

**Update rule:** when something material happens (first paying customer,
a real outreach reply, a churn, a pricing change, a competitor move,
a learned lesson), add a line here. Not git-commit-detail, not
operating-queue-task — just the *fact* that future-you needs to know.

Sections grow over time. Don't archive — just date-stamp.

---

## Customers

_(empty — pre-revenue as of 2026-05-05)_

When the first paying customer lands, log: business name, plan,
acquisition channel (cold email / audit funnel / inbound / referral),
date, and any pre-purchase friction worth remembering.

## SEO infrastructure

- **2026-05-05** — Google Search Console verified for
  `https://reviewhub.review` (URL prefix property, HTML-tag method).
  Verification meta tag in `client/index.html`. Sitemap.xml submitted.
  Owner: earth.reviewhub@gmail.com.
- **Bing Webmaster Tools** — TODO. Cleanest path: log into
  https://www.bing.com/webmasters → Import from Google Search
  Console (one click).
- 5 vertical landing pages live: `/for-restaurants`, `/for-dentists`,
  `/for-hotels`, `/for-spas`, `/for-cafes`. Each has Service JSON-LD.
- `/blog` index live + 3 static blog posts cross-linked.
- 2 free tools: `/tools/review-reply-generator` (AI-powered) and
  `/tools/reply-roaster` (heuristic critique).

## Outreach waves

- **Wave 1 — 2026-05-04:** 9 emails sent. No replies as of 2026-05-06.
  Mix of cooking schools + B&Bs. Verticals targeted: Pink Chili,
  House of Taste, Sweets Cottage, Tingly Thai, May Kaidee, Better
  Moon, White Ivory, Vera Nidhra, Aim House.
- **Wave 2 — 2026-05-06 14:39 ICT:** 2 emails sent.
  - Old Capital Bike Inn (info@oldcapitalbkk.com) — Thai, UNAWARE
    segment (0% response), specific observation: owner Jason +
    bike tour. Audit URL eb9b38c2…
  - Loftel 22 Hostel (loftel22bangkok@gmail.com) — Thai, UNAWARE
    segment (0% response), specific observation: 2 unanswered 1-stars.
    Audit URL 5413ee40…
  - Skipped: Chakrabongse Villas — recent response rate ~60%, owner
    Narisa replies personally. Stock pitch wouldn't land. Either
    needs a custom pitch or skip.
- **Wave 2.1 — 2026-05-06 ~16:00 ICT:** 1 email sent (custom pitch).
  - Chakrabongse Villas (reservation@chakrabongse.com) — English,
    custom-pitch (not stock outreach). Acknowledged Narisa's existing
    reply quality first, framed ReviewHub as voice-scaling not voice-
    replacing. Audit included 1 critical 4★ review to demo nuance.
    Audit URL 9326cf61…4340 (initial send had a 3-char typo in the
    token from screenshot transcription; follow-up apology + correct
    link sent 5 min later). Subject: "A small thought after reading your
    replies on Google". Lesson: high-context prospects deserve
    fresh-per-prospect emails (per CLAUDE.md "templates → fresh-per-
    prospect when context is high" rule).
- **Wave 1 bounce logged:** baansukhumvit@yahoo.com address not found;
  Yahoo listing was stale third-party. Reinforced verified-live-website-
  email-only rule.
- **2026-05-08 dashboard reconciliation (queried via /outbound-audits):**
  Real audit-views data caught two corrections to the wiki/strategy:
  - **Pink Chili: 4 opens** (last 5/4 6PM), not the "1 opener" that
    earlier docs stated. Pink Chili was Wave 1's sole engager with
    significantly more engagement than recorded.
  - **"Voiij coffee and stuff"** appears in the dashboard with **7 opens**
    (last 5/7 5:31 AM). **Resolved 2026-05-08 by Earth: Voiij is a
    research/test audit the agent generated in a past session, NOT
    real outreach.** The 7 opens were Earth + agent verifying the
    audit-preview page during development. The "Replied ✓" badge on
    Voiij is a testing artifact, not a real customer reply.
  - **The "Replied ✓" elements visible in the dashboard are action
    BUTTONS, not status badges.** Resolved 2026-05-08: agent misread
    the UI all afternoon — the same "Replied ✓" label appears as both
    (a) the button to mark an audit as replied (visible when
    `opened && !marked_as_replied_at`) and (b) the inline status text
    (visible when `marked_as_replied_at` is set). API verification via
    `GET /api/audit-previews` confirms `marked_as_replied_at: null` for
    all 14 audits. **No audits are actually flagged.** Strategy
    "0 replies for Wave 1+2" stays correct. The mark-replied state was
    never the issue.
  - All 8 other Wave 1 prospects (Sweets Cottage, Tingly Thai, May
    Kaidee, Better Moon, Aim House, Vera Nidhra, White Ivory, House of
    Taste): 0 opens. Wave 1 audience-fit miss confirmed.
  - Baan Sukhumvit (bounced): 0 opens. Consistent with bounce.
- **Wave 4 — staged for Tue 5/12 + Wed 5/13:** 12 prospects researched
  (`docs/wave-postmortems/wave-4-candidates.md`); 12 fresh
  per-prospect emails drafted (`docs/wave-postmortems/wave-4-drafts.md`).
  9 TH + 3 EN. Send split 6/6 across Tue and Wed to stay under Gmail
  10/day cap. All emails surfaced via web research except Methavalai
  Residence (TLS cert mismatch — needs Earth browser eyeball pass).
  IR-ON email surfaced as `info@ir-onhotel.com` (2026-05-08 evening).
  Volve language call corrected to TH after press confirmed Thai owner
  ("Khun Um"); previous note had wrongly attributed ownership to interior
  designer Pitiphat Chongsomchit.
- **Wave 2 / Wave 1 follow-ups — scheduled in Gmail for Tue 5/12 10:00
  AM ICT:** all 12 sends already in Scheduled folder, fire without
  intervention. Includes Wave 2 +3-day follow-ups (Old Capital, Loftel
  22, Chakrabongse), Pink Chili +5-day follow-up (Wave 1 sole opener),
  and 9 customer-dev emails to Wave 1 cohort (Pink Chili variant TH;
  House of Taste, Better Moon, Sweets Cottage TH; Vera Nidhra, White
  Ivory, Tingly Thai, May Kaidee, Aim House EN).

## Deliverability diagnostic — 2026-05-06 evening

Mail-tester result for earth.reviewhub@gmail.com: **8.2/10 "almost
perfect"**. Authentication clean (DKIM signed + valid + AU + EF, IP
reputation +2). NOT in a spam folder.

The 1.8-point deduction breakdown:
- **PDS_OTHER_BAD_TLD: -1.999** — `.review` TLD on SpamAssassin's
  untrustworthy-TLDs list (generic flag for all `.review` domains
  due to historical spammer use, not flagged specifically against us)
- minor: FREEMAIL_FROM, HTML_MESSAGE, SPF_HELO_NONE (each -0.001)

**Strategic implication:** Wave 1 0/7 opens is NOT a deliverability
problem. Emails landed in inbox/promotions but recipients didn't engage.
Root cause: wrong audience (cooking schools don't care about Google
reviews). Don't double down on Wave 1 prospects with a follow-up;
instead send Wave 3 to better-fit verticals (hotels, B&Bs, dental).

**.review TLD as future concern:** worth tracking but not urgent. 8.2
is still inbox-tier. If outreach response stays poor across waves,
consider acquiring a more-trusted secondary domain (reviewhub.io /
reviewhub.app) for outreach links. Not now.

## Active outreach signals

- **2026-05-05** — Outreach queue has 3 verified prospects + 6 research
  targets. Wave 1 sent May 4 (9 emails). Awaiting 48h reply window
  before pattern-matching which verticals respond.
- Verticals showing source-availability so far: small B&Bs with own
  websites, vegetarian/pastry cooking schools, independent dental
  clinics, yoga/Muay Thai studios.

## Google Business Profile API application

- **Submitted 2026-05-09** under `earth.reviewhub@gmail.com`.
- **Case ID:** `8-9395000041442`
- **SLA:** 7-10 business days, up to 42 worst-case.
- **Cloud project:** `helpful-kingdom-495316-u4` (project number `562869028383`).
- **Verified-listing artifact:** brother's family business `บ้านแสนสุข กำแพงแสน`
  (brand account added as Manager, "1 business 100% verified" gate passed).
- **Until approved:** Places API v1 (read-only, no approval gate) ships
  manual-paste flow. See `docs/line-pivot/places-api-v1-spec.md`.
- **When approved:** swap fetch + post path to Business Profile API,
  upgrade landing copy to "one-tap auto-post."

## Pricing

- Free + Starter $14/mo + Pro $29/mo + Business $59/mo (all annual = ~17% off)
- 14-day trial KILLED — caused tire-kickers, signup→pay conversion
  worse than direct paid signup
- Source of truth: `server/src/lib/billing/plans.js`
- Free tier intentionally has `email_alerts_new: false` — pushing free
  users toward Starter, the headline upgrade reason

## Third-party API key rotation runbook

**Anthropic (claude.ai) API key — env var `ANTHROPIC_API_KEY`**

Symptom of expired/revoked key in prod:
- Sentry issue type `APIError.generate` with body
  `{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}`
- Customer-facing AI draft generation fails (Generate Reply button
  shows error toast, audit-preview drafts marked `source:"fallback"`)

Rotate (5-minute fire drill):
1. https://console.anthropic.com/settings/keys → Create Key →
   name it `reviewhub-prod` (delete the old one ONLY after step 4
   succeeds — keep both alive briefly to avoid downtime gap)
2. Copy the new `sk-ant-api03-...` value (108 chars usually)
3. Test it works BEFORE deploying:
   `curl -H "x-api-key: $NEW_KEY" -H "anthropic-version: 2023-06-01"
    -H "content-type: application/json"
    -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
    https://api.anthropic.com/v1/messages` — expect 200
4. `railway variables --service reviewhub --set "ANTHROPIC_API_KEY=$NEW_KEY"`
   triggers a redeploy
5. Wait for fresh container (`uptime_seconds` < 60 on `/api/health`)
6. Smoke test: `curl -X POST -H 'Content-Type: application/json' \
    -d '{"review_text":"Great!","rating":5,"business_name":"Test"}' \
    https://reviewhub.review/api/public/review-reply-generator`
    — expect `"source":"ai"` in response (NOT `"source":"cached"` or `"source":"fallback"`)
7. Now disable/delete the old key in console.anthropic.com
8. In Sentry, bulk-resolve the historical 401 issues

Probable revocation cause if it happens unexpectedly: Anthropic
auto-revokes keys that get committed to public repos or appear in
public scans. Run `git log -p -S "sk-ant-api03"` periodically to
audit. (No leak found in this repo as of 2026-05-10 — but worth
checking before assuming "key just expired.")

**Other key locations on Railway** (run `railway variables --service reviewhub`
to enumerate; rotate same way: validate-then-set-then-redeploy):
GOOGLE_MAPS_API_KEY, RESEND_API_KEY, LEMONSQUEEZY_API_KEY,
LEMONSQUEEZY_WEBHOOK_SECRET, LINE_CHANNEL_ACCESS_TOKEN, JWT_SECRET (extreme
caution — rotating JWT_SECRET invalidates every active session).

## Lessons learned (the painful ones)

- **2026-05-05** — Production OAuth callback used `writeSessionCookie`
  (typo) instead of `setSessionCookie`. No integration test caught it.
  Lesson: any new auth route needs a route-level happy-path test before
  shipping.
- **2026-05-05** — Google sign-in callback set the session cookie but
  the React app uses a localStorage `rh_logged_in` marker for
  synchronous PrivateRoute checks. User bounced back to /login. Fix
  was a `/auth/google/done#token=…` handoff route. Lesson: any new
  auth path that lands on a private route needs both server cookie AND
  localStorage marker.
- **2026-05-05** — Queue file got stale (4 items marked `[ ]` were
  already shipped in earlier sessions). Lesson: agent should mark items
  `[done]` in the same commit that ships them, not as a follow-up.
- **2026-05-04** — `REPLY_TO_PLATFORMS` defaulted to OFF when env var
  was unset. Headline paid feature (auto-post replies to Google) was
  silently broken in prod. Now defaults ON when unset, with loud boot
  log. Lesson: defaults for paid-tier features should fail loud, not silent.
- **2026-05-07** — Treated the launch playbook (`docs/launch/`) as
  authoritative without checking it matched current product state.
  Wrote a brand bio mentioning the Chrome extension, which was dropped
  weeks earlier. Lesson: every piece of repo content is a snapshot from
  a moment in time — pressure-test before executing on it.
  See `docs/skills/content-writing.md` §5 (stale-input check).
- **2026-05-07** — Posted a tweet on @reviewhubreview that went out as
  URL-only because JS execCommand insertText dropped the body text.
  Skipped the "verify rendered body in composer BEFORE Post" check.
  Lesson: every public-post action has a read-back gate. Codified in
  `docs/skills/social-presence.md` §2 + `content-writing.md` §4.
- **2026-05-08** — Stopping bug. After Earth said "ship" / autopilot,
  agent shipped 1-2 commits and wrote a "morning report" summary,
  treating the summary as a stopping point. The summary itself was
  the bug — Earth had to push back twice ("why I said ship and you
  are always stop", "why keep stopping"). Fix in
  `feedback_real_autopilot_no_stopping.md` memory: no end-of-batch
  recaps, maintain a private "next 5" list, ship until prod break /
  irreversible action / posting-as-Earth.
- **2026-05-08** — Stale Thai homepage hero CTA. The Thai
  `landing.heroCtaPrimary` translation was "ติดตั้งส่วนขยาย Chrome"
  (Install Chrome extension) for weeks after the Chrome extension
  was dropped from scope. The headline CTA on Thai homepage. Fixed
  to "เริ่มใช้ฟรี" (Start Free). Lesson: i18n translations need the
  same stale-input check as English copy. Pre-commit now blocks
  re-introduction via `scripts/check-stale-positioning.js`.

## What's making money

_(nothing yet — pre-revenue)_

When MRR > $0, log monthly: total MRR, by plan, churn, top acquisition
channel, biggest single-customer concentration risk.

## Content surface (as of 2026-05-08)

- **Blog**: 26 posts (13 EN, 13 TH, 11 paired with hreflang). Total
  ~22k words. Run `npm run stats:content` for live count.
- **Free tools**: 3 (review-reply-generator, reply-roaster,
  review-impact). Each indexed individually in /tools.
- **Vertical landing pages**: 8 (/for-restaurants, /for-cafes,
  /for-bars, /for-hotels, /for-spas, /for-dentists, /for-fitness,
  /for-pharmacies).
- **Comparison pages**: 3 (/vs/birdeye, /vs/podium, /vs/reviewtrackers).
- **SEO infrastructure**: PNG og:image + Twitter Card + BreadcrumbList
  + Article schema + hreflang on every paired blog post. Pre-commit
  hook blocks regressions via `npm run check:seo` and
  `npm run check:positioning`.

## What's not working

- **⚠ 2026-05-10 RETRACTION of an earlier 2026-05-10 retraction:**
  An earlier note here flagged Wave 1/2 open-rate stats as fabricated
  because `railway run node ...` returned 0 rows from
  `audit_previews`. That diagnostic was wrong. `railway run` connects
  env vars but uses the **local filesystem** at
  `server/data/reviews.db` (a Windows-machine sandbox), NOT the
  Railway volume at `/app/data/reviews.db` where prod lives.
  Verified via authed-Chrome `fetch('/api/audit-previews')` against
  the live API: 14 audits exist with real view counts. The original
  Wave 1 (1/9, 11%) and Wave 2 (3/3, 100%) numbers were CORRECT.
  Lesson logged in `feedback_railway_run_db_divergence.md`.
- **Wave 1 cooking schools (2026-05-04)** — 1 of 9 audit URLs opened
  (Pink Chili Thai Cooking School: 4 views). Verified
  2026-05-10 via live API. Mail-tester 8.2/10 confirms deliverability
  was fine; the 8/9 zero-view rate was an audience-fit problem
  (cooking-school owners don't have the same review-management pain
  as hospitality SMBs). Hypothesis-test for Wave 4 was correct.
- **Wave 2 (2026-05-06, hospitality 200+ reviews)** — 3/3 audit URLs
  opened (Old Capital Bike Inn 1 view, Loftel 22 Hostel 2 views,
  Chakrabongse Villas 3 views — one of which was 2026-05-09 visual
  verification, so true count is ~2). 100% open vs Wave 1's 11% =
  ~9× audience-fit lift. 0 of 3 replied — pitch/conversion is the
  real bottleneck. +3-day follow-ups drafted for Mon 2026-05-12, see
  `docs/wave-postmortems/wave-2-followups-monday.md`.
- **Wave 0 / soft launch (2026-05-03)** — Voiij coffee 9 views over
  6 days (heaviest re-opener of any audit), Baan Sukhumvit Inn 0
  views (email bounced — `baansukhumvit@yahoo.com — Address not
  found`). Voiij is the highest-engagement signal we have but no
  reply yet.
- **Bonus Wave 1 finding (2026-05-08)** — Baan Sukhumvit Inn email
  bounced (`baansukhumvit@yahoo.com — Address not found`). Wave 1
  was effectively 1/8 opens not 1/9. Confirms the importance of
  the outreach-queue.md "verify live email before adding"
  workflow rule.
- **X / Twitter** — account live at @reviewhubreview as of 2026-05-07
  with brand sparkle avatar + bio, but no posts yet (URL-only first
  attempt was deleted; first 7 drafts in
  [launch/x-first-week-posts.md](launch/x-first-week-posts.md)
  awaiting Earth's approval).
- LinkedIn — not pursued; no time
- Paid ads — explicitly not pursuing pre-PMF

## Competitor moves

_(empty — track here when a relevant change is observed)_

Watch list: BirdEye, Podium, NiceJob, ReviewTrackers (US-focused but
relevant feature creep).

## Decisions deferred to future-you

- **Telegram bot for ops alerts** — needs always-on machine. Re-evaluate
  when first customer lands or when a $5-20/mo VPS becomes cheap relative
  to revenue.
- **Multi-agent crew formalization** — premature pre-revenue. Re-evaluate
  when one founder hour is worth more than agent ceremony cost (probably
  ~5-10 paying customers).
- **Bundle-size split for Settings.jsx (107KB)** — risky refactor, low
  user-visible payoff pre-revenue. Revisit if a customer complains about
  Settings load time.

## Glossary

- **Wave** — a single batch of cold outreach emails (Wave 1 = May 4 send)
- **Audit funnel** — outbound: send a free AI-generated reply audit, link
  to /register?from=audit&business=… for self-serve signup
- **Operating queue** — `docs/operating-queue.md`, the cross-domain todo list
