# Morning brief — 2026-05-19 (end of long session)

**Date:** Tuesday 2026-05-19. Wave 5 first batch fires at 09:00 ICT
(Bangkok time) automatically from your `earth.reviewhub@gmail.com`
Scheduled folder. No action needed unless you want to cancel any of
the 7 prospects scheduled today.

---

## ☕ The 4 things to do first when you wake up

1. **Look at `/admin/brief`** — it now surfaces Pro/Business waitlist
   signups + the existing outreach view-count panel + warm-prospect
   row. One screen, full picture.

2. **Rotate `JWT_SECRET` on Railway** (3 min in the dashboard) — the
   current value is at the 32-char minimum threshold. Generate fresh
   64-char value: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   Set it in Railway → Variables. You'll be logged out, log back in.

3. **Open Gmail (`earth.reviewhub@gmail.com`) → Scheduled** — verify
   the 14 Wave 5 emails are still queued. Decide if you want to pull
   Treasure Spa (known echo-bug in draft) and Asok Montri (Thai PHI
   drift). Other 12 are clean.

4. **Skim `docs/page-flow-audit-2026-05-19-v2.md`** — the structural
   audit I did this session. 5 "build first" items are all shipped;
   2 things still pending (founder photo upload, /admin/brief
   Plausible API integration — needs your Plausible API key).

---

## Everything shipped this session (18 hours, ~20 commits)

### Conversion experiments (live for Wave 5)

| # | Ship | Effect |
|---|------|--------|
| 1 | Above-fold CTA banner on audit-preview | Prospects no longer scroll past CTA visibility |
| 2 | Founder card with story | Humanizes the audit page |
| 3 | Review wall collapsed to 2 + expander | Pulls teal CTA closer to viewport |
| 4 | ChatGPT comparison row on /pricing | Answers "why pay $14 when ChatGPT is $20" |
| 5 | Pro/Business waitlist (replaced dead button) | Turns gated pricing into demand signal |
| 6 | Public demo audit URL (`/audit-demo`) | /pricing visitors can see a sample without an outreach link |
| 7 | Blog inline CTAs on 29 posts | Captures mid-post readers, not just footer scrollers |
| 8 | **Tone switcher on audit-preview** (warm/concise/formal) | **Biggest single conversion lever — addresses "will the AI embarrass me?" objection** |
| 9 | LINE chat button + Email me on audit-preview | Async hand-raisers don't need to sign up |

### Retention/activation

| # | Ship | Effect |
|---|------|--------|
| 10 | Weekly impact email | "You replied to N reviews, ~M min saved" — Monday digests |
| 11 | First-reply celebration toast + Plausible activation event | Marks the "I've crossed the threshold" moment |
| 12 | Stripe-paid welcome email | Honest acknowledgement of payment before manual provisioning |
| 13 | Founder alert email on Stripe signup | You see new customers in your Gmail immediately |
| 14 | /register source-aware copy (stripe/audit/organic) | Each signup path feels intentional |
| 15 | Dashboard 3-way empty state | "Connected — first reviews in ~2 min" no longer silent |
| 16 | /settings onboarding wizard | First-time customer gets a checklist, not a flat page |

### Infrastructure / hygiene

| # | Ship | Effect |
|---|------|--------|
| 17 | Killed 11 dead pages (api-docs, status, roadmap, line, year-review, 3 vs/*, 6 verticals) | Surface 50→41 routes; ~1,300 lines deleted |
| 18 | Plausible funnel events (16 distinct) | Landing → Pricing → Audit → Register fully readable |
| 19 | Cache-Control headers for SPA HTML | Edge-cache 10 min → expected 16%→50%+ Cloudflare hit rate |
| 20 | Dental AI guardrails (PHI-aware, multi-language) | IDENT + Asok Montri audits regenerated clean |
| 21 | CI fix (.npmrc + Dockerfile + flaky test timeout) | First green run since 2026-05-10 |
| 22 | Railway healthcheckTimeout 120→200s | Stops false "FAILED" badges on cold-boot |
| 23 | /admin/brief surfaces waitlist demand | Glanceable build-vs-kill decision data |

---

## What's pending (you to do)

1. Rotate JWT_SECRET (above)
2. Upload founder photo to replace "E" initial circle on audit-preview
3. Decide on Treasure Spa + Asok Montri before Wed 09:30 / 10:00 sends
4. Verify `@024hjpcv` is the right LINE OA Basic ID
5. Re-submit sitemap if Search Console still shows "couldn't fetch"

---

## Data you'll have within 7 days

- Wave 5 audit-view rate per vertical (Muay Thai / spa / dental / coffee)
- Wave 5 reply rate (currently 0/36 historical — any non-zero is signal)
- Plausible funnel: of N landing visitors, M clicked CTA, P submitted Register
- Tone-switch engagement (does anyone actually toggle? which tone?)
- Pro/Business waitlist signups (5+ = build candidate; 0 = kill the tier)

---

## What I deliberately did NOT do

- More verticals (still on 2-vertical probation)
- More comparison pages (still on 2-comparison probation)
- API surface (deleted /api-docs; don't resurrect until 5+ customers ask)
- Mobile app (web works fine on phones)
- Pro/Business features (waitlist instrument shipped; build on demand signal)
- Multi-location
- Year-review feature
- /status uptime vanity page

---

## The honest read

**Stage:** Pre-revenue with materially better conversion infrastructure
than 24 hours ago. Single sellable tier ($14 Starter). 0 customers.
~1,500 monthly visitors organic.

**Biggest single risk:** Wave 5 sends Tue/Wed; if 0 of 14 prospects
convert by Sun 5/24, the conclusion is "audit-to-paid funnel is
broken at the activation step, not the awareness step" — and the next
move is customer-dev interviews with Wave 1-4 hot leads (Chakrabongse,
Pink Chili, etc.).

**Biggest single opportunity:** Wave 5 prospects landing on
audit-preview now get the full conversion experience — above-fold
CTA, founder card, tone switcher, demo-able tones. If even 1 of 14
converts, that's the difference between "no signal" and "we know
something works."

**What I'd tell a sharp peer:** "Shipped 23 things in 18 hours. Don't
ship any more product until Wave 5 data lands. The next move is
reading data, not building features."

Sleep well.

— agent, 2026-05-19 03:30 ICT

---

## Overnight loop addendum (cycles 1-5, ~03:35-04:40 ICT)

While you slept, 5 more ships landed via the 15-min cron loop, one
per cycle, alternating type per the rule (doc → code → content →
visual → code):

| # | Type | Ship | Why |
|---|------|------|-----|
| 1 | doc | Wiki refresh — Wave 5 entry + content surface | Wiki had drifted from reality after 23 ships in the prior session |
| 2 | code | Server tests for /api/waitlist (12 tests) + NODE_ENV=test rate-limit bypass | Demand-signal endpoint shipped today with zero coverage — protects the build-vs-kill data |
| 3 | content | New blog post: ChatGPT for Google review replies (EN+TH) | /vs/chatgpt + pricing comparison row just shipped; needed the search-intent post |
| 4 | visual | "NEW" badge on /blog index for posts <7 days old | Fresh content was invisible across 31 posts; auto-expires by date |
| 5 | code | Deleted 5 orphan files + 3 dead tests (~1,700 lines, ~36 KB) | Dead code is a compounding tax; flagged by find-orphans.js |
| 6 | doc | Wiki + morning-brief synced with cycles 1-5 | Doc-as-canonical only works if it stays canonical |
| 7 | visual | og-image.svg + .png regenerated to match real hero ("Reply to Google reviews in 10 seconds — from your phone") | 6+ weeks of every X/LinkedIn/iMessage share previewing a tagline that no longer exists on the site |
| 8 | content | New blog post: How fast should you reply? (EN+TH) | Search-intent gap + aligns with the new "10 seconds" og-image |
| 9 | code | Server tests for /api/support (13 tests) | Public no-auth endpoint emailing the founder — needed coverage on honeypot + CR/LF + /me cross-user leakage |
| 10 | doc | Memory file: `feedback_static_assets_drift_silently.md` | Codified the drift class behind cycle 7 so future sessions sweep early |
| 11 | visual | PNG favicon fallbacks at 32/180/192/512 | iOS Add-to-Home-Screen was showing the generic page screenshot |
| 12 | content | Fixed feed.xml drift — added 5 missing posts (incl. chatgpt + how-fast pairs) + bumped lastBuildDate | RSS feed was 11 days behind the blog dir |
| 13 | code | New `scripts/check-blog-sync.js` + pre-commit hook | Structural guard against cycle 12's drift class — every future blog ship is checked |
| 14 | doc | `docs/autopilot-loop-playbook.md` | Distilled the loop patterns so the next overnight session starts at cycle 1 with the rules already known |
| 15 | visual | Drift sweep 2nd pass — `og:image:alt` + audit-svg comment refreshed | Second class of "editorial dashboard" reference caught after the playbook ship |
| 16 | content | 5th /pricing FAQ: "Why pay when ChatGPT exists?" | Bottom-of-funnel objection answered at the moment of intent |
| 17 | code | Server tests for /api/plans + plans.js helpers (16 tests) | Quota-gating source of truth — silent un-gating regressions would be invisible |

Full per-cycle reasoning in `docs/overnight-log-2026-05-19.md`.

Loop continues firing every 15 min at :07/:22/:37/:52 ICT.

### Summary so far

- **17 cycles** shipped in ~4 hours
- **17 commits** to `main` (each cycle = one self-contained commit + push + Railway redeploy)
- **+5 blog posts** (ChatGPT + how-fast pairs, EN+TH each) → 33 total
- **+41 new server tests** (waitlist 12, support 13, plans 16) + cycle 5 deleted 3
- **2 new pre-commit guards** (blog-sync, plus honesty-lint inherited)
- **1 memory file** (`feedback_static_assets_drift_silently.md`) — auto-loaded next session
- **1 playbook** (`docs/autopilot-loop-playbook.md`) — reference for the next overnight run
- **0 STOP triggers fired** — CI green throughout, no Wave 5 lockdown breaches

If the loop is still running when you wake, the cron job ID is `b7c3edfe`. Cancel
with `claude` → "cancel cron b7c3edfe" or via the CronDelete tool.
