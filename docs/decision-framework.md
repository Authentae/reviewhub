# How Claude should decide what to work on (ReviewHub edition)

**Author:** Claude (with Earth's pushback that prompted the framework).
**Date:** 2026-05-21.
**Status:** Load-bearing. CLAUDE.md links here. Memory file
`feedback_stage_aware_decisions.md` operationalises it per-session.

## Why this exists

For ~6 months Claude has shipped queue items as if they were equally
valuable. The queue is just *"things someone wrote down at some point"* —
it's not a strategy. Earth has surfaced this failure mode multiple
times (look-up-from-queue rule, blind-trust bar, diagnose-before-more-
outreach rule, real-autopilot rule) and it keeps recurring because:

1. No explicit "north star" metric the agent runs every decision through.
2. No stage-awareness — pre-revenue defaults differ from $5k MRR defaults.
3. The agent optimises for ship-count (visible motion), not for outcome
   (closer to first dollar).
4. Solo-doable artifacts (marketing surfaces, blog posts) crowd out
   founder-required work (customer interviews, pricing tests).

This doc fixes it.

---

## The north star: TTFPC

**Time To First Paying Customer.**

At pre-revenue, **every decision** gets evaluated against the question:

> *"Does this measurably shorten the path to first paying customer?"*

If "yes" — do it. If "no" — back-burner (not "discard" — just deprioritise
until the answer changes). The default deflates from *"is this useful?"*
(yes-biased) to *"is this on the critical path?"* (correctly narrow).

When MRR > $0, replace TTFPC with **MRR/month delta**.
When MRR > $5k, replace with **CAC payback period**.
When MRR > $50k, hand off to humans because the framework breaks at scale.

---

## Where we are right now (2026-05-21)

| Stage | Stage 0: Pre-validation |
|---|---|
| Paying customers | **0** |
| MRR | **$0** |
| Outreach waves run | 5 (Wave 5 sent ~2026-05-19/20, result pending ~05-24) |
| Audit-view rate from outreach | ~35% |
| Reply rate from outreach | **0%** |
| Marketing surfaces shipped | 100+ |
| Blog posts | 33 (EN+TH pairs) |
| Tests in CI | 1087+ server + 7+ client |
| Visible bottleneck | **Recipients view the audit but never reply.** |

The bottleneck is NOT product quality, NOT SEO, NOT infrastructure,
NOT marketing surfaces. It is: **the cold-outreach offer doesn't
convert audit-views to replies.**

Until that bottleneck changes, every decision should be evaluated by
"does this move that number?"

---

## The decision frame

Apply this filter in order. Stop at the first match.

### 1. Is this an experiment that PRODUCES SIGNAL on the current bottleneck?

Current bottleneck = "audit-views don't convert to replies."

Examples that pass:
- Diagnostic: per-prospect audit-view counts (so we know who actually opened)
- Followup email drafts to opener-no-reply segment
- A/B test the audit-preview headline / CTA / pricing anchor
- Talk to 3 prospects who opened-but-didn't-reply (founder-required)
- Try a different CTA (Slack/LINE conversation instead of email reply)
- Send the same outreach from a different identity (e.g. earth.reviewhub@ vs theearth1659@)

Examples that fail:
- Add a new vertical page
- Ship another blog post
- Improve a11y on Landing
- Build a tool for a use-case we haven't validated

**This is highest priority.** Most of these are founder-required, BUT
the prep work (drafting, building diagnostic CLIs, screenshotting
funnel state) is solo-doable.

### 2. Does this REMOVE A KNOWN FRICTION on the conversion path?

Conversion path: prospect → opens email → clicks audit URL → views audit
→ replies → conversation → demo → checkout.

Known frictions today:
- Audit URL was once typo'd, sent dead link to a prospect
- Audit-preview page conversion already audited; basic fixes shipped
- Pricing toggle had hidden THB tab on every locale (fixed 2026-05-21)
- Checkout flow only validated for Starter; Pro/Business are waitlist forms

Examples that pass:
- Fix the LemonSqueezy checkout flow for the Thai locale (if broken)
- Fix the audit-preview load time if it's currently >2s
- Fix any Lighthouse best-practices issue that affects checkout/register

Examples that fail:
- Fix a11y contrast on a marketing page no prospect visits
- Add another blog post category
- Internal-link audit on blog posts (compounding but slow payback)

### 3. Does this COMPOUND across many future events of a known recurring type?

Compounding wins are worth shipping AT pre-revenue ONLY when the
"future events" are happening NOW or imminent. Otherwise defer.

Examples that pass:
- Visual regression — every UI ship benefits (~weekly events)
- Honesty-lint — every commit benefits (daily events)
- Funnel diagnostic — every prospect, every wave benefits

Examples that fail right now:
- Customer-interview transcription pipeline (need customers first)
- A/B test harness (need ≥100 daily visitors for statistical power)
- TypeScript migration (compounds but multi-week)

### 4. Is this REQUIRED MAINTENANCE on something already deployed?

Tests broken, deploy down, banned-phrase in production. Drop everything.

### 5. Is this MOTION-WITHOUT-PROGRESS?

If the work doesn't pass 1-4, ask: *"if I shipped this, would tomorrow
look any different in a way Earth would care about?"* If no, demote.

Common motion-without-progress patterns:
- Polishing surfaces with already-zero traffic
- Building tools nobody asked for
- Refactoring code that works
- Adding to documentation that nobody reads
- Shipping "what looks productive" instead of "what moves the needle"

---

## The demote list (pre-revenue stage)

Work types that default to **back-burner** unless they pass the
decision frame above. The framework's main job is to STOP defaulting
to these.

| Type | Why demoted at pre-revenue |
|---|---|
| New marketing surfaces | We have 100+; the gap is conversion, not coverage. |
| Yet another blog post | We have 33; SEO traffic is months out; the gap is conversion. |
| Visual polish / aesthetic refactors | No prospect has cited visual quality as a blocker. |
| New free tools | We have 4; usage data inconclusive. Don't add #5 without validating #1-4. |
| Comparison pages (/vs/X) | We have 2; SEO play, months-out payback. |
| Schema markup additions | Marginal SEO improvement; not in current bottleneck. |
| Vertical pages (/for-spas etc) | We have 2; same as above. |
| Infrastructure for infra's sake | Compounding only if the future events are happening. |
| Honesty-lint additions | Important but reactive; only ship after a real drift is detected. |
| Memory file consolidation | Marginal; only ship when noticing real conflicts. |
| Test coverage improvements | Server has 1087+ tests; client has reasonable cov; not bottleneck. |
| Dependency upgrades | Unless security issue, defer. |
| Dev-loop ergonomics | If Earth doesn't complain, defer. |

This list shifts when stage changes. At $5k MRR, "new vertical page"
might be the right thing if it's the proven converting channel.

---

## The promote list (pre-revenue stage)

Work types that default to **top of queue** because they directly
attack the bottleneck.

| Type | Why promoted |
|---|---|
| Wave-N postmortem diagnostics | Tells us why the offer doesn't convert. |
| Followup-email drafts for opener-no-reply | Compounds the existing wave's investment. |
| Customer-development interview drafts | Direct learning from prospects (Earth-executed). |
| Funnel diagnostic dashboards | Quantifies where prospects drop off. |
| Outreach-identity / deliverability checks | Removes the "spam folder" hypothesis cheaply. |
| Audit-preview A/B variants | Tests the actual conversion artifact. |
| Pricing-page A/B variants | Tests the buying decision artifact. |
| Sharper CTAs and offer rewrites | Cheap to test, big upside. |
| Diagnostic tools for prospect-side data | Per-prospect audit-view counts, click maps, scroll depth. |
| Customer-interview transcription tooling | When ≥3 interviews scheduled. |

These are the things I should be defaulting to. When Earth says "ship"
or "more" or "autopilot," **default to this column**, not the demote
column.

---

## Session-start ritual

Every meaningful session, BEFORE picking a queue item, run this 60-
second check:

```
1. What stage are we in?
   → Check docs/reviewhub-wiki.md for current customer count + MRR.
2. What's the bottleneck?
   → Pre-validation: conversion of outreach to replies.
   → Post first-customer: conversion of trials to paid.
   → Post-$1k MRR: scalable acquisition channel.
3. What's the active wave / test?
   → Check docs/outreach/wave-N-* for active outreach test.
4. What signal arrived since last session?
   → Check Gmail, /admin/outreach-stats, Resend dashboard, Clarity replays.
5. Pick work that's IN the bottleneck zone.
   → Default to promote list, not demote list.
```

If the user types `ship` / `go` / `more` / `autopilot` AND the session-
start ritual identifies a bottleneck-zone item: do that item, don't
ask. If no bottleneck-zone item exists (queue empty), surface 2-3
candidates from the promote list before defaulting to demote-list work.

---

## Pre-ship checklist for ANY ship >1 hour

Before committing to work that will take >1 hour:

```
[ ] Which decision-frame tier does this match (1-5)?
[ ] What signal will this produce that we can measure?
[ ] If I shipped this and 1 paying customer landed next month, would
    this have been the cause?
[ ] If 0 paying customers landed next month, would this be the missing
    piece?
[ ] Is there a smaller version of this that would produce the same
    signal in <1 hour?
```

If "no" to (3) AND "no" to (4): the work is motion-without-progress.
Find a better ship.

---

## The stage-transition triggers

When stage changes, this framework re-evaluates:

| Trigger | New north star | New bottleneck (probably) | New promote/demote shifts |
|---|---|---|---|
| First paying customer lands | TTFPC → MRR/month delta | Repeatable acquisition channel | Outreach automation promoted, content surfaces partial-promoted |
| MRR > $1k | MRR/month delta | Customer retention | NPS / onboarding promoted |
| MRR > $5k | CAC payback period | Efficient growth | A/B harness promoted, infra promoted, paid ads experiments |
| Churn > 10% monthly | Hold MRR delta, focus retention | Plug the leaky bucket | Customer interviews, product fixes, success ops |
| First competitor copies our positioning | Defensibility | Hard to characterise | Re-evaluate from scratch |

**Earth has to confirm stage changes.** The agent doesn't unilaterally
move stages. But the agent SHOULD surface "we hit stage trigger X" the
moment it sees the signal.

---

## What this framework is NOT

- **Not a queue.** `docs/operating-queue.md` is. This is the LENS through
  which queue items get prioritised.
- **Not permanent.** Re-read every stage transition.
- **Not strict gospel.** When the founder says "do X," do X. The framework
  helps Claude pick the next thing when Earth isn't directing.
- **Not a substitute for taste.** Earth has product taste the framework
  can't replicate. Surface the framework's recommendation; let Earth
  override.

---

## When the framework conflicts with the operating queue

If `docs/operating-queue.md` has 10 `[ ]` items and only 2 pass the
decision frame, **ship the 2 that pass** and surface the other 8 with
"these don't pass the decision frame; should I demote / delete / keep?"

If 0 pass: **do the look-up-from-queue check** — surface 2-3 promote-
list candidates not on the queue. Don't grind through demote-list
items just because they're written down.

---

## Application example (right now, 2026-05-21)

Just shipped: 4 audit harnesses (visual / lighthouse / link-check /
a11y). They surfaced: color-contrast a11y on 59 nodes, best-practices=73,
0 broken links.

**Decision-frame walkthrough:**

| Candidate | Tier match | Verdict |
|---|---|---|
| Fix color-contrast a11y | None (tier 5 motion-without-progress at pre-revenue) | DEMOTE |
| Fix Lighthouse best-practices=73 | Maybe tier 2 (could be SEO friction), need to read actual issues first | INVESTIGATE first, 20 min budget |
| Ship Tier 1 #6 dynamic OG | Tier 3 (compounding but slow payback at 0 traffic) | DEFER |
| Wave 5 diagnostic (per-prospect view counts) | **Tier 1** — directly attacks bottleneck | **SHIP** |
| Funnel dashboard at /admin/funnel | **Tier 1** — quantifies the conversion drop | **SHIP** |
| Followup-email drafts to Wave 1-4 openers | **Tier 1** — compounds prior wave investment | **SHIP** |
| LLM citation tracker | Tier 3 (compounding, slow payback) | DEFER |
| Outreach automation for Wave 6 | Tier 3 (no point automating a non-converting offer) | DEFER |

**Recommendation: Ship Wave 5 diagnostic + funnel dashboard +
followup-email drafts to opener-no-reply segment. Investigate
best-practices=73 to ~20 min budget; ship the fix only if it's quick.**

If the agent had been running this framework, the last 60+ commits
would have looked very different. Not necessarily better at every
ship, but better-weighted toward the bottleneck.

---

## Maintenance

Update this doc when:

- Stage changes (first customer → MRR-delta north star, etc.)
- Bottleneck changes (e.g. if conversion of opens to replies hits >5%
  then the bottleneck shifts to "trials don't convert to paid")
- A new decision pattern keeps recurring (add to promote/demote table)
- Earth disagrees with a recommendation enough times that the framework
  needs adjustment (then the framework is wrong, not Earth — fix it)

---
