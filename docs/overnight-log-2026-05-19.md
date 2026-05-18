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

