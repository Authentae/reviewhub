# Lead-finding for ReviewHub

Finding businesses worth approaching with the demo-first audit pitch.
This file is a playbook you paste into Claude (claude.ai, Cowork, or
any chat surface) along with a target city/vertical, and Claude returns
a list of qualified prospects.

## What ReviewHub is selling (so we know who fits)

The demo-first pitch is: **"I noticed {biz} has {N} unanswered reviews
on Google including a 1-star from {date}. I drafted replies for all of
them — see them here: {audit_url}. If you want, I'll keep this running
for you for ฿X/month."**

For that pitch to land, the prospect must:

1. **Have public reviews on Google.** Without reviews there's nothing
   to draft. Filter out very-new businesses with <10 reviews.
2. **Be visibly under-responding.** Response rate <30% on the last 10
   reviews is the magic threshold. If they already reply diligently
   they don't feel the pain.
3. **Be small enough to make the decision themselves.** Owner-operator
   or family-run. No corporate marketing department gating the call.
4. **Not be on a competitor.** If they already use Birdeye / Reputation
   / Podium they have a 12-month contract and won't switch in a DM.
5. **Have a contact path.** Instagram / LINE / Facebook / phone number
   on their Google profile. No contact = dead lead.

## Verticals that fit (in order of fit)

| Vertical | Why it fits | Avg # reviews/mo |
|---|---|---|
| **Cafes / coffee shops** | High review volume, owner-operator, voice-driven | 8–25 |
| **Restaurants** | Same as cafes, plus 1-star pain is acute | 15–60 |
| **Hotels / B&Bs / pousadas** | Multiple platforms (Google + Booking + Agoda), feel platform-fragmented | 20–80 |
| **Beauty salons / nail / hair** | Owner is in the chair all day, no time for replies | 5–20 |
| **Fitness studios** | Reviews matter for new-member acquisition | 4–15 |
| **Specialty shops** (florist, bakery, butcher, wine) | Personal brand, owner cares about voice | 3–10 |
| **Tour operators / activities** | TripAdvisor + Google + Klook stack, fragmented | 10–40 |

**Skip:**
- Chains with >3 locations (have a marketing team)
- Healthcare (HIPAA / regulated; we explicitly don't serve)
- Lawyers / financial advisors (regulated review rules)
- Anything with <10 total reviews (no signal)

## How to use this with Claude

Paste this entire file into Claude. Then ask in this format:

```
Find me 25 prospects in: <city>, <vertical>.
Filter: response rate <30% on last 10 reviews, 10+ total reviews,
single-location or ≤3 locations, owner-operator likely.
Output as a Google Sheets-paste-ready table.
```

Example:
```
Find me 25 prospects in: Bangkok Thonglor, cafes.
```

Claude will (using web search + reasoning):
1. Search Google Maps for cafes in the area
2. Eyeball each result's review-response pattern from the public
   profile (recent reviews, if owner has replied to any)
3. Drop chains, drop healthcare-adjacent, drop already-good-responders
4. Return a 25-row table

## The output table

Columns Claude should produce:

| business_name | google_place_url | last_review_date | total_reviews | rating_avg | unanswered_recent_count | contact_method | notes |

- **business_name** — proper-cased, with trailing emojis stripped
- **google_place_url** — full URL not the place_id (the founder will click it)
- **last_review_date** — when their most recent public review landed
- **total_reviews** — aggregate count
- **rating_avg** — current Google star average
- **unanswered_recent_count** — out of the last 10 reviews, how many have no owner response (this is the qualifier)
- **contact_method** — IG handle / LINE OA / Facebook page / phone (whichever is publicly listed; prefer IG > LINE > FB > phone)
- **notes** — any colour: "Has 3 1-stars from last month, none answered" or "Owner replies in Thai but stopped 6 months ago"

## Daily cadence (when scaling up)

- **Morning (07:00 ICT):** ask Claude for 25 fresh prospects in your
  active outreach city/vertical. Paste into your Google Sheet.
- **Triage (15 min):** scan the list, kill obvious skips (the chain
  hiding behind a single-location URL, the lawyer's office that
  Claude misclassified). Aim for 15 quality leads.
- **Generate audits (30 min):** for the top 5–10, generate the
  outbound audit at `/dashboard` → New outbound audit (the feature in
  this repo). Each audit takes 90 seconds.
- **Outreach (30 min):** DM each via the channel listed in
  `contact_method`. See `audit-outreach.md` for the script.

That's a ~90-minute morning rhythm that adds 5–10 outbound touches/day.

## What does "good" look like

After a week of this, you should have:
- 25–50 outbound touches sent
- 3–8 replies (typical reply rate 10–20% on demo-first DMs)
- 1–3 calls booked
- 0–2 closes (typical close rate on calls 30–50% when the demo lands well)

If reply rate is <10%, the issue is usually:
- Wrong vertical fit (you're DMing barbers when restaurants would convert)
- Outreach copy too long (see audit-outreach.md, keep under 60 words)
- Audit URL the prospect can't read on mobile (test it on phone)
- DM'ing in the wrong language (Thai prospects, English DM = ignored)

If reply rate is >25% celebrate, then check that the calls actually
convert — high reply with low close usually means the audit is
overpromising and the call disappoints.

## What to update

Update this file when:
- A new vertical actually closes well (add it to the table)
- A vertical you tested didn't convert (delete it or note "tried, doesn't fit")
- You discover a new disqualifier (e.g., "skip businesses with .com.kh
  domains — Cambodia routing issues")
- The threshold moves (response rate <30% might shift to <20% as the
  market matures)

The point of the file is captured tribal knowledge — keep it tight,
not exhaustive.

## Field updates from the May 4, 2026 batch (9 cold sends)

What worked / didn't work / surprised us:

### Verticals that delivered strong source-availability and 0% reply rate

These produced the highest-yield prospects in the May 4 batch (sample
size: 9 sends). Reply / conversion data still pending — update this
section after 7-10 days when responses have had time to land.

- **Small B&Bs with own websites** — White Ivory, Vera Nidhra, Aim
  House. All had visible owner email on a non-third-party site, 100+
  Google reviews, 0% reply rate. Email-deliverability rate: 100%
  (3/3 not bounced).
- **Vegetarian / pastry / specialty cooking schools** — May Kaidee,
  Sweets Cottage. Lower-tier Google profiles than mainstream Thai
  cooking schools (which all reply consistently and disqualified).
  Pattern: niche cuisine + small operator + 0% replies.
- **Tingly Thai Cooking School** — outlier example of a high-volume
  (1,800+ reviews) profile with 0% reply rate. The owner is named
  "Mr. Tingly" and the operation is clearly solo-operator despite
  the volume. Suggests owner-personality-driven brands can still be
  unaware-segment regardless of volume.
- **Guesthouses with cafe component** — Better Moon. Mixed
  Thai/English review base, 0% reply rate. Hybrid hospitality +
  F&B businesses fit even when neither pure category does.

### Verticals that under-delivered

- **Mainstream Thai cooking schools** — Bangkok Thai Cooking
  Academy (responded 100%), Focal Local (responded 100%). The
  big-brand Thai cooking schools have already invested in review
  management. Disqualified per the playbook's 60%+ rule.
- **4-star+ chain hotels** — too professionally managed; have
  marketing teams. S15 Sukhumvit hit; visited but didn't pursue.

### Sourcing techniques that worked

- **WebSearch + WebFetch** for "small {vertical} Bangkok contact
  email" surfaced verified emails on the business's actual website
  ~50% of the time. The other 50% returned third-party listings
  with stale emails (Travelfish, old TripAdvisor) which we now
  always re-verify on the live site before trusting.
- **Google Maps reviews tab → count "Response from the owner"** is
  the fastest qualification check. 5-10 visible reviews → if 0
  responses, UNAWARE; if 1-3, AWARE-LAZY; if 5+, DISQUALIFY.
- **Email format pattern** — `{name}@{domain}.com` (e.g.
  `Ron@BangkokThaiCookingAcademy.com`) signals a real personally-
  managed inbox vs. `info@`/`contact@` which often route to a
  shared admin queue.

### Sourcing techniques that failed

- **Searching for emails on third-party booking sites** (Agoda,
  Booking.com, Hostelworld) — those don't expose owner emails;
  reservations go through the platform's messaging system. Skip.
- **Searching "small" + "owner-run" qualifiers** — too restrictive,
  returned 0 results. Drop the qualifiers and filter post-hoc.
- **Cafés** (per existing playbook) — confirmed: rarely have email
  on website, IG-DM only. Yesterday's batch was correct to skip
  cafés for email and route them through IG.
