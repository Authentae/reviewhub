# ReviewHub kill-switch

**Locked:** 2026-05-09
**Decision date:** 2026-07-08 (60 days)
**Signed by:** Earth (founder), agent (operating partner)

This document pre-commits future-Earth to an honest evaluation. It
exists because pre-revenue solo founders systematically over-grind
losing strategies and rationalize "we're close" when the data says
"we're not." Confirmation bias is what kills founders, not market.

The kill-switch is dated, signal-based, and pre-defines the action
on either branch. Past-Earth (today) signs the deal. Future-Earth
(2026-07-08) executes whichever branch fired.

---

## The deal

**On 2026-07-08, evaluate against this single signal:**

> *Has ReviewHub acquired at least 1 paying customer (any tier, any
> price, real money exchanged) by 2026-07-08?*

**If YES → keep grinding.** The strategy is producing revenue, however
slowly. Rerun this kill-switch 90 days later (2026-10-06) with
threshold = 5 paying customers.

**If NO → sunset the current strategy.** That doesn't mean shut down
ReviewHub forever. It means stop grinding cold-outbound + audit-funnel
+ Bangkok hospitality. Pick one of the three pre-defined branches
below within 14 days of the decision date.

---

## Why this signal, not others

- **"Paying customer" not "replies" or "demos"** — replies and demos
  are leading indicators that lie. A reply that doesn't convert is
  not signal of product-market fit; it's signal of a polite human.
  The only honest signal at pre-revenue is: someone gave you money.
- **"At least 1" not "5" or "10"** — at 60 days with a solo founder
  and ~10 prospects per wave, expecting 5 paid customers is unrealistic
  and would force a pivot decision that's premature. 1 customer is the
  smallest signal that says "the funnel can convert." Zero is the
  signal that says "the funnel can't."
- **60 days, not 30 or 90** — 30 days is too short for B2B sales
  cycles (typical close-time is 2-6 weeks even after a positive demo).
  90 days is "founders rationalize forever" territory. 60 days fits
  6-8 outreach waves, which is enough N to test the segment hypothesis
  fairly.

---

## Pre-defined branches if NO (1+ of these by 2026-07-22)

The kill-switch isn't "shut down." It's "stop the current approach
and pick a deliberate next move within 14 days." The three branches:

### Branch 1 — Pivot the segment

If outreach activity surfaced a different vertical that engaged better
than Bangkok hospitality (e.g., dental clinics replied where hotels
didn't), pivot Wave 7+ to that segment with the same product.

**Trigger to pick this branch:** there's at least one other vertical
where reply rate ≥ 5% across 5+ sends. Without that signal, this
branch is fishing.

### Branch 2 — Pivot the model

Keep the audience (Bangkok hospitality / SE Asian SMBs) but change
the product or pricing. Examples:

- Pure done-for-you reply service ($X/review, no SaaS)
- Free forever + paid Pro tier with a clearer "your team grew" trigger
- Annual-only pricing at deep discount to test commitment
- White-label for review-management agencies

**Trigger to pick this branch:** Wave data shows audit-URL views high
but no signups. That signal says people want the OUTPUT but not the
SaaS commitment — fits a service or different-model pivot.

### Branch 3 — Sunset cleanly

If neither (1) nor (2) has a signal: stop active development. Three
sub-options:

- **Maintenance mode:** site stays live (free tier still works for
  existing users), code goes to half-time, Earth focuses elsewhere
  while ReviewHub cooks. Re-evaluate in 6 months.
- **Open source:** GitHub the codebase, write a "what I learned at
  $0 MRR for 60 days" post. Reputation play, not financial.
- **Sell the domain + code** to whoever wants the head start.

**Trigger to pick this branch:** none of the segment / model pivots
have a signal AND Earth's cash/cognitive runway is below 90 more days
of solo grind. Cognitive runway is real. Burning it for a "maybe" when
the data says "no" is not perseverance — it's avoiding a hard call.

---

## Leading indicators (NOT kill-switches — checkpoints)

These don't trigger anything automatically. They're calibration
points so future-Earth knows whether the trajectory is hitting,
missing, or exceeding the kill-switch deal.

| Date | Days from start | What we should see if winning | What to do if we don't |
|---|---|---|---|
| 2026-05-23 (Day 14) | 2 wks | Wave 4 reply window closed: 1+ replies | If 0 replies: ship CTA variant per `docs/audit-preview-cta-variants.md` |
| 2026-06-08 (Day 30) | 4 wks | 1 demo OR 5 audit→register clicks | If 0: deeper audit-preview page rework or channel test |
| 2026-06-23 (Day 45) | 6.5 wks | 1 paying customer OR 1 strong rejection signal worth pivoting on | If 0: prep the pivot branches above so Day 60 has a real choice |
| 2026-07-08 (Day 60) | **DECISION DAY** | At least 1 paying customer | Branch 1, 2, or 3 within 14 days |

---

## What past-Earth (signing this) commits to

- **No moving the date.** "Just two more weeks" is the failure mode
  this document exists to prevent. If 2026-07-08 says NO, you make
  the branch decision. You do not extend the timer.
- **No moving the threshold.** "1 paying customer at $5/mo doesn't
  count as a real customer" — yes it does. The deal is "real money
  exchanged."
- **You execute the branch within 14 days of decision date.** Not "I'll
  pivot eventually." A specific branch + a specific first action by
  2026-07-22.
- **You read this document at Day 30, 45, and 60.** The leading
  indicators above are real. Use them to update your gut between now
  and the decision day, not to override the deal.

## What future-Earth (executing) gets

- **The right to be honest.** Past-you signed off. Whatever the data
  says, you have permission from past-you to act on it without guilt.
- **Three pre-thought branches** — you don't have to invent the next
  move while exhausted at Day 60. The branches are picked from a
  rested-CEO state today.
- **A clean exit story.** Maintenance mode + open-source + sell are
  all dignified options. None of them are failure. Failure is grinding
  past the kill-switch on a strategy that's not working.

---

## What this is NOT

- **Not a target.** "1 paying customer in 60 days" is the floor, not
  the goal. The goal is more.
- **Not pessimism.** Successful founders set kill-switches more often
  than failed ones. Patrick Collison talks about Stripe's 18-month
  kill-deadline. Pieter Levels publishes his shutdown criteria for
  every project upfront.
- **Not the only check.** If something catastrophic happens before Day
  60 (cash runs out, health issue, family crisis), Earth obviously
  acts on that — kill-switch is for the *strategy is working / not
  working* question, not life-emergencies.

---

## Sign-off

Past-Earth: by committing this file to git, signs the deal.

Future-Earth: by reading this on or after 2026-07-08, executes
honestly.

Operating partner (agent): will check in at the leading-indicator
dates above without prompting and surface the data plainly. Will not
help future-Earth rationalize past the kill-switch. The agent's job
on Day 60 is to ask one question: "What does the data say?" and to
stop helping if past-Earth's commitment is being violated.
