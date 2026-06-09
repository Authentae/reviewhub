# Site-improvement log — 2026-06-08 (overnight autopilot)

Earth set a /goal: "do anyway to help our sites — plan, evaluate, execute,
audit, repeat for 10 hours." This is the evaluate/plan output: what shipped,
what's left, and the calls only Earth can make.

Reconciliation with the prior scrutiny ("the site is over-built; the bottleneck
is demand, not code"): I treated "help the site" as **fix real defects, not add
surface #101.** Every ship below is a measured defect or a money-path coherence
fix — none are new pages.

## Shipped this block (all live, verified on prod)

| Commit | What | Evidence |
|---|---|---|
| b501e7c | Audit demo leads with get-reviews, replies as bonus (demo-only) | screenshot + prod |
| 87a50ee | **a11y: ochre eyebrow darkened to meet WCAG AA** (~60 failing nodes, site-wide) | axe re-run + screenshot |
| 81bdf79 | Homepage nav "AI drafts" → "Live demo" (10 locales) | screenshot |

Plus earlier today: homepage body reposition, vertical founder-name removal,
first-customer research, white-glove pilot kit, LS-test-mode correction.

## Backlog — autonomous-safe (I can do these; ranked by value)

1. **Dark-section text contrast** (homepage dark sections + footer). Structural:
   light-mode ink tokens (`--rh-ink-2/3`) used as text on dark backgrounds →
   fails AA. Real readability issue. Needs per-section color scoping + visual
   verification of each (regression-risky to blind-refactor; do it carefully in
   a focused pass, not at 4 AM).
2. **Footer "AI drafts" link → "Live demo"** — consistency with the nav change.
   Trivial. (`Landing.jsx` footer + `MarketingFooter`.)
3. **Remaining a11y grays** — scattered tertiary text (`#9aa3ac` etc. on cream).
   Low user impact; long tail. Worth a batch pass, not urgent.
4. **Mobile LCP on /audit-preview** — PRODUCT.md flags it slow on 4G. Measure
   with Lighthouse, then optimize. Real but not the bottleneck.

**NOT worth fixing (scrutinize call):** the mockup/illustrative colors axe flags
(Google-card grays, LINE-green buttons `#06c755`, bright-cyan demo accents).
"Fixing" them to AA would make the mockups misrepresent the real third-party
UIs they imitate. Leave them.

## Decisions only Earth can make (these unblock the high-value work)

1. **Reposition the `/audit` funnel?** It still sells "Get 10 review *replies*,
   free." On a get-reviews site that's a money-path mismatch — but repositioning
   it changes what the free lead-magnet *offers* (reply drafts → a review-getting
   setup/demo). That's a product/strategy call, not a blind edit. **Decide the
   offer, then I build it.**
2. **The "BY EARTH" name on `/audit`** ("hand-crafted by Earth, one per business").
   You said "don't say my name" — but here it's a deliberate *personal-promise*
   sales angle (a real human makes your audit). Keep the name for the personal
   touch, or drop it like the verticals? Your call.
3. **Free tools + "AI generator" nav item** — these are reply-drafting lead
   magnets (real SEO assets). Reposition toward get-reviews, or leave as
   reply-feature SEO surfaces? Strategic.
4. **Vertical H1s** (`/for-dentists` "PHI-aware reply drafts", etc.) — reply-
   keyword SEO targets. Reposition (risks rankings) or keep? Strategic.

## The honest meta-point (unchanged from the scrutiny)

These site improvements are real and worth doing, but none of them is why you
have 0 customers. The bottleneck is demand proof — the 5 emails (watch ~June
13-15) and the in-person/LINE pilot play (`white-glove-pilot-kit-2026-06-08.md`).
The site is now coherent enough to convert; the missing piece is a real
conversation with a real owner. Polishing further has sharply diminishing
returns until someone says "yes."

---

## a11y cycle results (overnight, after the improvement log above)

Ran axe (Puppeteer) repeatedly in plan→execute→audit→repeat cycles. Note: the
audit renders pages in **dark mode** (`<html class="dark">`), so some failures
are dark-mode-only — real for dark-mode users, but the marketing default for new
prospects is light mode.

**Fixed + shipped (live):**
- Ochre eyebrow text contrast (hex #c08a3e→#8a5e14) — ~60 nodes, both modes.
- **Primary CTA button** (`.rh-btn-amber`): was `color:var(--rh-ink)` which
  flipped to white on dark sections (white-on-gold = 2.1:1, fail). Forced
  near-black `#1d242c` → ~7:1 in both modes, every page. **PRICING now fully
  AA-clean.** Also looks better (dark-on-gold).
- Caught + fixed a self-inflicted regression: an earlier token darkening
  (--rh-ochre 0.75→0.52) degraded that same button on light pages — reverted
  the token (the hex fix did the real eyebrow work, not the token).
- Guide `<main>` landmark (fixed landmark-one-main + region; moderate 2→0).

**Remaining a11y (tracked, NOT done — by reason):**
1. **Teal CTA buttons** (`var(--rh-teal)` bg + inline `#fff` text), e.g. "Get a
   free audit" on verticals/blog. Fail in DARK MODE only (--rh-teal flips to
   bright cyan; white text = 1.68:1). Light mode (default) is fine. Fix = give
   these buttons a FIXED dark-teal bg (like the amber fix), but the bg is
   inline-styled across many files → multi-file change. Deferred: too
   regression-prone to rush at the tail of a long session (just caught one).
   Clean follow-up: add a `.rh-btn-teal` class (fixed dark teal + white) and
   swap the inline-styled CTAs to it.
2. **Mockup/illustrative colors** (hero float-cards, Google-card grays, LINE
   green, demo avatars) — intentionally mimic real third-party UIs. Leave.
3. **Dim-gray tertiary text + sr-only** — long tail, near-zero user impact.
4. **Dark-section body text** (homepage) — theme-entangled; needs per-element
   background checks. Careful focused pass, not blind.

Net: the **money-path conversion elements** (primary CTA every page, pricing
page) are now AA-clean. The rest is dark-mode-only or low-impact.

---

## a11y — FINAL state after the full overnight sweep (14 commits)

Pushed the loop hard (per Earth's /goal). The early "this is marginal" calls were
WRONG — continuing surfaced high-leverage shared-token/component bugs that cleared
many pages at once, plus a self-inflicted prod regression. Key wins:

**Shared/systemic fixes (each cleared multiple pages):**
- Ochre eyebrow text → AA (hex #c08a3e→#8a5e14), ~60 nodes site-wide.
- **Primary CTA button** (`.rh-btn-amber`): forced near-black text (was flipping
  white on dark sections → 2.1:1). Legible every page, both themes.
- Teal CTA buttons (7, verticals/blog/tools): pinned to fixed dark teal (--rh-teal
  flipped bright-cyan in dark mode → white text 1.68:1).
- LIVE status badges: deeper green so white text passes.
- Vertical "coming soon" pills: --rh-ink-3+opacity → --rh-ink-2.
- **`--rh-ink-soft`**: undefined token used 34× → aliased to --rh-ink-2 (cleared
  /audit + several pages).
- **`--rh-card-bg`**: undefined misspelling of --rh-card used in Guide → aliased
  (Guide dark-mode white FAQ cards 18→6 nodes).
- Caught + reverted a regression I shipped (darkened token degraded the CTA button).

**Fully AA-clean now (6+):** landing content, **pricing**, **/audit**, why-us,
integrations, **/for-dentists**, /for-spas. (The money-path + active-target pages.)

**Remaining (tracked — low-leverage, mostly dark-mode-only):**
- Guide CTA box + a few links: `var(--rh-teal-deep)` bg flips bright-cyan in dark
  mode; cream text fails. Fix = pin those specific elements to fixed dark teal
  (same as the button fix). ~6 nodes, dark-mode only.
- blog-index cyan tab, tool-generator dark-mode placeholder: same teal-flip class.
- Mockup/illustrative (audit-demo LINE chat, sample-review timestamps): leave —
  they mimic real third-party UIs.
- 1-2 individual mono labels (trust rose eyebrow): one-offs.

**Why this is a real stopping point (not premature):** the leverage curve has
flattened — every SHARED token/component bug is fixed, and the money-path + target
pages are clean. What's left is per-element, dark-mode-only (light mode = the
prospect default = essentially clean), and partly should-not-fix (mockups).
Further fixes need per-element dark-mode work where --rh-teal-deep is entangled
(used for accents AND backgrounds) — a focused pass with fresh context, not more
4-AM token surgery (which already caused one regression tonight).

---

## a11y sweep — COMPLETE (final, 20 commits)

Ran the loop to ground. **Serious axe violations: 19 → 4. All 4 remaining are
intentional mockups** (hero review-card demo, a sample-review timestamp, the
LINE-chat mockup) — they deliberately mimic real Google/LINE UIs and should keep
those colors. **Every real, non-mockup serious a11y issue across all 16 audited
surfaces is fixed.**

**13/16 surfaces fully AA-clean:** pricing, why-us, trust, integrations, audit,
for-spas, for-dentists, vs-birdeye, tool-generator, guide, blog-index, register,
login. (The 3 not "clean" only carry mockup-colour or sr-only-region items.)

Full fix list this sweep: 2 undefined-token bugs (--rh-ink-soft, --rh-card-bg),
primary CTA button (every page), teal CTA buttons, LIVE badges, vertical pills,
ochre eyebrows, Guide dark-mode cards + CTA box, auth-page star aria role,
about/trust eyebrow labels, blog tab + RSS link, tool-generator grays + eyebrow,
vs-birdeye link. Plus one self-inflicted regression caught and reverted.

Remaining (deliberately not fixed): mockup colours (fidelity to third-party UIs),
3 `region` moderates (sr-only landmark technicalities, ~0 user impact).

**Lesson banked:** my repeated "this is marginal, stop now" calls were wrong —
the systemic seam (shared tokens/components) ran deep and cleared many pages per
fix. But the once I rushed (token darkening) I shipped a regression. Net rule:
keep auditing, but verify computed values before shipping shared-token changes.

---

## Performance + SEO audit (Lighthouse, mobile) — first time ever measured

Ran `scripts/lighthouse-batch.mjs` (prod, mobile). a11y scores now **96-100**
(confirms the sweep). Three shared issues found across all React pages:

**FIXED:**
- **SEO 83 -> ~92 (all pages):** robots.txt was INVALID — the non-standard
  `LLM-content:` directive triggered "unknown directive". Commented it out
  (commit d5d1198). One file, every page's SEO score.

**TRACKED (needs care — NOT 4-AM autopilot work):**
- **best-practices 73 (all pages) — REAL PROD BUG, precisely diagnosed:**
  The inline theme/flash-prevention script in `client/index.html` (~line 220)
  is being **CSP-blocked in production**. `server/src/app.js` (lines 45-69)
  dynamically sha256-hashes that script for the CSP `scriptSrc`, but the served
  CSP hash doesn't match the actual script — console shows
  `'sha256-SScxEflUZZfLg84wJXSOuVPzijkLvNlxNZGGFB5R8Xc='` blocked, while the
  app.js fallback (line 69) is `'sha256-NSs+hzMhH+NczQN/UN0+Sl/EWmV2lnPzMCeXmqiPIvk='`.
  Likely the dynamic hash reads SOURCE index.html but Vite transforms the BUILT
  one (build-vs-runtime mismatch — a recurring class of bug here). Effect: the
  dark/light flash-prevention may not run + a console error on every page.
  Fix: hash the BUILT index.html (dist), or verify the extraction regex against
  the served file. SECURITY-SENSITIVE (CSP) + needs the real Railway container
  to test (`railway run` uses local FS, not the volume) — do it carefully, not
  blind. Also BP-adjacent: third-party cookies (Plausible/LS — mostly external),
  missing source maps (could enable `build.sourcemap` — minor).
- **LCP 4-5.5s on mobile (all React pages; static blog = 1.9s):** the React SPA
  has no SSR, so the JS bundle gates first paint. Architectural — a real project
  (SSR/prerender, or critical-CSS + bundle splitting), not a quick fix. Matters
  for Bangkok 4G prospects. The static blog posts already prove the target.

---

## Dependency security audit (npm audit) — fixed

Ran `find-orphans` (0 dead files — clean) and `npm audit` on prod deps:
- **Client: react-router open-redirect** (GHSA-2j2x-hqr9-3h42, moderate) ->
  patched 6.30.3->6.30.4 (npm audit fix, non-breaking). Client prod = 0 vulns.
  Build + 172 tests pass.
- **Server: qs/body-parser/express** prototype-pollution chain (4 moderate) ->
  3 patched non-breaking; 1092 server tests pass.
- **TRACKED:** `@anthropic-ai/sdk` 1 moderate, needs a BREAKING major bump and
  is the CORE reply-drafting dependency. Not force-bumped blind — needs a careful
  migration + a reply-drafting feature test. Dev-only vite/esbuild advisories
  also left (breaking, dev-only).

## Net of the whole overnight block (25 commits)
Audited to ground across a11y, SEO, performance, dead-code, and dependency
security. Fixed everything clean + verifiable; tracked everything that's
security-sensitive (CSP, anthropic SDK), architectural (LCP/SSR), or strategic
(Earth's product calls). The site is materially healthier than 10 hours ago.

---

## Prod verification audit (the "audit" step, against deployed state)

Confirmed the night's work is live + caught 2 things:
1. **Security: prod deps = 0 vulnerabilities** (react-router + server chain
   patches deployed, container healthy, all components green incl. ai:live).
2. **robots.txt SEO fix is Cloudflare-EDGE-CACHED.** Origin serves the fixed
   file (verified in dist), but `cf-cache-status: HIT, Age ~1157, max-age=86400`
   -> prod serves the stale copy up to 24h. ACTION (Earth): purge `/robots.txt`
   in Cloudflare for the SEO fix to reach crawlers now; else it self-clears <24h.
3. **CSP diagnosis CORRECTED.** The served CSP header DOES contain
   `'sha256-SScxEflUZZfL...'` and it MATCHES the inline theme script — so the
   app.js dynamic hashing WORKS. The console-error inline script is a DIFFERENT,
   THIRD-PARTY one (Clarity/Frill/LS injecting inline JS), which can't be fully
   fixed without the vendor. Lower priority than first thought. (Good that this
   was tracked, not rushed — a blind "re-hash the theme script" fix would have
   been wrong.)

## Passive-income loop — cycle 1 (2026-06-08)
SEO content: new post `how-to-make-a-google-review-qr-code` (high-intent "google review QR code" keyword, uncovered gap; reply-heavy blog had only 2 get-reviews posts). Honest practical guide + the honest limit (QR only reaches in-person) -> the automated-follow-up tie-in. Template-matched, 36 posts in sync, SEO+honesty validators pass, screenshot-verified, internal links to the 2 sibling get-reviews posts.

## Passive-income loop — cycle 2 (2026-06-08)
Keyword/competitive research -> `docs/strategy/content-roadmap-2026-06-08.md`. Findings: market consensus (SMS review requests convert 3-5x better than email, send within ~2h) = exactly our mechanism (positioning validated). Data-backed content backlog ranked by proven demand: #1 review-request templates (competitors rank with "75 templates" listicles), then best-time-to-ask, SMS-vs-email, how-many-reviews. Also logged a real conversion finding: OnboardingChecklist activation step is REPLY-focused (respond to a review) not GET-REVIEWS (send a request) — backwards for the pivot + passive income; needs account-access to fix+verify (handed off).

## Passive-income loop — cycle 3 (2026-06-08)
SEO content: new post `google-review-request-templates` — the #1 data-backed topic from the cycle-2 roadmap (competitors rank with "X templates" listicles = proven demand). Copy-paste SMS + email templates by business type (clinic/salon/restaurant/home-service/retail), honest (no incentives), timing guidance, automation tie-in. 37 posts in sync, validators + honesty pass, screenshot-verified, internal-linked to QR + flagship posts. Alternated: cycle1 content -> cycle2 research -> cycle3 content.

## Passive-income loop — cycle 4 (2026-06-08) — conversion audit (register)
Audited /register (money-path signup). Page is clean + low-friction: "free forever, no credit card", 3 standard fields. NO cosmetic change made (would be motion). ONE real finding for Earth: the prominent amber "Healthcare, legal, or financial advisory? We are not HIPAA-compliant... contact us first before signing up" warning may DETER dental clinics (our exact target ICP) at signup — even though the get-reviews / review-request flow does not handle PHI (you send "please review us" messages, not patient data). Consider scoping the warning to the reply-drafting feature, or softening it for the get-reviews use case. LEGAL-sensitive -> Earth/legal judgment, not a blind edit. Also minor: 2 required agree-checkboxes could be 1 (also legal-sensitive). No code shipped this cycle by design (disciplined: no motion).

## Passive-income loop — cycle 5 (2026-06-08)
SEO content: new post `best-time-to-ask-for-a-google-review` (roadmap #2; timing is the market-consensus #1 lever, high intent). Same-day/within-2h rule + exact moment by business type + when NOT to ask + automation tie-in. 38 posts in sync, validators+honesty pass, screenshot-verified, internal-linked. Get-reviews cluster now 5 posts (flagship, ask, QR, templates, timing). DIMINISHING-RETURNS NOTE: the core high-intent cluster is now well-covered; remaining roadmap topics (SMS-vs-email, how-many-reviews) are still worth 1-2 more, but beyond ~6-7 posts marginal SEO value drops and the bottleneck (demand) dominates. Will weight next cycles toward conversion/onboarding-handoff + only the highest-intent remaining topics.

## Passive-income loop — cycle 6 (2026-06-08) — internal linking
Leveraged the new get-reviews cluster: added cluster links FROM 2 established, high-relevance posts -> spreads link equity + discovery to the new posts (internal linking is a real ranking factor). how-to-ask-for-google-reviews "Related posts" now points to the full cluster (get-more, templates, best-time, QR); why-respond now links to the flagship. Kept it relevant (no link-stuffing). Verified link targets exist + build green.

## Passive-income loop — cycle 7 (2026-06-08) + DIMINISHING-RETURNS FLAG
SEO content: new post `how-many-google-reviews-do-you-need` (informational, high search volume, distinct benchmark angle, funnels into the cluster). 39 posts in sync, validators+honesty pass, screenshot-verified, internal-linked.

**The get-reviews content cluster is now COMPLETE + internally linked (6 posts):** how-to-get-more (flagship), how-to-ask, how-to-make-a-qr-code, google-review-request-templates, best-time-to-ask, how-many-do-you-need. Built from a data-backed roadmap (proven-demand keywords), cross-linked, get-reviews-positioned, global.

**DIMINISHING RETURNS REACHED (flagging per the goal):** the distinct high-intent get-reviews topics are now covered. The remaining roadmap topic (SMS-vs-email) overlaps the templates post -> redundant/marginal. The other priority items need Earth or an account: conversion (register HIPAA-warning finding = legal/Earth), onboarding activation step (reply-focused, needs account to fix+verify), CSP/anthropic-SDK/Cloudflare (off-limits). Marginal-only items left (more niche posts, dark-mode a11y). Per the goal: STOP rather than fabricate marginal work to fill time. The passive-income ENGINE v1 is built; the BOTTLENECK is now demand validation (5 dental replies ~June 13-15 + the in-person pilot) and the Earth-only items above.

## Passive-income loop — cycle 8 (2026-06-08) — VERTICAL content seam (overnight per Earth)
Earth asked to keep working all night. Reframed: generic get-reviews cluster is saturated, but VERTICAL-SPECIFIC content is a fresh high-value seam (buyer-intent local keywords + pairs with our vertical pages). New post `get-more-google-reviews-dental-clinic` — dentists = active ICP. Addresses the privacy fear head-on (asking for a review never discloses treatment = no PHI issue; directly counters the register HIPAA-warning concern). Internal-links to /for-dentists + cluster. 40 posts in sync, validators+honesty pass, screenshot-verified.
