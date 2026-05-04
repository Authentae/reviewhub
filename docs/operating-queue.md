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

- `[wait:user]` Magic-link / Google sign-in — passwordless reduces
  signup friction for older / less-techy owners. Decision needed:
  Google OAuth only (we already have `business.manage` scope, easy
  add) vs email-OTP (works for non-Google users, more code) vs both.
  Pick one, agent ships.
- `[ ]` Scheduled reply send — let users queue replies for business
  hours instead of posting at 2am. Schema change (`reviews.scheduled_post_at`),
  cron-ish poller every 5 min, UI toggle in the reply editor. ~1 hour.
- `[wait:user]` Read-only role for accountants / agency staff — two
  valid architectures, pick one:
    A. Full team-membership: `business_collaborators` table, email-
       invite flow, accountant gets a real account joined to the
       business. ~4 hours. Cleaner long-term; pollutes every query
       that currently scopes by ownership.
    B. Share-token: owner generates a per-share link, recipient
       opens `/shared/<token>` to see a read-only dashboard mirror.
       No account needed for the accountant. ~2 hours. Simpler;
       can't enforce identity (anyone with the link can view).
  Pick A or B and the agent ships it.
- `[ ]` Year-in-review email + dashboard recap — count replies,
  average rating delta, top-mentioned staff, busiest review month.
  Triggered manually by founder for now; cron'd in December if
  we ship before EOY. Schema-free, all aggregations from existing
  reviews table.
- `[ ]` Bundle-size split for the dashboard — Settings.jsx is 107KB
  gzipped/25KB. Move infrequently-touched sub-components (webhook
  rotation, API key management, timezone picker) behind dynamic
  import so the first paint is faster.
- `[ ]` Component test for FilterPresets — I shipped without tests.
  localStorage mocking + apply/save/delete coverage.
- `[ ]` E2E test for vacation suppression — assert that posting a
  review during a vacation window does NOT fire the new-review
  email + LINE notification.
- `[ ]` Test for the audit-preview CTA → register → onboarding
  prefill flow — the wave-2 onboarding-attribution piece has no
  test, only the manual click-through.
- `[ ]` Smoke-test for the live posted-to-Google badge — when
  REPLY_TO_PLATFORMS includes google + provider returns ok,
  response_posted_at gets set; UI badge renders.
- `[wait:signal]` Native iOS / Android app — out of scope without
  weeks of investment + App Store review pipeline. Defer until a
  paying customer specifically asks.

## WEB — marketing, SEO, content, public surfaces

The reviewhub.review site itself + everything a prospect sees.

- `[ ]` Update `/changelog` with wave 1-4 ships from today. Right now
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

- `[ ]` Refill `outreach-queue.md` — currently has 3 verified
  prospects. Target: 7 more for tomorrow's batch. ~5 min per
  prospect via the workflow in that doc.
- `[wait:signal]` Pricing-objection journal entries — `audit-outreach.md`
  has the format; agent fills in as replies come in. After 10 logged
  rejections, pattern dictates next move (price shift, tier change,
  pivot).
- `[wait:signal]` Audit which verticals from today's 9 sends actually
  reply / convert. Need 48-72h of signal first. After that: update
  `lead-finding.md` to upweight the responding verticals.
- `[ ]` Lead-finding playbook update — add "small B&B with own website"
  + "vegetarian / pastry cooking school" to the high-yield verticals
  list (they performed well in source-availability today).
- `[wait:user]` Decide tomorrow's outreach time-of-day. Email open
  rates are ~25% higher on Tue/Wed AM vs Mon AM (hospitality
  industry data). Agent can schedule reminders if you want a
  consistent send window. Default: send when the queue is full.
- `[ ]` Set up a "first-customer playbook" — when someone replies
  YES, what's the first 24h? Welcome message, kickoff call template,
  setup walkthrough. Pre-written so the founder doesn't improvise
  under time pressure.

## CUSTOMER RELATIONS — replies, follow-ups, objection handling

What happens when one of the 9 cold sends responds. Pre-build now;
deploy on first reply.

- `[ ]` Pre-write reply templates for the 5 most likely objections:
  (1) "$14 too expensive," (2) "I'll do it manually," (3) "We
  already use [competitor]," (4) "Not interested right now," (5)
  "Send me more info / what's the catch?" Each gets a 3-4 sentence
  response in EN + TH that respects the objection without sounding
  defensive. Lives in `docs/skills/audit-outreach.md` under a new
  "Reply playbook" section.
- `[ ]` Pre-write "interested, want to see more" reply: links to a
  live demo dashboard, screen-recording, or 10-min Calendly link.
  We don't have any of those yet — also a TODO.
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
