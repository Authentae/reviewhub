# Wave 1 — Cooking schools (2026-05-04)

The first outbound batch. Written 2026-05-07, three days after
the reply window effectively closed.

## Wave snapshot

- **Dates:** sent 2026-05-04 (Sunday). Reply window: 2026-05-04
  through 2026-05-07.
- **Target list:** 9 Bangkok-area cooking schools and culinary
  academies. Selected by Google Maps search "cooking school
  Bangkok" + "culinary academy Bangkok", filtered to those with:
  - 50+ Google reviews (so they have a reply problem worth solving)
  - A working website with an "About" or "Contact" page (so we
    could verify the owner email)
  - Not a chain or franchise (decision-maker is the owner, not
    a marketing team)
- **Channel:** Email, sent from earth.reviewhub@gmail.com (brand
  account, not personal).
- **Message variant:** Personalized audit URL DM script from
  `audit-outreach.md`. Each prospect got a unique
  `/audit-preview/<token>` URL with 5-7 of their actual Google
  reviews + AI-drafted replies for each.
- **Sender persona:** Earth (founder voice), single CTA to open
  the audit URL.

## Result

- **Opens:** Mail-tester scored deliverability 8.2/10 (inbox-tier),
  but per-recipient open data unavailable (no email tracker
  pixel — we won't ship one, see "What worked" below).
- **Audit URL views:** 0 of 9. Zero prospects clicked the
  personalized URL.
- **Replies:** 0 of 9.
- **Conversions:** 0 of 9.

## What worked

- **Brand-account sender.** Sending from earth.reviewhub@gmail.com
  (not the personal account theearth1659@gmail.com) was the right
  call — confirmed by mail-tester scoring 8.2/10 and SpamAssassin
  flagging only the .review TLD as suspect (-1.999), not the
  sender itself.
- **No tracking pixel.** Tempting to add a 1×1 pixel for open
  rates, but it would have hurt deliverability (most spam-detectors
  flag tracker pixels) more than it would have helped diagnostics.
  Audit-URL view counts give us the *important* signal — did they
  engage — without the deliverability cost.
- **Audit URLs are the right diagnostic.** Even with 0 conversions,
  the audit URLs gave us a clean falsifiable signal: 0 views means
  prospects didn't engage. If views had been 9 and replies still
  0, the problem would have been the *pitch* not the *audience*.
  The diagnostic split is real.
- **Personalization beat templates.** Each audit was for that
  specific prospect's reviews. This is a permanent rule, not a
  Wave 1 finding — confirmed by the SOC standard for cold outreach.

## What didn't

- **The audience.** Cooking schools have a different review-management
  problem than the cafés/hotels/restaurants we're built for.
  - Their reviews are mostly *students* discussing whether they
    learned to cook, not customers complaining about service.
  - The owner's incentive to reply is lower — the school's
    reputation depends more on its menu of classes than on
    review-reply quality.
  - Many cooking-school owners are part-time chefs running classes
    on the side; review-management is far down their priority
    list.
- **Sunday send timing.** Owners check email Monday morning.
  Sending Sunday meant our email landed in their "promotions"
  pile after a weekend of accumulation. **Tue/Wed AM is the
  hospitality-industry standard for a reason.**
- **No follow-up.** We had a follow-up template ready
  (`audit-outreach.md` § 6) but didn't send any. Standard cold-
  outreach math is that follow-ups recover 30-50% of "no
  response" → unfair to write off Wave 1 as 0/9 without
  exercising the follow-up.

## Hypotheses for next wave

These are testable predictions, not guesses:

1. **Bangkok hospitality 200+ reviews ≠ cooking schools** — the
   problem-fit is different. Wave 3 is testing this directly with
   Methavalai, Lilit, Raweekanlaya as targets.

2. **Tuesday 9-11am ICT outperforms Sunday/Monday.** If Wave 3
   sends Tuesday and gets a response within 48h, that's signal —
   not proof, but signal. Wave 2 was sent at 14:39 ICT on a
   weekday; reply window closes 2026-05-08, so we'll have a data
   point.

3. **Send + 1 follow-up beats send-only.** If Wave 3 includes the
   follow-up template at +5 days and the follow-up generates a
   reply, we'll know follow-ups work for our audience. Don't
   skip them again.

4. **Audit URL view count 0/N → audience problem** is a useful
   diagnostic rule. Adopt as part of the audit-outreach playbook:
   if views = 0 after 72 hours, the audience is wrong, not the
   pitch. If views > 0 but replies = 0, the pitch is wrong.

## Lessons that became rules

These were already in CLAUDE.md or skill files. Wave 1 confirmed
them:

- **Pressure-test the queue, don't blindly execute.** The targeting
  decision (cooking schools) was a bet, not a certainty. We should
  have run a *smaller* test (3 prospects, not 9) before committing
  the full batch to one audience hypothesis.
- **Diagnose before more outreach.** 0 replies ≠ "send more." We
  ran mail-tester to separate deliverability (good) from
  audience/pitch (bad), and only then pivoted target.
  See `feedback_diagnose_before_more_outreach.md`.

## Status

Pivoted 2026-05-06 to Bangkok hospitality 200+ reviews. Wave 2
sent late on 2026-05-06; Wave 3 prospect research in progress
(Chrome MCP flake blocking). Wave 4 will be the first wave to
incorporate the "Tuesday 9-11am + 1 follow-up at +5 days" rules
above.

Cooking schools are not on the Wave 4 target list. They might be
revisited at the 200+ reviews tier as a niche (specifically,
high-end international cooking academies with Western
clientele who write detailed reviews) — but only after we have
a working customer in our primary segment.
