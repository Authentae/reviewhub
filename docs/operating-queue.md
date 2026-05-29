# Operating queue — single source of truth for "what's next"

> **DECISION FRAME (2026-05-21):** the queue is the *menu*; the
> [decision framework](decision-framework.md) is the *filter*. North
> star at this stage is **Time To First Paying Customer (TTFPC)**.
> Every queue item passes through the promote/demote frame in
> CLAUDE.md before shipping. The framework defaults to *promote-list*
> work (Wave-N diagnostics, followups, audit-preview A/B, customer-dev)
> over *demote-list* work (new marketing surfaces, blog posts, visual
> polish, more infra-for-infra's-sake).
>
> **NEAR-TERM PRIORITY (2026-05-26, STRATEGIC PIVOT):**
> Demand validation found owners care ~25× more about GETTING reviews
> than REPLYING (880-comment vs 30-comment Reddit threads). ReviewHub
> led with the wrong feature. **Decision locked: reposition headline to
> "get more reviews," reply-drafting becomes the bonus.** The
> review-request feature that solves the bigger pain is already built
> to production quality (`server/src/routes/reviewRequests.js`).
> Full evidence + decision: `docs/strategy/demand-validation-2026-05-26.md`.
>
> **Wave 6 reply-first pitch is PARKED — do NOT send it.** 5 waves of
> reply-first cold email = 0 replies; sending a 6th of the same pitch
> is the wrong move. The 13 verified prospects + funnel diagnostic +
> verification-cluster check all carry forward; the *pitch* changes.
>
> **Next-session deliverables (Claude preps, Earth sends 5):**
> 1. "Get more reviews on autopilot" cold email
> 2. Get-reviews demo artifact (current /audit-preview shows reply
>    drafts — wrong for this pitch)
> 3. 5 fresh prospects (reuse verified Wave 6 list)
> If the get-reviews angle gets ANY reply where reply-first got 0 →
> pivot confirmed.

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

## TOP-OF-MIND for Earth on next desk session (added 2026-05-19 cycle 52)

Highest-priority unblocked items that need Earth's hands, not the
agent's. Surface here so the next desk session opens with a clear
list of "what only Earth can do right now."

- `[wait:user]` **Send the Lemon Squeezy reply** — application went
  out from `theearth1659@gmail.com`. Reply text is paste-ready in
  the 2026-05-19 chat history (and cycle 50 of
  `docs/overnight-log-2026-05-19.md` has the context). Three things
  to send: website URL + live demo (`/audit-demo`) + X profile. No
  LinkedIn per Earth's choice. **Action**: paste-and-send manually
  from theearth1659 Gmail; mark this `[done]` after.
- `[wait:user]` **Rotate JWT_SECRET** to 64 chars on Railway. The
  morning brief flagged the current value at the 32-char minimum
  threshold. 3 min in the Railway dashboard:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
  → Variables → save. You'll be logged out; log back in.
- `[wait:user]` **Upload founder photo** to replace the "E" initial
  circle on `/audit-preview`. Audit-preview is Wave-5-locked from
  the agent side, but the image asset swap is something Earth can
  do without touching the locked copy.
- `[wait:user]` **Review deferred-dependency upgrades** —
  `docs/deferred-dependency-upgrades.md` lists 2 breaking upgrades
  the autopilot punted: `@anthropic-ai/sdk` 0.79→0.96 (Memory Tool
  advisory we don't expose; breaking API) and `vite` 5→8
  (dev-server-only advisory; would re-open the CI peer-dep saga we
  just stabilised). Decide path; both have recommended next steps
  in that doc.
- `[wait:signal]` **Wave 5 conversion result** — first batch fired
  09:00 ICT 2026-05-19. By Sun 5/24 we'll know the audit-view rate,
  reply rate, and which vertical (Muay Thai / spa / dental / coffee)
  is most responsive. **No action until then** — let the signal
  arrive.

---

## CODE — app, server, tests

The app side. Roadmap.jsx is the public face; this is the working
list.

- `[done] 2026-05-16` Stripe Payment Links wired end-to-end. ReviewHub
  Stripe account created (Authentae org → ReviewHub account, KYC review
  in progress, payments accepted during review window). 3 products
  (Starter $14 / Pro $29 / Business $59) + 3 Payment Links live in
  `client/src/lib/checkout.js`. `/pricing` + `/audit-preview` CTAs
  route to Stripe; logged-in cancelled-sub users get a Resubscribe
  button. Pro+Business gated server-side (`coming_soon: true` in
  plans.js) + client-side (`getStripeCheckoutUrl` refuses gated
  plans). Server `/api/billing/checkout` returns 400 plan_coming_soon
  for them. JSON-LD schema filters coming-soon plans from Google
  rich results. Manual provisioning until webhook wired — Stripe
  emails Earth on each new sub.
- `[done] 2026-05-16` Post-Stripe-payment landing UX. Customers
  arriving at `/register?from=stripe&plan=X&checkout_success=1` now
  see a sage-tinted "Payment received — welcome to ReviewHub · <Plan>"
  banner + a 'One last step: create your account' H1 + 'use the same
  email you paid with' subhead, instead of the generic signup form.
  Stash sessionStorage attribution for downstream onboarding to
  detect already-paid users.
- `[done] 2026-05-16` Public-page honesty audit. Stripped fake
  testimonial quotes across 8 vertical pages (FTC endorsement risk);
  softened HIPAA-compliant claims to PHI-aware on /for-dentists +
  /for-pharmacies; split vertical platforms into Live (Google) +
  Coming soon (rest); Landing hero copy LINE-only → 'from your phone'
  with LINE+Telegram subhead; Landing hero metric '60+ platforms'
  → '3 channels'; Landing Pro+Business cards gated coming-soon to
  match /pricing; Audit FAQ honest about Places API vs BPA; ApiDocs
  coming-soon banner; Roadmap moved shipped items out of Considering.
- `[done] 2026-05-16` Banned-phrases lint + pre-commit hook. New
  `scripts/check-banned-phrases.sh` blocks commits that re-introduce
  'from LINE.', '60+ platforms', 'HIPAA-compliant', fabricated
  testimonial author strings, live CTAs for gated tiers, killed-trial
  wording. Banlist is the canonical 'what we cannot claim today'
  registry — update when features ship (remove) or get gated (add).
  Lint immediately caught 6 lies the per-page audit missed. New
  memory file `feedback_audit_visual_first.md` auto-loads next
  session telling future-Claude to render-first before code-audit.
- `[done] 2026-05-15` Telegram bot integration end-to-end. Webhook
  receiver (`server/src/routes/telegramWebhook.js`) handles
  `/start`, `/start <token>` (deep-link payload), `/link <token>`,
  `/unlink` commands. Link-token flow at `/api/telegram/{status,
  generate-token, unlink, test-push}`. Settings UI mirror of
  LineConnectSection with branded blue paper-plane logo + top-stripe
  + t.me deep-link + QR for cross-device. `placesPoller` pushes
  notifications via both LINE and Telegram when bound. Notification
  card sends as 2 messages: card + monospace draft block for one-tap
  mobile copy. Cross-channel parity with LINE rating-tier visual
  (red/yellow/green emoji badge).

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
- `[done] 2026-05-10` Admin gate fix — `server/src/routes/admin.js`
  was silently 404'ing every admin endpoint to every caller (including
  the legitimate admin) since the gate landed: JWT only carries
  `{id, iat, exp}`, so `req.user.email` was always `undefined` →
  empty string never matched `ADMIN_EMAIL`. Commit `8ce7e81` adds
  DB email lookup when `req.user.email` is missing. Memory file:
  `feedback_admin_gate_email_lookup.md`.
- `[done] 2026-05-10` Anthropic API key rotation. Old prod key was
  expired/revoked → all customer AI draft generation returned 401
  for unknown duration. New key set on Railway, verified end-to-end
  (`/api/public/review-reply-generator` returns `source:"ai"`).
  Runbook added to `docs/reviewhub-wiki.md` § "Third-party API key
  rotation runbook" so the next rotation is a 5-min checklist not
  a 30-min fire drill.
- `[done] 2026-05-10` CI green for the first time in 7+ days. Four
  commits: env vars in test.yml (`c37045f`); lockfile esbuild 0.28.0
  resolution (`c4723aa`); lockfile platform-binary optional flags
  (`6fb99ce`); i18n hard-fail → warn-only (`c7bee28`). Runbook in
  `reference_ci_debug_workflow.md` memory file.
- `[done] 2026-05-11` **Claude Design batch — 3 visual assets shipped to
  prod in one afternoon, 2 more generated and queued for port.** Audit-
  preview UX teardown identified 7 interventions; this batch closed 3 of
  them. Shipped:
  - **Interactive LINE Flex Card mockup** (`daa757a`) — embeds in
    `/audit-preview/<token>` below the CTA. 16.3KB lazy chunk. Closes
    teardown intervention #5 ("show, don't tell, the LINE flow").
  - **15-second 4-scene animated demo** (`d1ad3cd`) — at `/#demo` between
    Marquee and HowItWorks on landing. RAF loop respects prefers-reduced-
    motion. 22KB lazy chunk. Triple-use: landing + audit + X post #1.
  - **Founder About page** (`1908e1a`) — at `/about`. Personal letter,
    portrait placeholder (teal-circle "E" — swap to real photo by
    uploading `client/public/founder.jpg` and changing
    `PortraitPlaceholder` to `<img>`). Closes teardown interventions #2
    (honest pre-revenue framing) + #4 (founder voice forward). Linked
    from audit-preview footer.
  - Generated, **port deferred**: ReviewHub Founder Daily Brief
    dashboard (port tomorrow with Wave 4 live data).
- `[done] 2026-05-13` **One-Star Playbook turned into a measurable funnel
  in one autopilot session** (commits b686a26 → 0aac501). What shipped:
  - `b686a26` — Port from Claude Design handoff bundle. Decision tree at
    `/tools/one-star-playbook` with Thai+EN reply templates for 4
    scenarios (legitimate-specific, pattern, competitor/serial,
    extortion). Inline state machine, no backend.
  - `145e6a3` — Discoverability: /tools index, MarketingFooter, sitemap.
  - `a8a0712` — Idempotent script `scripts/add-playbook-callout.js` +
    callouts injected into 6 1-star-relevant blog posts (fake-extortion,
    what-one-star-reviews-tell-you, bangkok-hospitality-mistakes ×
    EN/TH). Drives existing blog traffic into the playbook.
  - `dd524f4` — Inline "Want this drafted?" CTA inside each result card
    + `PlaybookResultCtaClick` Plausible events (per-scenario attribution
    via from=one-star-playbook-{badgeClass}).
  - `38141ee` — HowTo JSON-LD schema (4 steps, en+th) for SERP rich
    results eligibility.
  - `9cbd6d9` — /tools index fixes: stale "Three" → "Four" count in H1
    + meta description; per-tool Plausible click events.
  - `8f53ba5` — `?from=` source attribution wired end-to-end on /audit.
    AuditLanding reads URL param on mount, sends `source` to server.
    Server header-strips + 80-char cap, surfaces in lead-notification
    email body ("Source: one-star-playbook") + console.log. Two
    regression tests added.
  - `0aac501` — prod-smoke.sh includes the new page (25 checks total).
- `[done] 2026-05-14` **CTA variant E (permission-asking) shipped as
  A/B vs control on /audit-preview** (`29b9780`). Deterministic
  per-token 50/50 split — each prospect always sees the same variant.
  Distinct Plausible events (`AuditRegisterClick` vs
  `AuditRegisterClick_PermissionV`) read the A/B without a DB change.
  StickyConversionBar matches the same variant assignment. Read-out
  playbook: `docs/wave-postmortems/audit-preview-cta-ab-readout.md`.
  Minimum N to read: 20 audits sent (Wave 5 brings cohort past that
  by ~5/24).
- `[done] 2026-05-13` **H1 (deliverability) falsified for the
  0-reply problem.** Mail-tester probe with real Wave-4-shaped TH
  body from earth.reviewhub@gmail.com scored 8.2/10. SPF+DKIM+DMARC
  all pass, on mailspike.net whitelist, zero blacklist hits. The 1.8
  points lost are a non-actionable `HTML_MESSAGE -1.999` SpamAssassin
  flag every Gmail send incurs. Full doc:
  `docs/wave-postmortems/2026-05-13-deliverability-confirmed.md`.
  This collapses the Wave 4 decision tree — when the reply window
  closes Sat 5/16, the only legitimate inferences are about
  pitch/audience/offer, not infrastructure.
- `[done] 2026-05-13` Autopilot ScheduleWakeup-style cron registered
  (every 30 min at :17/:47) for queue-driven /ship ticks. Session-only
  (auto-expires after 7 days). Next high-leverage non-playbook surface:
  conversion-rate work on the audit-preview page once Wave 4 reply data
  lands (likely 5/15-5/16).
  - Workflow notes for future sessions in
    `reference_claude_design_workflow.md` memory file.

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
- `[done] 2026-05-10` **Wave 4 send scheduled and verified in
  Gmail.** 7 of 12 prospects qualified (others DQ'd: Methavalai
  site offline, Baan 2459 / Bangkok Voyage / Baan Vajra <200
  reviews, IR-ON 88% reply rate). All 7 fired via Gmail Schedule
  Send through Chrome MCP: Tue 5/12 9:35-9:50 (Lilit, Raweekanlaya,
  Lamphu Tree, Lamphu House) + Wed 5/13 9:30-9:40 (Nouvo, Public
  House, Volve). Each filled draft in
  `docs/wave-postmortems/wave-4-drafts-FILLED.md` with real audit
  URL + per-prospect {PAIN} observation from Google reviews.
- `[done] 2026-05-10` Wave 1+2 combined diagnostic post-mortem at
  `docs/wave-postmortems/wave-1-2-3-combined-diagnostic.md`. First
  reliable view-count data ever (admin gate fix unblocked the
  diagnostic API). Headline: 12 cold sends → 4 opened (33%) → 0
  replied. Hospitality 200+ vertical opens 100% (3/3) vs cooking
  schools/B&Bs 11% (1/9) — audience-fit confirmed for Wave 4.
  Conversion bottleneck is the audit-preview page, not deliverability
  or list quality. Chakrabongse (14 views, no reply) is highest-info
  prospect; Tue 5/12 follow-up is single highest-leverage email in
  the queue.
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

- `[ ]` **a11y violations found by new audit** (2026-05-21): 5 serious +
  2 moderate across landing/pricing/audit-demo/for-spas.
  - color-contrast: 7+32+10+10 = 59 nodes failing WCAG AA across the
    four pages. Suspect token combos involving `--rh-paper`/`--rh-ink`
    at small font sizes, or muted gray text on warm-paper background.
    Run `npm run check:a11y -- --only=landing` and inspect the JSON
    report for the specific selectors.
  - aria-prohibited-attr on audit-demo: 1 element using an aria-
    attribute that doesn't apply to its role. Easy fix.
- `[ ]` **Lighthouse best-practices = 73 on prod** (below threshold 85).
  Real signal from `npm run check:lighthouse -- --only=landing,pricing,audit-demo`.
  Likely CSP / cookie / mixed-content / deprecated API. Read the JSON
  report at `tmp/lighthouse/landing.json` → `categories.best-practices.auditRefs`
  to find which specific audits are red.
- `[done]` Compounding-infra research doc — see
  `docs/compounding-infra-research.md`. Surveyed every category of
  infra ReviewHub could use (testing, SEO, observability, dev health,
  customer, content production). Tier 1 (4 of 6 items) shipped this
  session. Tier 2-6 remain documented for future.
- `[done]` Visual regression harness — `npm run check:visual:baseline`
  to freeze, `npm run check:visual` to diff. Covers 20 surfaces inc.
  dark mode + Thai locale. Tested 5/5 surfaces 0.000% diff against prod.
- `[done]` Lighthouse CI runner — `npm run check:lighthouse`. 16
  surfaces × mobile by default. Outputs `tmp/lighthouse/summary.{csv,md}`.
- `[done]` Broken-link crawler — `npm run check:links`. Walks sitemap
  (55 URLs), probes 55 unique internal links. Tested clean.
- `[done]` Accessibility audit — `npm run check:a11y`. axe-core via
  Puppeteer across 16 surfaces. Fails on serious+ by default.
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
