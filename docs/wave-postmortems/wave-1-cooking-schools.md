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

## Result (queried from production audit_previews 2026-05-08)

- **Opens (email):** Mail-tester scored deliverability 8.2/10
  (inbox-tier). Per-recipient open data unavailable (no email
  tracker pixel — we won't ship one).
- **Audit URL views:** **1 of 9** opened. Specifically Pink Chili
  Thai Cooking School (4 views over the window). The other 8
  prospects (House of Taste, White Ivory B&B, Vera Nidhra B&B,
  Aim House Hotel, Better Moon Guesthouse, May Kaidee Tanao
  Vegetarian, Tingly Thai Cooking, Sweets Cottage Academy)
  never opened the URL.
- **Replies:** 0 of 9.
- **Conversions:** 0 of 9.

### What the data actually says

The original assumption — "0 audit URL views, must be deliverability
or audience" — was wrong about the count. **One prospect (Pink
Chili) viewed 4 times and didn't reply.** That changes the
diagnosis:

- 8 of 9 didn't open → audience problem (or email never reached
  the decision-maker, but we have no way to distinguish without
  asking)
- 1 of 9 (Pink Chili) opened, viewed 4 times, didn't reply →
  **pitch problem** for that subset

The fact that the one opener was a cooking school — supposedly the
"wrong audience" — partially undermines the "audience" framing.
More likely: the wave was mixed (4 cooking schools + 5
non-cooking-schools mixed in: B&Bs, a hotel, a vegan restaurant).
The "cooking schools were wrong" framing was sloppy; the actual
batch was a mixed-vertical experiment that mostly didn't reach
decision-makers.

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

These are testable predictions, not guesses (revised after seeing
the data):

1. **Wave 2 (Bangkok hospitality 200+ reviews) opens at much
   higher rate than Wave 1.** *Confirmed early:* Wave 2 hit
   3/3 opens (100%) vs Wave 1's 1/9 (11%). The audience-fit
   hypothesis is real.

2. **Pink Chili (the 1/9 Wave 1 opener) deserves a follow-up.**
   They viewed 4 times — engagement signal even without reply.
   A "noticed you opened the audit" follow-up at +5 days could
   convert them or surface their objection. Did NOT happen during
   this wave. Add to Wave 4 protocol: track openers separately
   and follow up.

3. **The "didn't open" cohort needs a different test.** 8 of 9
   never opened. Two possible causes we can't distinguish:
   email-didn't-reach-decision-maker vs audience-doesn't-care.
   Wave 4 should test: send via a different channel (LINE OA, FB
   DM) to a small subset of the same audience type. If LINE
   opens > 11%, the email channel was the bottleneck; if not,
   audience-fit was.

4. **Audit URL view count is the diagnostic** — adopt as part
   of `audit-outreach.md`. After 72 hours:
   - 0 views → audience or channel problem (don't blame pitch)
   - 1+ views, 0 replies → pitch problem (or follow-up gap)
   - View + reply → conversion path working, scale

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
sent late on 2026-05-06 — confirmed 3/3 opens (sharp contrast to
Wave 1's 1/9). Wave 3 prospect research in progress (Chrome MCP
flake blocking).

**Action items from this revised post-mortem:**

1. Send a +5-day follow-up to Pink Chili Thai Cooking School —
   they viewed 4 times. Don't waste the only Wave 1 engagement
   signal we got.
2. Drop the "cooking schools = wrong audience" framing in the
   wiki / lead-finding doc. The truth is Wave 1 was mixed-vertical
   and mostly didn't reach decision-makers.
3. Wave 4 protocol: track openers separately + queue +5-day
   follow-up automatically when view_count > 0 and reply not
   marked.
4. Test channel hypothesis: send a small Wave 3.5 batch via
   LINE OA or FB DM to similar audience to distinguish "channel
   bottleneck" from "audience bottleneck."
