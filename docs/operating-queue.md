# Operating queue — single source of truth for "what's next"

> **STRATEGIC ANCHOR:** The 30-day plan in
> [`docs/strategy-30day.md`](strategy-30day.md) supersedes
> the queue when they conflict. The queue lists work that's
> available; the strategy says which work matters. Right now
> the strategy says: stop adding queue items unrelated to
> Wave 2 follow-ups, Wave 4 send, and customer-development
> emails. If you're tempted to add a "ship more SEO posts"
> item, don't — read the strategy doc first.

The unified work list across **code / web / business / customer-
relations**. Replaces the founder having to context-switch between
roadmap.jsx + lead-finding.md + audit-outreach.md + outreach-queue.md
+ ad-hoc bug list to figure out what to point an agent at.

**How to use this file:**

- Day-to-day: tell the agent *"work the queue"* (or `/loop work the queue`).
  The agent picks the top unblocked item, ships it, marks it done,
  picks the next one, repeats until you say stop or the queue empties.
- When you have a new request mid-session: prepend it to the top of
  the appropriate section. The agent will pick it up on the next
  loop iteration.
- The agent appends new items it discovers (test gaps, refactor
  opportunities, customer-relation follow-ups it notices) to the
  bottom of the relevant section.

**Status flags** — every item carries one:

- `[ ]` — ready to ship, agent can pick this up unprompted
- `[wait:user]` — needs a one-line answer or a yes/no from you
- `[wait:signal]` — needs real-world data we don't have yet
  (a customer reply, a paid signup, a week of usage stats)
- `[wait:deploy]` — code ready, blocked on production deploy
- `[done]` — shipped, leave for ~7 days then prune
- `[skip]` — looked at, deliberately not doing; carries reason

Within a section, ordering is **leverage-first**: the thing that
moves the needle the most goes top, regardless of effort.

---

## CODE — app, server, tests

The app side. Roadmap.jsx is the public face; this is the working
list.

- `[done] 2026-05-09` LINE pivot v1: Places API integration shipped.
  `googlePlaces.js` + `placesPoller.js` (30-min cron) + Settings UI
  Place ID lookup + honest landing copy ("Tap to copy, paste in
  Google. One-tap auto-post launches Q3 2026"). 27 unit + integration
  tests green. Plumbed end-to-end except for **Earth's env var**:
  set `GOOGLE_MAPS_API_KEY` on Railway (Cloud Console → enable
  "Places API (New)" → Credentials → Create API key → restrict to
  Places API New). Until that's set, the poller no-ops on every tick.
- `[wait:signal] 2026-05-09` Google Business Profile API approval
  (case 8-9395000041442, 7-10 business days SLA). On approval, swap
  `placesPoller.js` calls to OAuth-based `GoogleProvider`, wire
  `/api/reviews/:id/approve-from-line` to auto-post, update landing
  copy from "Tap to copy" back to "one-tap approve, we post it."
  ~2 hours of work post-approval; see `docs/line-pivot/places-api-v1-spec.md`
  "v1 → v2 migration."

- `[done]` Magic-link sign-in (email-link path of the "both" choice).
  Passwordless alternative on /login: type email, click "email me a
  link", click button in inbox, signed in. 15-min TTL, single-use,
  honors MFA if enabled.
- `[wait:user]` Google OAuth sign-in (Google-button path of "both").
  Code is straightforward (~2 hours) but requires you to:
    1. Open https://console.cloud.google.com → APIs & Services
       → OAuth consent screen → set up an OAuth app for ReviewHub
       (most fields can match the existing googleOAuth.js client
       used for review-fetching, OR be a separate sign-in client)
    2. Add authorized redirect URI: `https://reviewhub.review/auth/google/callback`
    3. Copy the client_id + client_secret into prod env vars
       (GOOGLE_SIGNIN_CLIENT_ID, GOOGLE_SIGNIN_CLIENT_SECRET)
    4. Tell me the client_id (only — secret stays in env vars)
  Agent ships the rest immediately after you do (1)-(4).
  Alternative: skip and rely on magic-link only for now —
  passwordless via email already covers the "older owner who
  forgets passwords" use case.
- `[done]` Scheduled reply send — `server/src/jobs/scheduledReplyPoster.js`
  cron + `reviews.scheduled_post_at` column, polls every 5min and posts
  ready replies via the platform provider.
- `[done]` Read-only role — shipped option B (share-token).
  Owner mints links from Settings → "Read-only share links";
  recipient opens `/shared/<token>` for a read-only dashboard mirror.
- `[done]` Year-in-review — `client/src/pages/YearReview.jsx`
  printable recap at `/year-review/:year`; aggregates from existing
  reviews table, no schema changes.
- `[done]` Component test for FilterPresets — shipped at
  `client/src/__tests__/FilterPresets.test.jsx` (apply/save/delete
  + localStorage namespacing coverage).
- `[done]` Bundle-size split (3 phases). WebhooksSection, AutoRules,
  ResponseTemplates extracted to `client/src/pages/settings/`,
  lazy-loaded via React.lazy + Suspense. Settings: 114.57 → 84.83 KB
  raw (-30 KB / -26%), 26.90 → 20.95 KB gzipped (-6 KB / -22%). Three
  lazy chunks: WebhooksSection 11.59KB/3.5KB, AutoRules 11.68KB/3.3KB,
  ResponseTemplates 7.82KB/2.2KB. All chunks fetch only when user
  scrolls to that section. 202 client tests still green.
- `[done]` E2E test for vacation suppression. Shipped at
  `server/tests/vacationSuppression.test.js`. Six cases: no-vacation
  baseline, today/future suppress both email+LINE, yesterday (expired)
  fires normally (off-by-one guard), reviews still ingest during
  vacation (the worst-failure-mode guard), API-clear restores fires.
- `[done]` Test for audit-preview → register attribution flow.
  Shipped at `client/src/__tests__/RegisterAuditAttribution.test.jsx`
  (5 cases: happy path, URL-encoded unicode, no `from` guard,
  non-audit `from` guard, missing-fields tolerance).
- `[done]` Smoke test for posted-to-Google badge pipeline. Shipped at
  `server/tests/postedToPlatformBadge.test.js`. Four cases: happy
  path sets response_posted_at and badge data surfaces in GET;
  REPLY_TO_PLATFORMS='' disables auto-post; selective platform list
  doesn't post excluded platforms; manual reviews (no external_id)
  skip auto-post entirely. Also added `replyToReview()` to MockProvider
  so the wiring is testable without real Google creds.
- `[wait:signal]` Native iOS / Android app — out of scope without
  weeks of investment + App Store review pipeline. Defer until a
  paying customer specifically asks.

## WEB — marketing, SEO, content, public surfaces

The reviewhub.review site itself + everything a prospect sees.

- `[done]` Update `/changelog` — added wave 4 entries (Sign in with
  Google, magic-link, share-tokens) with EN+TH for each. Was missing
  three customer-facing ships from May 5.
- `[skip]` (was) Update `/changelog` with wave 1-4 ships from today. Right now
  the changelog is silent on outbound-audit tracking, follow-up
  reminders, vacation mode, filter presets, status page, posted
  badges. Customers checking what's new will see nothing.
- `[done]` OG card for /audit-preview pages. Title and description were
  already per-prospect personalized via useSocialMeta. Added: dedicated
  og-image-audit.svg (audit-flavored headline + eyebrow), extended
  useSocialMeta to support og:image + twitter:image override, wired
  into AuditPreview. Per-prospect images would need server-side image
  rendering — out of scope; static branded card is the right next step.
- `[skip]` (was) Open Graph image for `/audit-preview/<token>` URLs — right now
  when a prospect pastes the URL in iMessage/LINE/Discord, the
  preview card is empty. Static OG image (we ship one for the rest
  of the site) + per-audit dynamic title ("AI reply drafts for
  {business_name}") would make the cold-DM link feel real.
- `[done]` Blog post: "Why your Google reviews need owner replies".
  Shipped at `client/public/blog/why-respond-to-google-reviews.html`.
- `[skip]` (was) Blog post: "Why your Google reviews need owner replies (and
  what to say to a 1-star)" — long-tail search target for small
  business owners. ~600-800 words, Thai + English. Includes 3
  copy-pasteable reply templates.
- `[done]` Blog post: "How to respond to fake/extortion Google reviews".
  Shipped at `client/public/blog/fake-extortion-google-reviews.html`.
- `[skip]` (was) Blog post: "How to respond to fake/extortion reviews on
  Google" — high-intent search; we already have prompt-rule
  coverage for this in aiDrafts. Make the page that shows up
  when an owner panic-Googles it.
- `[wait:signal]` Landing page hero — does it speak to the audit-first
  prospect (someone who arrived via a /audit-preview/<token> CTA
  and clicked "set this up for me")? Test once we have a clicked-
  through prospect. Right now the hero assumes the visitor is
  generic-curious. Self-blocked: needs real conversion data first.
- `[done]` Comparison pages: ReviewHub vs Birdeye / Podium / ReviewTrackers.
  Single ComparisonLanding component shipped at /vs/birdeye, /vs/podium,
  /vs/reviewtrackers. Honest positioning (acknowledge who $competitor
  is right for, then pivot to who we're right for) — no smear copy.
  Each page: pricing snapshot, 10-11 row feature table, "pick them if"/
  "pick us if" blocks, Article+SoftwareApplication schema, cross-links.
- `[done]` Tools index page at /tools. Three structured cards tying
  the free-tool cluster together. Bilingual EN/TH. Cross-links to /audit.
  Wired into routes + sitemap.
- `[done]` Blog post: "How to ask customers for Google reviews without
  being pushy". 7-min read covering the five natural ask-windows, why
  discount-for-review violates Google policy, the QR-code mistake,
  and the 1-star prevention move.
- `[done]` More verticals: /for-bars, /for-fitness, /for-pharmacies.
  Three new long-tail SEO pages, each with tone-matched pain-point
  copy (sharper for bars, mixed for fitness, privacy-aware for pharmacies).
- `[done]` Free tool: Review Impact Scorer at /tools/review-impact.
  Paste a negative review, get damage score (0-100), risk category,
  reviewer-type guess (legitimate / venting / extortion / competitor),
  and a recommended action (apologize / clarify / flag / ignore).
  Pure heuristic, no AI cost. Sibling pattern to /tools/reply-roaster.
  Shareable in restaurant/hospitality forums when owners panic about
  a fresh 1-star.
- `[skip]` (was) Free tool: Response-rate audit via Places API.
  Earth paused at the Google Cloud billing form (2026-05-06) and asked
  the right question: "is this really worth it?" Honest answer: no —
  not until the existing two free tools (Reply Roaster, Review Impact)
  show usage signal. Don't build the third instance when the first two
  are unproven. Revisit only after Plausible shows traction on the
  existing tools. Lesson logged to memory.
- `[done]` `/changelog` localization audit. Result: page already had
  bilingual EN/TH per entry (Thai users were never English-only); the
  two real gaps were (a) browser tab title was English-only via
  t('changelog.title') with no TH key — switched to inline isThai
  matching the rest of the page; (b) intro paragraph rendered the
  GitHub deep-link only for English readers — Thai readers got no
  inline link. Both fixed.
- `[done]` sitemap.xml refresh. /status and /roadmap were already
  there; added missing /audit (high-value funnel landing page) and
  bumped /changelog lastmod to today.

## BUSINESS — sales, pricing, ops, lead-gen volume

Outbound work + business mechanics. Lower-frequency but higher-
leverage when triggered.

- `[skip]` Plausible.io activation — parked 2026-05-08. Earth asked
  "why do we need Plausible?" — honest answer is we don't, at least
  not yet. We already have server-side `audit_previews.view_count`
  per prospect and Railway access logs for traffic + referers. The
  one thing Plausible would add is the `AuditRegisterClick` event
  for measuring CTA click-through on the Scenario A A/B variant test.
  But that experiment isn't live yet, and if/when it activates we
  can ship a server-side equivalent in ~30 min: `POST /api/audit-clicks`
  endpoint + new `audit_clicks` table + fire from the Register button
  in `AuditPreview.jsx`. No third-party dependency, no privacy banner,
  no extra account. The Plausible script tag stays in HTML (cheap,
  doesn't hurt) — it's only the Plausible.io account/dashboard side
  we're skipping. Re-evaluate if Scenario A actually fires in Week 2.
- `[done]` Plausible tagged-events on audit-preview register CTA
  (2026-05-07). `client/index.html` switched to script.tagged-events.js;
  `AuditPreview.jsx` register CTA tagged with
  `plausible-event-name=AuditRegisterClick`. Test pins the class so
  refactors don't strip it. CSP auto-rehashes the inline script at
  server boot, no manual hash bump needed. 207/207 tests green.
- `[done]` AuditPreview component test — `client/src/__tests__/AuditPreview.test.jsx`.
  Four cases: loading spinner, 404-expired-link branch, happy-path
  business-name + draft + Copy buttons + founder-reply alt-CTA, and
  the register CTA's `?from=audit&business=...&token=...` attribution
  encoding. Pins down the wave-2-bottleneck page so future CTA
  iterations don't silently break the funnel. 206/206 client tests green.
- `[done]` Audit-preview alt-CTA — added founder-transparency line +
  "just reply to my email" path on the audit-preview CTA section
  (2026-05-07). Wave 2 lesson was 100% open / 0 reply, suggesting the
  audit-preview register-CTA is too high-commitment. New paragraph
  gives a one-line "tell me more / not for me" path. On-strategy for
  the Wave 4 audit-preview-CTA test. `client/src/pages/AuditPreview.jsx`.
- `[done]` All 12 outreach emails scheduled-send for Tue 2026-05-12
  10:00 AM ICT (2026-05-07 evening, via Chrome MCP UI). Three Wave 2
  follow-ups (Chakrabongse, Loftel 22, Old Capital) + four TH
  customer-dev (Pink Chili, House of Taste, Better Moon, Sweets
  Cottage) + five EN customer-dev (Vera Nidhra, White Ivory, Tingly
  Thai, May Kaidee, Aim House). Verified in Scheduled folder (12 of 12
  unique recipients). Sender: earth.reviewhub@gmail.com (brand). Ship
  fires at 10:00 AM Tue without further intervention.
- `[done]` Refill outreach pipeline — Wave 4 fully prepared (was
  `wait:user` for refill of `outreach-queue.md`). 12 prospects in
  `docs/wave-postmortems/wave-4-candidates.md` (10/12 emails surfaced,
  2 need browser-eyeball lookup); 12 fresh per-prospect drafts in
  `docs/wave-postmortems/wave-4-drafts.md`; Tuesday/Wednesday
  verification workflow in
  `docs/wave-postmortems/wave-4-verification-checklist.md`; +5-day
  follow-up template in `docs/wave-postmortems/wave-4-followup-template.md`;
  outcomes decision tree in
  `docs/wave-postmortems/wave-4-outcomes-tree.md`. Stale Wave 3
  section in `docs/outreach-queue.md` flagged with pointer to canonical
  Wave 4 docs.
- `[done]` Audit-views diagnostic CLI — `server/scripts/audit-views.js`.
  Read-only per-prospect view-count report (status / view count /
  hours-since-send / hours-since-last-view / audit URL). Optional
  substring filter. Run via `railway run` for prod data. Replaces
  manual dashboard navigation when checking 12 prospects.
- `[done]` Audit-preview CTA variant copy ready — 4 variants in
  `docs/audit-preview-cta-variants.md` with hypothesis per variant +
  recommended A/B pair (Permission-asking variant E vs control). ~30
  min code ship when triggered. Don't ship until Tuesday's data
  confirms Scenario A.
- `[wait:user]` **Wave 4 send (Tue 5/12 + Wed 5/13).** 12 candidates
  fully researched in `docs/wave-postmortems/wave-4-candidates.md` (10/12
  emails surfaced; #1 Methavalai blocked on TLS-cert mismatch, #10 IR-ON
  surfaced 2026-05-08 evening as `info@ir-onhotel.com`). 12 fresh
  per-prospect drafts written and saved to
  `docs/wave-postmortems/wave-4-drafts.md` (9 TH + 3 EN, with EN
  fallbacks where useful). Earth's remaining job per prospect (~3 min):
  open Maps, count owner-reply ratio (DISQUALIFY if ≥4/10), confirm `{N}`
  unanswered count, replace `{PAIN}` with one specific observation,
  generate audit URL via dashboard, replace `{AUDIT_URL}`, schedule send
  9-11am ICT Tue or Wed (split 6/6 to stay under Gmail's 10/day cap).
- `[done]` Volve Hotel ownership re-verified (was wrongly noted as
  Pitiphat Chongsomchit-owned in earlier wave-4-candidates.md;
  Pitiphat is the interior designer, owner is referenced in press as
  Thai "Khun Um"). Language call confirmed TH. Updated in drafts file.
- `[wait:signal]` Pricing-objection journal entries — `audit-outreach.md`
  has the format; agent fills in as replies come in. After 10 logged
  rejections, pattern dictates next move (price shift, tier change,
  pivot).
- `[wait:signal]` Audit which verticals from today's 9 sends actually
  reply / convert. Need 48-72h of signal first. After that: update
  `lead-finding.md` to upweight the responding verticals.
- `[done]` Lead-finding playbook updated. Both verticals shipped at
  `docs/skills/lead-finding.md` lines 141-147 (Small B&Bs with own
  websites; Vegetarian/pastry/specialty cooking schools).
- `[wait:user]` Decide tomorrow's outreach time-of-day. Email open
  rates are ~25% higher on Tue/Wed AM vs Mon AM (hospitality
  industry data). Agent can schedule reminders if you want a
  consistent send window. Default: send when the queue is full.
- `[done]` First-customer playbook shipped at
  `docs/skills/first-customer-playbook.md`. Covers Hour 0 ack, Hour
  4-24 setup walkthrough, billing-checkout response, mistake budget,
  and "what NOT to do under time pressure."
- `[done]` Wave 1 cooking-schools post-mortem (2026-05-07) at
  `docs/wave-postmortems/wave-1-cooking-schools.md`. Audience-fit
  failure (not deliverability). Four falsifiable hypotheses pre-
  registered for Wave 4.
- `[done]` Wave 2 post-mortem template (2026-05-07) at
  `docs/wave-postmortems/wave-2-bangkok-hospitality.md`.
  Scaffolded with predictions; fill in actuals after 2026-05-08
  reply window.
- `[done]` content-writing.md skill (2026-05-07) — meta-skill for
  customer-facing prose (blog/landing/changelog/free-tools); links
  out to per-format skills for emails/outreach/social/support.
  Shipped at `docs/skills/content-writing.md`.
- `[done]` X first-week post drafts (2026-05-07) — 14 drafts
  spanning post types A/B/C/D/E across 2 weeks at
  `docs/launch/x-first-week-posts.md`. Earth approves before
  posting; Post 1 (pinned intro) goes first.
- `[done]` browser-automation.md skill (2026-05-08) — Chrome MCP
  foot-gun catalogue. 8 verified workarounds (Trusted-Types,
  insertText newlines, file_upload "Not allowed", base64 chunking,
  OAuth consent gates, dynamic-state polling, stale refs, multi-
  tab targeting). Manual-vs-automation judgment table included.
- `[done]` TH/EN blog parity reached 7/7 (2026-05-08) — translated
  the remaining 4 EN posts (transfer, how-to-ask, how-to-remove,
  fake-extortion) to Thai. Each is full-post (not synopsis).
- `[done]` Internal linking pass (2026-05-08) — every blog post
  now ships with a "Related posts" section linking 2 most-related
  siblings. Idempotent script at `scripts/add-related-posts.js`.
- `[done]` Blog SEO validator + tracked pre-commit hook
  (2026-05-08) — `scripts/validate-blog-seo.js` checks 14 posts
  for required meta + schema + forbidden patterns.
  `scripts/hooks/pre-commit` runs it on any blog HTML change.
  `scripts/install-hooks.sh` for fresh clones.
- `[done]` 2 new EN blog posts (2026-05-08) —
  `bangkok-hospitality-review-mistakes` (Wave 3-targeted) and
  `google-review-reply-length` (counter-intuitive length-by-type
  table).
- `[done]` TH translations for both new EN posts (2026-05-08) —
  `bangkok-hospitality-review-mistakes-th` +
  `google-review-reply-length-th`. 16 blog posts total,
  EN/TH parity 7/7 + 2 Thai-only.
- `[done]` Stale-positioning fixes (2026-05-08) — Thai homepage
  hero CTA was "ติดตั้งส่วนขยาย Chrome" (Install Chrome extension)
  for weeks after the extension was dropped. Plus
  landing.step3P referenced "the extension posts." Both fixed.
  `scripts/check-stale-positioning.js` now wired into pre-commit
  to catch class regressions.
- `[done]` Blog index UX (2026-05-08) — language filter pills
  (All / EN / TH) with localStorage persistence. Default infers
  from UI language, but explicit user toggle sticks.
- `[done]` 4 more new EN posts (2026-05-08 evening) —
  `wongnai-vs-google-reviews-bangkok` (comparison post),
  `what-one-star-reviews-tell-you` (operations angle),
  `reply-to-old-google-reviews` (30-day rule), and
  `track-google-review-reply-rate` (the reply-rate metric).
- `[done]` 4 matching TH translations (2026-05-08 evening).
  Total: 24 blog posts, 12 EN + 12 TH parity.
- `[done]` Marketing footer expansion (2026-05-08) — 5 specific
  blog posts surfaced (was 2), each auto-routes to EN or TH based
  on UI language.
- `[done]` content-stats.js + npm run stats:content (2026-05-08).
  Reports total posts / EN-TH split / word count / posts-per-date.
- `[done]` prod-smoke.sh extended (2026-05-08) — 24 checks now
  (was 14): blog cluster spot-checks + RSS + og-image + tools
  index + free tools.

## CUSTOMER RELATIONS — replies, follow-ups, objection handling

What happens when one of the 9 cold sends responds. Pre-build now;
deploy on first reply.

- `[done]` Pre-write reply templates for the 5 most likely objections.
  Shipped to `docs/skills/audit-outreach.md` under "Reply playbook"
  section with EN + TH for each. Five objections covered: price,
  DIY, competitor, not-now, more-info.
- `[done]` Pre-write "interested" reply (warm-response template, EN+TH).
  Shipped to `audit-outreach.md` § Reply playbook #6. Uses
  `/register?from=audit&business=...` to trigger sessionStorage
  attribution + prefill. Sub-TODO: 60-second screencast still missing
  (noted in the playbook).
- `[wait:signal]` Follow-up template after a "yes": welcome email,
  setup walkthrough, expectation-setting on first-week experience.
  Wait until first paid signup so the language matches their actual
  signup path.
- `[wait:user]` Calendly / Cal.com booking link in the reply
  templates? Founder needs to set one up + decide the slot length
  (recommend 15 min for discovery, 30 min for setup). Send the link;
  agent backfills templates.

## CONTENT — onboarding emails, blog topics, lead magnets

Surfaced from the 2026-05-05 onboarding email audit
([docs/onboarding-email-audit.md](docs/onboarding-email-audit.md)) and
the SEO surface expansion. Smaller wins; ship in batches.

- `[done]` New TH blog post (2026-05-07) — "ตอบรีวิว Google
  ภาษาอังกฤษให้ดูเป็นมืออาชีพ" (`reply-english-reviews-thai-owners-th`).
  8-min read for Bangkok hospitality owners. Targets the Wave 3
  audience.
- `[done]` TH translation (2026-05-07) — `why-respond-to-google-reviews-th`.
  Foundational post translated. ~1100 Thai words. Bilingual schema.
- `[done]` SEO meta upgrade (2026-05-07) — PNG og:image + Twitter
  Card meta + BreadcrumbList JSON-LD across all 7 blog posts.
  Idempotent script at `scripts/add-breadcrumb-schema.js`.
- `[done]` Changelog refresh (2026-05-07) — 7 new EN+TH entries
  for May 6-7 ships (onboarding rewrites, audit-preview FAQ, 3
  new EN blog posts, OG meta upgrades).
- `[done]` Day 7 onboarding email — trimmed dense plan list,
  links to /pricing for full comparison.
- `[done]` Blog post: "How to transfer Google Business Profile
  ownership". Shipped at `client/public/blog/transfer-google-business-
  profile-ownership.html` (~2000 words, 8 min read). Wired into
  BlogIndex, sitemap, RSS feed. Day 1 onboarding email (EN/TH/ES/JA)
  updated to link our guide instead of Google search.
- `[done]` Day 3 onboarding email — pseudonymous attribution shipped.
  "A Sukhumvit-area café owner I work with (anonymized at her request)".
- `[done]` Day 14 onboarding email — added fifth bucket: "It worked,
  just unsubscribing from these emails (totally fine — reply 'stop')".
- `[wait:user]` 60-second screencast for the warm-response outreach
  reply (audit-outreach.md § Reply playbook #6). Outside-agent task —
  founder records "first signup → first reply approved → reply visible
  on Google" once and we host it.

## OPS / META — infrastructure, monitoring, internal docs

The boring-but-load-bearing work.

- `[wait:user]` Verify production `REPLY_TO_PLATFORMS` is unset (not
  `=` empty). 5-second task: SSH or check Railway/Fly env panel.
  Look for `[REPLY-POST] Auto-posting enabled for: google` in
  recent logs.
- `[wait:user]` Run `./scripts/prod-smoke.sh` against the live
  deploy. 10 seconds. Verifies all public surfaces respond 200.
- `[done]` Memory file refresh. Added two new memory files this session:
  `reference_claude_code_setup.md` (CLAUDE.md + slash commands +
  hooks + statusline locations) and `project_reviewhub_test_patterns.md`
  (server node:test patterns, client vitest patterns, gotchas
  including the Free-tier email_alerts_new=false foot-gun). MEMORY.md
  index updated.
- `[done]` This-week's-deploys auto-summary script. Shipped at
  `scripts/weekly-deploys.sh`. Groups commits by prefix (auth,
  dashboard, billing, etc.), separates customer-facing from internal
  (test/docs/infra/refactor), text or markdown output. Run as
  `bash scripts/weekly-deploys.sh [days] [--markdown]`. Use the
  markdown form to seed /changelog candidates each Sunday.
- `[done]` Pre-Sentry test. Added 2 cases to errorReporter.test.js:
  (a) when SENTRY_DSN is set, captureException posts a well-formed
  envelope (correct URL, auth header, NDJSON envelope body, event
  payload) — proves the forwarder works without waiting for a real
  prod error to appear in Sentry's Issues feed; (b) when DSN unset,
  no fetch call happens.

---

## How the queue evolves

When the agent ships an item, it:
1. Marks `[ ]` → `[done]`
2. Appends new items it noticed as side effects (e.g. shipping
   feature X exposed missing test Y → adds to CODE section)
3. Pulls the next `[ ]` from the highest-priority section it can
   find one in
4. Continues until you say stop or every section's first slot is
   `[wait:*]`

When you want to redirect mid-session, prepend a new item with `[ ]`
at the top of any section and tell the agent. Or just say "do X
next" — the agent will treat it as a queue insertion.

When the queue empties of `[ ]` items and only `[wait:*]` items
remain, the agent reports the wait state and stops, instead of
making up busy-work. That's the only legitimate stopping point in
autopilot mode.
