# Post-Wave-5 strategic synthesis

**Date:** 2026-05-21 / 22 (overnight session).
**Stage:** Stage 0 (pre-validation) — 0 paying customers, $0 MRR.
**Last 6 months:** 100+ marketing surfaces shipped, 33 blog posts,
5 outreach waves run, $0 revenue.
**Today's shipping:** 18 commits. Major: TTFPC decision framework
locked in CLAUDE.md, LemonSqueezy live + checkout overlay,
honest Wave 5 re-analysis, Wave 6 prep (13 verified-email prospects,
outcomes tree, send sheet), funnel diagnostic endpoint with
verification-cluster detection.

---

## What we actually know after 5 outreach waves

| Wave | Date | Sent | Bounce | Real opens | Replies | Lesson |
|---|---|---:|---:|---:|---:|---|
| 1 | 2026-04 | ~7 | unclear | ~2 | 0 | Cooking schools — wrong vertical entirely |
| 2 | 2026-05-04 | 3 | 0 | 3 | 0 | Bangkok hospitality, sample-size noise |
| 3 | 2026-05-08 | ~5 | unclear | ~2 | 0 | Combined with Waves 1+2 in postmortem |
| 4 | 2026-05-12/13 | 12 | unclear | ~4 | 0 | Bangkok hospitality, 33% open rate, "0 replies despite opens" hypothesis solidified |
| 5 | 2026-05-16/18 | 14 | **4** | **0-1** | 0 | Multi-vertical test (5 muay thai / 5 spa / 2 coffee / 2 dental). Muay thai email-on-website doesn't exist → 4 bounces. View counts contaminated by Earth's verification batches → apparent 64% open rate, actual 0-1 real opens. |

**Cumulative real data across 5 waves:** ~41 total sends, ~4 confirmed
bounces, ~2-8 confirmed real opens, **0 replies, 0 conversations, 0
customers.**

That's the honest scoreboard. Every framing softer than "0 replies"
has been an artifact of bad measurement.

---

## What's been proven and what hasn't

### Proven

1. **Email-from `earth.reviewhub@gmail.com` lands in inboxes** —
   mail-tester 2026-05-13 confirmed 9.4/10 deliverability. The "going
   to spam" hypothesis is OUT.
2. **The audit-preview page itself renders correctly** — Earth's own
   verification clicks confirm the page works end-to-end (the views
   ARE views, just not prospect views).
3. **Pattern-guessed emails fail badly** — Wave 5's `<biz>@gmail.com`
   guesses bounced 4/5 for muay thai gyms. Verified-on-site emails
   are now non-negotiable (Wave 6 enforces this).
4. **LemonSqueezy can take real money** — approved + activated
   2026-05-21, Starter product created (variant 1076073), checkout
   overlay mounts cleanly on reviewhub.review without domain bounce.
5. **The visual + a11y + perf surface is solid enough not to be the
   bottleneck** — Lighthouse perf 78-87, a11y 92-96. Best-practices
   at 73 (CSP issues partially fixed today). LCP 3-4s on slow 4G is
   real but unlikely to be the conversion-blocker at current traffic.

### Not proven (still hypotheses)

1. **Bangkok hospitality is the right ICP** — 4 waves, 0 replies. The
   strongest argument for keeping it is "we haven't disproved it yet."
   The strongest argument against is "0 replies on N≈30 is itself a
   weak disproof."
2. **AI-drafted review replies are a real felt-pain for small business
   owners** — Wave 5 prospects didn't open the audits in the
   verification-corrected data. We don't know if they SAW the cold
   email and dismissed it, or if it went to a tab they never
   re-checked.
3. **The audit-preview page converts opens → replies** — never had
   real opens to measure. Variant L (low-friction lead, async-ask
   primary, paid demoted) shipped 2026-05-21 commit `de75c0f` is
   the next test of this.
4. **$14/mo is the right price** — no buyer signal yet. LS can take
   the money the moment a buyer says yes.
5. **Cold email is the right channel** — 5 waves with this method,
   0 replies. Either the channel is wrong, or the offer-fit needs
   sharpening, or the audience is wrong. Channel pivot (LINE OA
   outbound, IG DM for muay thai, warm intros) has not been tested.

---

## What Wave 6 specifically tests

13 verified-email prospects across Bangkok + Singapore × Dental + Spa.
Detailed in `docs/wave-6-prospects.md` and `docs/wave-6-outcomes-tree.md`.

Five hypotheses, each ship-quality regardless of outcome:

| # | Hypothesis | Resolves which prior unknown |
|---|---|---|
| 1 | Wave 5's apparent open rate was verification-batch contamination | Confirms the methodology fix |
| 2 | Verified-on-website emails outperform pattern-guessed on deliverability | Confirms Wave 6 protocol fix (bounce rate should drop from 28.5% → ~0%) |
| 3 | Singapore SMB market responds better than Bangkok to cold outreach | Geography signal — does Bangkok have something city-specific (saturation, language, etc.) preventing replies? |
| 4 | Variant L converts opens→replies better than control/E | Audit-preview funnel test (the actual unknown — Wave 5 couldn't measure this) |
| 5 | Dental + spa produce ≥1 conversion-quality reply | At least ONE prospect engaged enough to type a sentence — the bar for "stage 0 product-market signal" |

If H5 confirms (any reply): execute first-customer playbook.
If H5 falsifies (0 replies on N=13 verified): **the question is no longer
"is the open rate too low" — it's "is anyone interested in this offer
at all?"** That's a fundamental signal worth pivoting on.

---

## What comes after Wave 6 (branching strategy)

### If Wave 6 = Outcome A (≥1 reply)

The conversation begins. Wave 7 doubles down on the vertical + city
that produced the reply. 5-10 more prospects in that combination,
same Variant L audit URL, same send protocol. Goal: 1 paying customer
within 2 weeks.

### If Wave 6 = Outcome B (high opens, 0 replies, no clusters)

The audit-preview funnel is confirmed as the bottleneck. The Variant L
ship today was the first test; subsequent moves:
- Watch Clarity replays of the opened audits (we have the replays;
  we've never watched them with intent)
- A/B test 2-3 more audit-preview variants
- Send Wave 7 = 5-10 prospects through the best variant

### If Wave 6 = Outcome C (<15% opens)

The cold-email channel is questionable for this product at this stage.
Two branches:
- **Mail-tester check first** (sender reputation drift?)
- **Channel pivot:** LINE OA outbound, warm intros via existing
  network, IG DM for verticals where email isn't the channel

### If Wave 6 = 0 across all metrics

Time for a harder strategic conversation:
- Is the product-market fit hypothesis correct? (small business
  owners who care about Google reviews enough to pay $14/mo)
- Is the offer right? ($14/mo for AI drafts vs free Google's own
  reply suggestions vs $100+ Birdeye)
- Is the audience right? (small business owners — should we test
  agencies, franchise managers, multi-location operators instead?)
- Is the timing right? (review reply tools are a commodity; what's
  our wedge? language matching? voice matching? LINE notification?)

These aren't questions to ask BEFORE Wave 6 closes. But they're the
questions to be ready for if Wave 6 produces no signal.

---

## What's not in the queue (and probably should be)

The decision framework's "promote list" defaults to bottleneck-zone
work. But there's a class of strategic moves worth surfacing:

1. **Customer-development conversations with non-customers** — talk
   to 3 dental clinic owners about how they currently handle reviews.
   Not via cold email — via warm intros, LinkedIn, or paid services
   like Respondent.io. This bypasses the outreach-conversion problem
   entirely and answers the deeper "is this a felt pain?" question.

2. **Competitive teardown** — buy a month of Birdeye / Podium /
   Reviewflowz Starter, use them for a real Google Business Profile
   (Earth's or a friend's), document what's good and what's bad. This
   informs the positioning + lets us answer prospect objections like
   "we already use X."

3. **Channel diversification test** — send 5 LINE DMs to muay thai
   gyms (the vertical where email died); send 5 IG DMs to coffee
   shops (where they don't publish emails). Compare reply rates to
   email cohort.

4. **Audit-preview deep-quality check** — Earth has never sat with a
   first-time prospect AND opened the audit URL with them, watching
   their face. Even one such observation (could be a friend of a
   friend) would reveal the friction point that no analytics
   captures.

5. **Pricing test** — when the first paying-customer pipeline opens,
   try $24/mo for the first 5 customers. Higher commitment, harder
   ask but signals real value. If 0 takers at $24, $14 might be too
   low (cheap-for-feature-rich SaaS triggers "is it real?" reaction).

These aren't on the operating queue today. They should be.

---

## Operating principles confirmed today

1. **Diagnose before more outreach.** Wave 5's "0 replies → send Wave 6
   bigger" instinct was wrong. The right move was "check why Wave 5
   data doesn't make sense" (the verification-batch finding).

2. **Verify identity before sending.** 4/5 muay thai bounces in Wave 5
   were from pattern-guessed emails. Wave 6 enforces email-on-website.

3. **Look up from the queue.** This synthesis doc + Wave 6 prep
   wouldn't have happened if I'd just shipped queue items overnight.
   The TTFPC framework wired into CLAUDE.md today is the rule that
   makes this thinking systematic.

4. **Honest scoreboard beats vanity scoreboard.** "5 waves, 0 replies"
   is the truth. "5 waves, 35% open rate" was an artifact. Earth's
   pushback today on the "64% Wave 5 open rate" claim was the most
   strategically valuable correction of the session.

5. **Compounding infra > more surfaces.** The funnel diagnostic
   endpoint built today is more valuable than the next 5 marketing
   surfaces would have been, because it makes every future wave
   measurable.

---

## What Earth wakes up to (2026-05-22)

Concrete deliverables ready for action:
- `docs/outreach/wave-6-prospects.md` — 13 verified prospects
- `docs/wave-postmortems/wave-6-outcomes-tree.md` — pre-committed decisions
- `docs/outreach/wave-6-send-sheet.md` — 13 paste-ready bodies + subject A/B/C
- `/api/admin/funnel` — query for honest funnel data, with verification-cluster check
- `docs/strategy/post-wave-5-synthesis.md` — this doc

Concrete Earth-required actions (in order):
1. **Flip LS test → live** (2 min) — gates revenue.
2. **Stripe Continue Setup if you want Stripe as backup** — optional, LS is now primary.
3. **Wave 6 send Tue/Wed 9-11 AM ICT/SGT** (~45 min for 13 prospects).
   - Generate each prospect's audit-preview, get share_token
   - `curl -I` verify, ONE verification click (deliberate, not batched)
   - Paste body from send-sheet, send
   - Mark timestamp + subject variant in tracker
4. **Sun 2026-06-01 — Wave 6 harvest** (~15 min)
   - `curl /api/admin/funnel?from=2026-05-26&to=2026-05-27`
   - Read verification_cluster_check first; if clusters detected,
     they're YOUR clicks, subtract them.
   - Match outcome to `wave-6-outcomes-tree.md` → execute that branch.
5. **Don't celebrate any number before Day 7.** Wave 5 lesson holds.

---

## Honest closing note

5 waves and 0 replies is a hard truth. But after today:
- The MEASUREMENT is honest (verification-cluster check)
- The OUTREACH PROTOCOL is honest (verified emails, not pattern guesses)
- The CHECKOUT works (LS overlay live, can take money)
- The FRAMEWORK is locked (TTFPC north star, promote/demote lists in
  CLAUDE.md)
- The CRITICAL PATH is clear (Wave 6 outcome → branching strategy)

That's not "we have customers." But it IS "we have a real test
running with real measurement and a pre-committed decision tree."
That's the difference between Stage 0 motion-without-progress and
Stage 0 with a deliberate next move.

---

**Document status:** Phase 4 of overnight session 2026-05-21 → 2026-05-22.
Final commit in the session.

**Next time this doc updates:** Wave 6 harvest day. Read the outcomes
tree. Execute the matching branch. Update this synthesis with the
confirmed/falsified hypotheses.
