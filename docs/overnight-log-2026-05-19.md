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

