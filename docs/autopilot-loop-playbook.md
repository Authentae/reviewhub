# Autopilot loop playbook

Distilled from the 2026-05-19 overnight session (14 cycles, ~3.5 hours,
~14 commits, alternating doc → code → content → visual). Captures what
worked, what's worth repeating, what to avoid next time.

## When to use the loop

The 15-min cron loop is right when **all four** of these hold:

- Earth is unavailable (asleep / AFK / "do whatever") and trusts the agent
- The pre-revenue queue has no urgent ship-the-customer-deal item
- There's a meaningful backlog of solo-doable improvements
- Production isn't broken (CI green, last deploy healthy)

If any of those fails, fix that first. Don't autopilot through a CI red
or a customer waiting on a reply.

## The alternation rule

**Each cycle picks a different type than the previous one:**

`code → doc → visual → content → code → doc → ...`

Why the rule matters: without it, the agent gravitates to the
type it's currently good at (usually code) and ships 5 small refactors
while the og-image rots and the blog gets no new posts. The
alternation forces breadth across the surfaces a pre-revenue SaaS
actually needs.

### Type definitions for ReviewHub

| Type | Examples |
|------|----------|
| **code** | Test coverage gaps · dead-code deletion · refactor · new pre-commit guard · bug fix · server route hardening |
| **doc** | Wiki accuracy sweep · memory file (`~/.claude/.../memory/`) · CLAUDE.md update · morning brief addendum · operating-queue prune |
| **visual** | OG image · favicon variants · CSS polish on existing surface · new UI affordance (badge, toast, illustration) · static asset regen |
| **content** | New blog post (EN+TH pair) · feed.xml drift fix · sitemap addition · landing-page copy tune · email-template body |

## Triggers to STOP the loop (write to log, don't ship)

1. **CI goes red** on a push. Don't ship cycle N+1 on top of a broken
   build. Investigate or roll back.
2. **Deploy fails twice in a row** (Railway healthcheck FAILED). Same
   reason — production health beats velocity.
3. **An ambiguous decision** that needs Earth's call. Don't guess on:
   - new pricing tiers
   - new outreach segments
   - destructive DB changes
   - anything touching the audit-preview copy during a Wave window
4. **Locked surfaces.** Wave 5 locks audit-preview copy; Gmail / billing
   / JWT_SECRET / DB migrations are off-limits regardless.

When stopping, write a one-paragraph blocker note to
`docs/overnight-log-YYYY-MM-DD.md` so the next session can pick up.

## Compounding vs polish — bias toward compounding

The single biggest difference between a productive autopilot loop and
busywork: pick ships that **make the next ship cheaper** (compounding)
over ships that polish a surface once and stop (polish).

### Compounding ships (prefer these)

- **Pre-commit hooks** — every future commit is guarded for free.
  Example: cycle 13's `check-blog-sync.js` will catch every
  future blog-index drift.
- **Memory files in `~/.claude/projects/.../memory/`** — every
  future session auto-loads them.
- **Templates / generators** — write once, render many.
- **Drift sweepers** — find a class of bug, fix all instances,
  prevent recurrence (cycles 7+10+13).
- **Doc consolidation** — wiki updates, MEMORY.md index pruning,
  CLAUDE.md additions. Future sessions pay less in re-discovery cost.

### Polish ships (only when the queue of compounding is empty)

- Single CSS tweak on one surface
- Hand-written one-off content
- Renaming variables
- Minor visual touches

Both have a place. The autopilot just needs the bias to be _compounding_,
not equal weight.

## End-of-session sweep

Before declaring the loop done (or before the user wakes up):

1. **Drift sweep** — see
   `memory/feedback_static_assets_drift_silently.md`. grep the
   live hero copy fragments across `client/public/` to catch
   static assets that need regen.
2. **`scripts/check-blog-sync.js`** — confirms blog HTML / sitemap /
   feed / BlogIndex are in agreement (now enforced by pre-commit,
   but worth running manually if you've been editing the indexes).
3. **`scripts/find-orphans.js`** — surface dead source files; delete
   if no production importer (cycle 5).
4. **Morning brief addendum** — append a table summarising the
   overnight cycles to the day's morning brief so Earth's
   read-first doc reflects what actually shipped.

## Patterns to repeat

- **Two-line commit messages** ending each cycle. Headline + one
  sentence on why. Easy to skim a `git log` and see the loop's shape.
- **One commit per cycle.** Don't bundle. Each commit answers "what
  ship and which type?"
- **Log every cycle to `overnight-log-YYYY-MM-DD.md`** with: what
  shipped, why, commit hash/message. Three short paragraphs.
  Reading the log = recovering the agent's reasoning.
- **Type-tag the cycle** in the log heading (`— code`, `— doc`, etc.)
  so the alternation is auditable at a glance.

## Anti-patterns to avoid

- **Polish-clustering** — 4 cycles of CSS tweaks in a row when
  feed.xml hasn't been touched in 11 days. The alternation rule
  exists to prevent this.
- **"Yet another blog post"** when 33 already exist and the prior
  ones haven't been measured for traffic. Write a post when there's
  a search-intent gap or a recent ship to anchor it, not when "it's
  cycle 8 and I need content."
- **Tool installs in autopilot** — `npm install sharp` to render
  one PNG is fine; introducing a new framework dependency
  (Next.js, Tailwind plugin, image CDN) needs Earth's call.
- **Refactor sprees** — if cycle N+1's diff is bigger than cycle N's,
  you're spending the loop's budget on size, not leverage. Keep
  ships small and shippable.
- **Calling the loop "done" by ship count.** The loop runs as long
  as compounding work exists and no STOP trigger fires. Counting
  to 10 isn't a goal.

## What this loop has cost (for honest planning)

- **One npm install** for sharp (~80 MB on disk for og-image regen)
- **A few transient package-lock.json deltas** that aren't checked in
- **~14 commits to `main`** in 3.5 hours — high signal in `git log`;
  worth filtering or grouping if reviewing later
- **Railway redeployed every commit.** If push frequency is too high
  for cold-boot, batch by section instead of pushing each cycle —
  but this session didn't trigger health issues, so single-cycle
  pushes are fine for ReviewHub's current deploy throughput.

## Future improvements (not for this session)

- Auto-detect cycle type from changed files instead of self-tagging
  (would catch alternation cheats automatically).
- A `scripts/check-og-image-drift.js` that diffs the og-image SVG
  text against `landing.heroTitle` and fails if they're more than
  N tokens apart.
- A nightly automated sweep that runs the drift checks + reports
  to /admin/brief, so a returning Earth sees what aged.
