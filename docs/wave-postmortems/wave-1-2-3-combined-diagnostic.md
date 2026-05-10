# Wave 1+2+3 combined diagnostic — open data 2026-05-11

**Why this doc exists:** the per-wave post-mortems (wave-1-cooking-schools.md,
wave-2-bangkok-hospitality.md) were written before the full reply window closed
and before we had production audit-view counts. This is the consolidated
view across all three waves with verified data, written before Wave 4 fires
Tuesday/Wednesday so the strategy reflects reality, not hope.

Data source: `/api/admin/outreach-stats` queried 2026-05-11 against prod.
Admin gate fix was shipped in commit `8ce7e81` — admin endpoints had been
silently broken on every prior query (404 to all callers due to missing
`req.user.email` lookup). Today is the first day this data is reliable.

---

## The headline number

```
Sent (Wave 1+2):  12 cold prospects
Opened:            4  (33% open rate)
Replied:           0  (0% from openers)
Conversions:       0
```

**Translation:** the deliverability story is fine. The pitch/value-prop
story is broken.

---

## Per-wave breakdown

### Wave 1 — cooking schools + B&Bs (sent 2026-05-04)

9 prospects. Mixed vertical.

| Prospect | Views | Last seen |
|---|---|---|
| Pink Chili Thai Cooking School | **4** | engaged repeatedly |
| Sweets Cottage Academy | 0 | not opened |
| Tingly Thai Cooking School | 0 | not opened |
| May Kaidee Vegetarian | 0 | not opened |
| Better Moon Guesthouse & cafe | 0 | not opened |
| Aim House Bangkok Hotel | 0 | not opened |
| Vera Nidhra B&B | 0 | not opened |
| White Ivory B&B | 0 | not opened |
| House of Taste Cooking | 0 | not opened |

**Open rate: 1/9 = 11%.** Audience-fit failure (or the pitch wasn't relevant
to that exact segment). One opener (Pink Chili) read it 4 times, didn't reply.

### Wave 2 — Bangkok hospitality 200+ reviews (sent 2026-05-06)

3 prospects. Hospitality vertical, 200+ reviews each.

| Prospect | Views | Note |
|---|---|---|
| **Chakrabongse Villas** | **14** | the standout warm signal |
| Loftel 22 Hostel | 2 | opened twice |
| Old Capital Bike Inn | 1 | one look |

**Open rate: 3/3 = 100%.** Audience-fit confirmed for the hospitality 200+
segment. But still 0 replies.

### Wave 3 — follow-ups scheduled but not yet fired

The 12 emails scheduled for Tue 2026-05-12 10:00 AM ICT are FOLLOW-UPS to
Wave 1+2 prospects, not net-new audits. No new audit_preview rows; no new
data signal until Tue afternoon.

---

## What the data actually says

**1. Hospitality 200+ vertical works as the audience.**
3/3 vs 1/9 is a 9× lift on the same channel + same message structure. The only
variable that changed was the prospect list. **Wave 4 is sending to the same
vertical (Bangkok hospitality, 200+ reviews) — base-rate prediction: ~100%
open rate on the 7 fresh prospects firing Tue/Wed.**

**2. The audit-preview page is not converting opens → replies.**
4 prospects opened. Two of them (Pink Chili 4×, Chakrabongse 14×) read it
multiple times. Zero of those four replied. This is not a "they didn't see it"
problem. It's a "they saw it and weren't compelled to act" problem.

**3. Chakrabongse is the highest-information prospect we have.**
14 page views is "actively considering, found a blocker, didn't say what."
The +5-day follow-up email already scheduled for Tue 10:00 to Chakrabongse
is the single highest-leverage email in the queue. If she replies, we learn
the blocker. If she doesn't reply twice, that's also signal — at 16+ views
across two emails with no reply, the audit-preview itself isn't pulling its
weight as a conversion surface.

**4. Three of the four openers had multi-view sessions.**
Pink Chili 4, Chakrabongse 14, Loftel 22 2. That's not "saw the headline
and bounced." That's "explored the page." The drop-off is between
"interested enough to revisit" and "interested enough to reply."

---

## Implications for Wave 4 (firing Tue 5/12 + Wed 5/13)

**Predicted outcome based on Wave 1+2 base rate:**
- Open rate: 70-100% (hospitality 200+ baseline = 100%, sample of 7 noise window)
- Reply rate: 0-1 reply maximum
- Conversion: 0

**This is fine — Wave 4 is a re-test, not a new test.** It validates that
the Wave 2 result (3/3 opens) wasn't just three lucky pulls. If Wave 4
opens at <50%, the hospitality-200+ thesis was overfit on N=3. If it opens
at ≥70%, audience is locked in and the bottleneck is definitively the page,
not the list.

**What Wave 4 will NOT tell us:** whether changing the pitch/CTA would
unblock replies. That's a Wave 5 question.

---

## Wave 5 design — what must change

Given Wave 1+2 evidence, Wave 5 (when scheduled) needs to change ONE of these
to be informative:

**Option A — change the audit-preview page itself.**
Already prepped: 4 CTA variants in `docs/audit-preview-cta-variants.md`.
Permission-asking variant E vs control was the recommended A/B. ~30 min to
ship the experiment. Worth doing IF Wave 4 confirms ≥70% open / 0 reply.

**Option B — change the email itself, not the page.**
Maybe the audit URL is too "sales-ish" of a destination. Test a Wave 5 with
the AI-drafted replies pasted INTO the email body, no URL needed. Removes one
click, removes the "is this a phishing link" friction. Easier to write a
compelling reply when the value is already in the inbox.

**Option C — change the channel.**
LINE OA / IG DM / Facebook Messenger. Bangkok hospitality owners are on
those platforms more than email for short-form business comms. Higher
operational cost (manual sends), but if email opens-but-doesn't-reply we
need a different surface.

**Option D — change the segment.**
Test a different hospitality sub-segment: e.g., spa/wellness (different
buyer persona than hotels), or tour operators (different reply rhythm).
Keeps the 200+-reviews filter, swaps the pitch-resonance variable.

**Recommendation:** ship Option A (CTA variant) BEFORE Option B/C/D, because
it's the cheapest test and the existing evidence (multi-view sessions = page
got read) most directly implicates the page-side conversion surface.

---

## What's NOT a hypothesis any more

- ❌ "Maybe nobody opens the emails" — they do (33% overall, 100% in target vertical)
- ❌ "Maybe the personalization isn't strong enough" — Chakrabongse opened it 14 times
- ❌ "Maybe email is dead as a channel" — opens are healthy
- ❌ "Maybe deliverability is shot" — opens are healthy

What IS still a hypothesis: WHY engaged readers don't reply.

---

## Action items

| Item | Owner | When |
|---|---|---|
| Wave 4 sends fire | scheduled Gmail | Tue 5/12 9:35-9:50 + Wed 5/13 9:30-9:40 |
| Wave 1+2 follow-ups fire | scheduled Gmail | Tue 5/12 10:00 (12 prospects) |
| Re-query view counts after Wave 4 reply window closes | agent | 2026-05-15 morning |
| Decide Wave 5 strategy | Earth + agent | 2026-05-15, after Wave 4 data is in |
| Ship audit-preview CTA A/B IF Wave 4 confirms ≥70% open / 0 reply | agent | 2026-05-15, ~30min |

---

## Lessons logged elsewhere

- **Admin endpoints were silently 404ing for the entire history of the gate**
  before today. Means earlier "morning briefings" / standup commands that
  silently 404'd produced empty results without flagging. Codified in a
  memory file so future agents check the gate is wired before reporting
  "0 audits / 0 views."
- **Anthropic API key was revoked or expired** before today's session;
  every customer-facing AI draft generation was returning 401 in production.
  Rotation runbook should be added to `docs/reviewhub-wiki.md` so the next
  rotation isn't a 30-minute fire drill. (Item to ship next.)
