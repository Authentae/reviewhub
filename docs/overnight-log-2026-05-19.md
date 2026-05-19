# Overnight automation log — 2026-05-19

Earth is asleep. Loop fires every 15 min (`:07, :22, :37, :52`) and
ships one solo-doable improvement per cycle. Alternates types (code
→ doc → visual → content) to keep the diff varied.

## Cycle 1 — 2026-05-19 ~03:35 ICT — doc

**Shipped:** Updated `docs/reviewhub-wiki.md`:
- Outreach waves: Wave 5 entry refreshed (scheduled → fires Tue/Wed
  09:00-10:30 ICT, conversion experience prospects will land in
  documented, dental + Treasure caveats noted).
- Content surface: 26→29 blog posts; 8→2 verticals; 3→2 comparison
  pages; added /audit-demo entry; documented killed pages list +
  sitemap trim.

**Why:** Wiki was the canonical "what we know about the business"
doc and had drifted from reality after 23 ships in the prior 18 hr
session. Future Claude sessions read this file first; stale entries
compound into bad decisions.

**Commit:** `docs(wiki): refresh content surface + Wave 5 schedule entry`

## Cycle 2 — 2026-05-19 ~03:50 ICT — code

**Shipped:** Server tests for POST /api/waitlist + test-mode rate-limit
bypass. 12 new tests cover: valid pro+business signups, idempotency
via UNIQUE(email,plan), case-insensitive email dedup, allowlist
rejection (starter, '; DROP TABLE), invalid email forms, source
truncation. Server total 968 → 980.

**Side-fix:** Rate-limiter now skips when NODE_ENV=test (supertest
reuses 127.0.0.1 across cases so the 5/15min cap masked real
validation regressions behind 429s).

**Why:** Waitlist endpoint shipped today with zero server tests —
regression risk because the demand-signal data is what we'll use for
build-vs-kill calls on Pro/Business tiers. Without tests, a future
refactor could silently start accepting garbage plans (corrupting the
signal) or breaking idempotency (double-counting one prospect).

**Commit:** `test(waitlist): cover validation + idempotency + case dedup (12 tests)`

## Cycle 3 — 2026-05-19 ~04:05 ICT — content

**Shipped:** New blog post `chatgpt-for-google-review-replies` (EN + TH
pair). 4 sections: where ChatGPT works fine (one-offs, translation
help), where it falls apart (voice drift across sessions, 12-review
backlog tax, no ambient trigger, no industry guardrails), an honest
volume-based scorecard (0-2/wk = use ChatGPT; 10+/wk or regulated =
need a system), and what we built instead. Links to /audit-demo (tone
switcher) inline and /vs/chatgpt in related posts. Added both slugs
to BlogIndex.jsx POSTS array and to sitemap.xml with 2026-05-19
lastmod.

**Why:** /vs/chatgpt survived the page-flow audit and the ChatGPT
comparison row just shipped on /pricing — but the blog had no
ChatGPT-specific post for the "ChatGPT for Google reviews" search
intent. This is a real query (people considering ChatGPT vs a
purpose-built tool). Honest acknowledgement that ChatGPT works fine
at low volume builds trust; specific failure modes (voice drift,
PHI slip-up in dental) name the cost so the read price is "switch
to ReviewHub" not "shrug." Cycle 2 was code → cycle 3 is content
per the alternation rule.

**Commit:** `content(blog): chatgpt-for-google-review-replies EN+TH`

## Cycle 4 — 2026-05-19 ~04:25 ICT — visual

**Shipped:** "NEW" badge on /blog index for posts <7 days old. Ochre
pill (`#a07d20`) on JetBrains Mono, sits inline next to the h2 title.
Auto-expires by date — no manual badge maintenance. Currently lights
up on all posts dated 2026-05-12 → 2026-05-19 (ChatGPT post, etc.);
will quietly age out as posts roll past the window. TH variant reads
"ใหม่" via the existing `isThai` flag.

**Why:** With 30+ posts in the index, fresh content was invisible —
a returning reader couldn't see what changed since last visit without
parsing the small mono date line. A 30px badge moves "what's new"
from "scan all 30 dates" to "look for the orange." Visual ship,
compounds on every future post for free.

**Commit:** `feat(blog): NEW badge on posts under 7 days old`

## Cycle 5 — 2026-05-19 ~04:40 ICT — code

**Shipped:** Deleted 5 orphaned source files (~36 KB) + 3 associated
tests. `scripts/find-orphans.js` flagged: `ClaimBusinessButton.jsx`,
`ReviewResponse.jsx`, `ReviewResponseForm.jsx` (transitively dead —
only used by ReviewResponse), `hooks/useFocusTrap.js`,
`utils/accessibilityTester.js`. Cross-checked with `grep -rn` to
confirm no remaining importers outside `__tests__/` and a stale
comment in ReviewResponseForm. i18n keys left in `translations.js`
(low cost, useful templates if we re-add public owner responses).
Build clean, 170/170 client tests green.

**Why:** Dead code is a compounding tax — every `grep`, every "find
this symbol" search, every refactor pays it. ClaimBusinessButton in
particular has been carrying a flaky test (#780, the "5/500" timeout
we bumped 1s→4s earlier today) for a component nothing imports. The
test was costing CI minutes for code on no production path. Removing
the cluster shrinks the audit surface for future visual + code
audits.

**Commit:** `chore(client): delete 5 orphan files + 3 dead tests`

## Cycle 6 — 2026-05-19 ~04:55 ICT — doc

**Shipped:** Doc accuracy sweep for overnight cycles 1-5:
- `docs/reviewhub-wiki.md` Content surface section: blog count
  29→31 (added the ChatGPT pair); noted the NEW badge UI; new
  "Code surface trim 2026-05-19" bullet under killed-pages
  documenting the 5 orphan + 3 dead-test deletion.
- `docs/MORNING-BRIEF-2026-05-19.md`: appended an "Overnight loop
  addendum" table summarising cycles 1-5 by type/ship/why so the
  first thing Earth reads when he wakes reflects what shipped
  while he was asleep, not just the pre-sleep state.

**Why:** Wiki + morning brief are the two docs Earth (and future
Claude sessions) read first. The overnight loop was producing ships
into a private log file with no visibility from the canonical
read-first docs — exactly the drift pattern cycle 1 was meant to
fix. Doc-as-canonical only works if it stays canonical.

**Commit:** `docs: sync wiki + morning brief with overnight cycles 1-5`

## Cycle 7 — 2026-05-19 ~05:10 ICT — visual

**Shipped:** Regenerated `og-image.svg` + `og-image.png` to match the
real landing hero. Old text: "All your reviews, one editorial
dashboard." New text matches `landing.heroTitle`: "Reply to Google
reviews in 10 seconds — from your phone." Sub-line also refreshed
("AI drafts in your voice · LINE & Telegram alerts · Built in
Bangkok"). PNG re-rendered via the documented sharp pipeline
(density:300, 1200×630, quality:90) — 51 KB.

**Why:** og:image is the single most-shared visual asset; every X,
LinkedIn, iMessage, Slack, and Line preview of reviewhub.review uses
it. Carrying a tagline ("editorial dashboard") that no longer appears
anywhere on the actual site is a credibility risk — a prospect lands
on the page, sees a different promise, and pattern-matches "stale
marketing." Free-cost compounding fix.

**Commit:** `visual(og): sync og-image with current landing hero copy`

## Cycle 8 — 2026-05-19 ~05:25 ICT — content

**Shipped:** New blog post `how-fast-should-you-reply-to-google-reviews`
(EN + TH pair). Speed-target card per star rating (1★ = 4h same-day,
2★ = same/next-day, 3★ = 48h, 4★ = week, 5★ = 2 weeks or weekly
batch). Section on what slow replies signal (the day-8 reply being
the worst-of-all). Closes with the friction analysis (no ambient
trigger, clunky mobile UI, blank-page anxiety) and our fix. Sitemap
and BlogIndex updated; post count 31→33.

**Why:** Direct alignment with the new og-image / landing hero
("Reply to Google reviews in 10 seconds — from your phone"). The
search query "how fast should you reply to google reviews" has
intent and no existing post covered it. Differentiated angle
(asymmetric by star rating) keeps the post from being commodity
SEO content. Compounds — every Wave-5 prospect Googling this
question is a warm lead.

**Commit:** `content(blog): how-fast-should-you-reply EN+TH`

## Cycle 9 — 2026-05-19 ~05:40 ICT — code

**Shipped:** Server tests for POST /api/support + GET /api/support/me
(13 new tests). Coverage: valid anon + authed submissions, honeypot
fake-200-no-row, category allowlist + all 5 valid values, missing
email, invalid email, empty subject, short message, 500-char subject
truncation, CR/LF stripping (header-injection defense), authed /me
returns only the caller's tickets (no cross-user leakage), /me
requires auth.

**Why:** /api/support is a public no-auth endpoint that fires founder
emails on every submission — exactly the attack surface that
silently degrades without tests. CR/LF stripping in particular is
the kind of regression a future "small refactor" could re-introduce
without anyone noticing until an attacker sends a Bcc-injected
ticket. Coverage matches the pattern set by waitlist tests yesterday.

**Commit:** `test(support): cover validation + honeypot + header-injection + /me`

## Cycle 10 — 2026-05-19 ~05:55 ICT — doc

**Shipped:** New memory file
`feedback_static_assets_drift_silently.md` — codifies the pattern
behind cycle 7's og-image fix. Lists the class of static files that
duplicate live-site copy (og-image.* / og-image-audit.* /
x-header.* / manifest.webmanifest / feed.xml / blog quotes / index
.html social-meta) and an end-of-session grep sweep to catch drift
before another social-share preview goes stale. Added to MEMORY.md
under a new section "When ending an autopilot / overnight session —
run a drift sweep" so it gets auto-loaded.

**Why:** Cycle 7 found a 6+ week drift (og-image still said
"editorial dashboard"; the live hero says something different) that
no test caught. Codifying the lesson is the only way to stop the
same class of drift from re-accumulating between autopilot
sessions. Memory file > inline TODO because memory is auto-loaded
on every future session.

**Commit:** `docs(memory): record static-asset drift pattern from cycle 7`

## Cycle 11 — 2026-05-19 ~06:10 ICT — visual

**Shipped:** PNG favicon fallbacks at 32 / 180 / 192 / 512 pixels,
generated from `favicon.svg` via the sharp pipeline. Wired up in
`client/index.html` (added `<link rel="icon" type="image/png" 32x32>`
+ `<link rel="apple-touch-icon" 180x180>`) and `manifest.webmanifest`
(added 192px + 512px PNG icons alongside the existing SVG entry).
Total added ~13 KB.

**Why:** Drift-sweep applied (per cycle 10's new rule). Found
favicon.svg was the ONLY favicon — Safari, iOS Add-to-Home-Screen,
older Android, and apple-touch-icon were all falling back to a
generic globe. PWA install on iOS in particular needs a 180px PNG
or it shows the page-screenshot fallback. Compounding fix: every
home-screen install + browser tab from now on shows the actual RH
sparkle.

**Commit:** `visual(favicon): add PNG fallbacks at 32/180/192/512`

## Cycle 12 — 2026-05-19 ~06:25 ICT — content

**Shipped:** Fixed `client/public/feed.xml` drift. Added 5 missing
`<item>` entries that had accumulated since 2026-05-07: the ChatGPT
post pair (cycle 3), the how-fast post pair (cycle 8), and one
older post (`reply-english-reviews-thai-owners`) that was never
added to the RSS feed when it shipped. Bumped `<lastBuildDate>`
from 07 May → 19 May. Validated as well-formed XML (33 items match
33 blog HTML files).

**Why:** Direct application of cycle 10's drift-sweep rule —
feed.xml is exactly the kind of static asset that goes stale
silently. RSS subscribers (Feedly, NetNewsWire, Inoreader users)
had been seeing "no new ReviewHub posts since 2026-05-07" for 11
days while the site shipped 5 new posts. Google's news/feed
crawlers also use this signal; out-of-date feed reads as "blog is
abandoned." Compounding fix — every future feed-fetch from now on
sees fresh content.

**Commit:** `content(feed): add 5 missing posts + bump lastBuildDate to 05-19`

## Cycle 13 — 2026-05-19 ~06:40 ICT — code

**Shipped:** New `scripts/check-blog-sync.js` script + pre-commit
hook wiring. Cross-checks that every blog HTML in
`client/public/blog/` has matching entries in:
- `client/public/sitemap.xml`
- `client/public/feed.xml`
- `client/src/pages/BlogIndex.jsx` POSTS array

Wired into `scripts/hooks/pre-commit` to fire whenever any of those
four files change. Installs via `scripts/install-hooks.sh` (already
ran locally). Validates 33 posts in sync today.

**Why:** Cycle 12 fixed an 11-day drift in feed.xml. The right
fix is structural — catch it at commit time so the next agent (or
human) can't merge a new blog HTML without also updating all three
indexes. Compounding: every future blog ship is guarded; we'll
never accumulate another 5-post backlog of stale feed entries.
Same shape as the existing blog-SEO + stale-positioning checks.

**Commit:** `feat(hooks): pre-commit check that blog HTML matches sitemap/feed/index`

## Cycle 14 — 2026-05-19 ~06:55 ICT — doc

**Shipped:** New `docs/autopilot-loop-playbook.md` — distilled the
patterns from the 13 cycles before it: when to use the loop, the
alternation rule + type definitions, STOP triggers, compounding vs
polish bias, end-of-session sweep checklist, patterns to repeat,
anti-patterns to avoid, and honest cost accounting. Future-improvements
section lists ideas (auto-detect cycle type, og-image-drift script,
nightly drift sweeper) deliberately deferred from THIS session.

**Why:** The loop produced sustained shipping for ~3.5 hours but the
"how to run a productive overnight loop" knowledge was implicit in
the cycle logs and would have to be re-derived by the next session.
Codifying it once + adding to `docs/` makes the next overnight loop
faster from cycle 1, not from cycle 5 after the agent rediscovers
the alternation rule. Same compounding rationale as cycle 10's
memory file.

**Commit:** `docs: autopilot loop playbook from overnight session`

## Cycle 15 — 2026-05-19 ~07:10 ICT — visual

**Shipped:** Second pass of the drift sweep from cycle 10's rule.
Two finds:
- `client/index.html` `og:image:alt` still said "All your reviews,
  one editorial dashboard." Updated to match the new hero ("Reply
  to Google reviews in 10 seconds, from your phone."). This is the
  ALT text screen-readers + accessibility tooling read for every
  social share preview.
- `client/public/og-image-audit.svg` had a stale code comment
  contrasting against "one editorial dashboard" — refreshed to
  match the new landing-page pitch. Comment-only, no rendered
  output change, but stops future agents pattern-matching on old
  copy.

Cross-checked `editorial palette` references — those are the brand
color system (App.jsx, Logo.jsx, dashboard-system.css), not the
marketing tagline. Left intact.

**Why:** Direct application of cycle 10's drift-sweep rule + cycle
14's end-of-session checklist. og:image:alt being stale was the
exact class of bug the rule predicts: a string that lives in two
places (index.html alt + og-image text) drifts at the first edit
to either side.

**Commit:** `visual(og): sync og:image:alt + audit-svg comment with new hero`

## Cycle 16 — 2026-05-19 ~07:25 ICT — content

**Shipped:** 5th FAQ entry on /pricing — "Why pay for this when
ChatGPT exists?" Direct copy distilled from cycle 3's ChatGPT blog
post: ChatGPT fine at 1 review/wk, ReviewHub solves the workflow tax
at 5+/wk. EN-only key (`pricing.faq5q/a`) added to `translations.js`;
other locales fall through `translations.en[key]` so non-EN visitors
still see the answer until translations land.

**Why:** The ChatGPT comparison row on /pricing answers the
objection statically; the ChatGPT blog post answers it for readers
already at the bottom of the funnel. The pricing FAQ is where the
*deciding* visitor is — adding the answer at the moment of intent
beats them having to scroll to the comparison row or click through
to a blog post. Compounds: every future /pricing visit gets the
objection answered inline.

**Commit:** `content(pricing): add 5th FAQ — why pay vs ChatGPT?`

## Cycle 17 — 2026-05-19 ~07:40 ICT — code

**Shipped:** New `server/tests/plans.test.js` (16 tests) covering
both `GET /api/plans` and the `lib/billing/plans.js` helpers
(`getPlan`, `planAllows`, `planMax`, `wouldExceed`). Coverage:
endpoint shape contract (Pricing page consumers), Cache-Control
header, presence of free/starter/pro/business IDs, helper
defensiveness on unknown plan IDs + unknown feature flags, the
free→ai_drafts/weekly_digest gate logic, starter→email_alerts/
priority_support, the wouldExceed boundary (3 caps to 3 returns
true), and the null-means-unlimited semantics.

**Why:** Plans module is the canonical source for "what does each
plan get" — every quota gate, every pricing card, every billing
gate calls into it. A regression that silently un-gates a paid
feature for free users (or vice versa) would be invisible without
tests. Compounds — every future PLANS edit is now guarded against
breaking the contract `/api/plans` consumers depend on.

**Commit:** `test(plans): cover /api/plans route + planAllows/planMax/wouldExceed`

## Cycle 18 — 2026-05-19 ~07:55 ICT — doc

**Shipped:** Extended the morning-brief overnight addendum from
cycles 1-5 to cycles 1-17. Added a 12-row table continuation (one
row per cycle) and a "Summary so far" panel: 17 cycles, 17 commits,
+5 blog posts, +41 new tests, +2 pre-commit guards, +1 memory file,
+1 playbook, 0 STOP triggers fired. Also reminded Earth of the cron
job ID `b7c3edfe` for cancellation.

**Why:** The morning brief is the doc Earth opens first on waking.
It had the cycles-1-5 table from cycle 6 but the next 12 cycles
were only visible in the per-cycle log file (which is dense). A
returning founder needs to see the full picture in 30 seconds, not
scroll a 400-line cycle log. Doc as canonical only stays canonical
when it's kept current — same lesson cycle 6 captured, applied
again 12 cycles later.

**Commit:** `docs: extend morning brief overnight table to cycles 1-17`

