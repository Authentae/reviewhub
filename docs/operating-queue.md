# Operating queue — single source of truth for "what's next"

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
- `[ ]` Bundle-size split for the dashboard — Settings.jsx is 107KB
  raw / 25KB gzip. Move infrequently-touched sub-components (webhook
  rotation, API key management, timezone picker) behind dynamic
  import so the first paint is faster.
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
- `[ ]` Open Graph image for `/audit-preview/<token>` URLs — right now
  when a prospect pastes the URL in iMessage/LINE/Discord, the
  preview card is empty. Static OG image (we ship one for the rest
  of the site) + per-audit dynamic title ("AI reply drafts for
  {business_name}") would make the cold-DM link feel real.
- `[ ]` Blog post: "Why your Google reviews need owner replies (and
  what to say to a 1-star)" — long-tail search target for small
  business owners. ~600-800 words, Thai + English. Includes 3
  copy-pasteable reply templates.
- `[ ]` Blog post: "How to respond to fake/extortion reviews on
  Google" — high-intent search; we already have prompt-rule
  coverage for this in aiDrafts. Make the page that shows up
  when an owner panic-Googles it.
- `[ ]` Landing page hero — does it speak to the audit-first
  prospect (someone who arrived via a /audit-preview/<token> CTA
  and clicked "set this up for me")? Test once we have a clicked-
  through prospect. Right now the hero assumes the visitor is
  generic-curious.
- `[ ]` `/changelog` localization audit — same gap as the rest of
  the i18n work. Likely English-only.
- `[ ]` Refresh sitemap.xml to include /status, /roadmap if they're
  not already. Quick check + add.

## BUSINESS — sales, pricing, ops, lead-gen volume

Outbound work + business mechanics. Lower-frequency but higher-
leverage when triggered.

- `[wait:user]` Refill `outreach-queue.md` — has 3 verified prospects
  + 6 research targets. Refill needs live-website email verification
  (workflow step 2 in that doc explicitly forbids scraped/stale
  addresses). Founder needs to spend ~30 min Monday morning verifying.
  Agent already mined the verticals; verticals-to-mine list is solid.
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

## OPS / META — infrastructure, monitoring, internal docs

The boring-but-load-bearing work.

- `[wait:user]` Verify production `REPLY_TO_PLATFORMS` is unset (not
  `=` empty). 5-second task: SSH or check Railway/Fly env panel.
  Look for `[REPLY-POST] Auto-posting enabled for: google` in
  recent logs.
- `[wait:user]` Run `./scripts/prod-smoke.sh` against the live
  deploy. 10 seconds. Verifies all public surfaces respond 200.
- `[ ]` Memory file refresh — append today's lessons to
  `~/.claude/projects/.../MEMORY.md`: queue-driven autopilot
  pattern, demand-gen wave shipping, the "which prospects are good"
  data once we have it.
- `[ ]` Add a "this week's deploys" auto-summary that the founder
  can read on Sunday — diff today's main vs 7-days-ago main, group
  commits by domain, highlight any behavior changes.
- `[ ]` Pre-Sentry test: trigger a controlled error in dev to confirm
  the Sentry forwarder is actually receiving (not just configured).

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
