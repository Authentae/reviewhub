# Wave 4 outcomes — decision tree

Pre-committing actions for each Wave 4 outcome so the founder doesn't
have to make decisions when tired (Wave 4's reply window closes around
Mon 5/19, after a long send + watch week). Decision fatigue is real
and the wrong move post-Wave-4 costs more than the wrong move pre-Wave-4.

The matrix below assumes Wave 4 = ~8-12 sends (some may DISQUALIFY at
Maps verification). Open rate calculations are `opened / sent`, NOT
`opened / queued`.

**Read once Tuesday/Wednesday morning. Don't re-read every day. Trust
your past self's commitment when the data lands.**

---

## Hypothesis snapshot (state on 2026-05-08, before Wave 4 sends)

| Hypothesis | Confirmed by | Falsified by |
|---|---|---|
| Bangkok hospitality 200+ reviews IS the audience-fit segment | Wave 4 ≥70% open rate | Wave 4 <50% open rate |
| Wave 2's 3/3 was sample-size noise (N=3) | Wave 4 ≥70% open AND 1+ reply | Wave 4 ≥70% open AND 0 reply |
| The audit-preview page itself is the conversion bottleneck | Wave 4 ≥70% open AND 0 reply | Wave 4 ≥70% open AND 1+ reply |
| Email channel works for this segment | Wave 4 ≥70% open | Wave 4 <30% open |

---

## Outcome A — Wave 4 hits ≥70% opens AND 1+ replies

**Confirmed:** audience-fit + email channel + audit-preview funnel all
work. The Wave 2 zero-reply was sample-size noise. This is the win
case.

**What to do:**

1. **Drop everything else.** Run
   `docs/skills/first-customer-playbook.md`. Hour 0 ack within 30 min
   of seeing the reply, no exceptions.
2. **Don't ship the audit-preview CTA variant.** It's not the
   bottleneck. Save it for later if conversion stalls again.
3. **Pause Wave 5 mining.** First customer matters more than Wave 5
   prospects right now.
4. **Update strategy-30day.md** Week 2 → Scenario B mode. The 30-day
   plan already has the Scenario B path written.

**What NOT to do:**
- Don't celebrate publicly. (X post about "first customer signal!"
  reads as desperate. Wait until they actually pay.)
- Don't reply to the lead with a long email. 3 sentences max,
  acknowledging + asking the smallest possible question to keep
  them engaged.
- Don't pivot the product based on the first reply. N=1 is anecdote.

---

## Outcome B — Wave 4 hits ≥70% opens AND 0 replies

**Confirmed:** audience-fit + email channel work. The audit-preview
page is the bottleneck. This is the "Scenario A" path from
`strategy-30day.md`.

**What to do:**

1. **Ship the CTA variant** from
   `docs/audit-preview-cta-variants.md`. Variant E (Permission-asking)
   is the recommended pair. ~30 min code ship, deterministic
   `audit_id % 2` assignment, Plausible event distinct per variant.
2. **Send Wave 5** (~10 more prospects) immediately after CTA variant
   ships. Each new audit URL gets a deterministic A/B assignment.
3. **Don't change the email body or subject.** They got opened — the
   email is fine. The CTA after the open is what's broken.
4. **Wait for ~20 audits' click-through data** before reading the
   variant signal (per
   `docs/audit-preview-cta-variants.md` "After 20 audits sent").

**What NOT to do:**
- Don't rewrite the email body. The data says open rate is fine.
- Don't pivot to another channel (LINE/IG). Email proved itself.
- Don't lower price. $14 isn't the issue if they didn't even click.
- Don't add a free trial. The codebase explicitly killed trials.

---

## Outcome C — Wave 4 hits ≥70% opens AND ALL prospects "viewed once and never returned"

This is the subtler version of Outcome B. Same recommended action
(ship CTA variant + Wave 5), but **also flag**:

- The audit URL view stayed at `1` for everyone. Nobody re-opened to
  show a colleague, share with a manager, or come back to consider.
- Hypothesis: the page reads as "neat but not actionable." The CTA
  variant should land — but if it ALSO produces no second-views,
  the underlying issue is the page content (not the CTA copy).

**Add to the Week 2 todo:** if CTA variant E hits same 0%
click-through, write a Week 3 page-content rework. Specifically:

- Add a "what would this look like for me" walkthrough section
- Add proof of similar-property cohort (anonymized — "3 of the last
  5 Bangkok boutique hotels who saw drafts said the tone matched")
- Add a "first month free" CTA as a fallback (introduces trial; needs
  product decision first per memory file)

---

## Outcome D — Wave 4 hits 30-70% opens

**Mixed signal.** Audience-fit segment was right but message strength
varied. Possible reasons (in order of likelihood):

1. **Day-of-week / time-of-day variance.** Tuesday vs Wednesday had
   different open rates. Compare splits — if Wed >> Tue, owners check
   email mid-week not Tuesday.
2. **Sample noise.** With 8-12 sends, ±15% bands are still noise.
3. **Subject line variance.** I varied subjects across the 12 drafts;
   compare which subjects opened vs didn't. Top performer becomes
   Wave 5 standard.

**What to do:**

1. **Look at the subject-line breakdown.** Each draft used a slightly
   different subject. Three opened the most → adopt as Wave 5+ default.
2. **Send a smaller Wave 5** (5-7 prospects) using the winning
   subject + best send time. Treat as confirmation experiment.
3. **Don't ship the CTA variant yet.** Mixed-open data isn't strong
   enough signal that the page is the issue.

---

## Outcome E — Wave 4 hits <30% opens

**Audience-fit hypothesis is broken.** Either Wave 2's 3/3 was a
fluke, OR something between Wave 2 and Wave 4 changed the world (a
competitor's email blast desensitized the segment, a Gmail policy
change hurt deliverability, the brand-account sender got reputation
flagged).

**What to do:**

1. **Run `mail-tester.com` on a fresh send.** Score should still be
   8.0+ from `earth.reviewhub@gmail.com`. If it dropped, deliverability
   is the issue. Look at SPF/DKIM, recent bounce rates, recent spam
   complaints.
2. **Check Gmail's Postmaster Tools dashboard** if domain is set up.
   Reputation and authentication trends.
3. **If deliverability is fine:** segment was wrong. Pivot to a
   different vertical (dental clinics, independent restaurants —
   already pre-mined in `lead-finding.md`). Park the Bangkok
   hospitality assumption.
4. **If deliverability is broken:** rotate to a different sending
   address (`hello@reviewhub.email` after a 2-week warmup) per
   `audit-outreach.md`. Pause cold sends until fixed.

**What NOT to do:**
- Don't blame the prospects. The segment is what it is — if it
  doesn't open, it doesn't open.
- Don't increase send volume. More bad sends = worse reputation.
- Don't add discount language ("limited time 50% off!") to recover
  opens. Spam-flag city.

---

## Outcome F — 1+ disqualified prospects revealed at Maps verification

**Not a wave outcome — a reminder.** If Earth's Maps verification
disqualifies 3+ prospects (≥4/10 owner-reply ratio OR <200 reviews),
the actual Wave 4 N drops to ~9 or fewer. That's still enough to read
the segment-fit signal but reduces statistical power.

**Action:** drop the disqualified ones, don't replace them at the
last minute (you'll burn the channel with under-researched prospects).
Smaller Wave 4 is fine. Wave 5 mining covers the missing volume.

---

## After all outcomes — universal followups

Regardless of which outcome:

1. **Update the wiki** (`docs/reviewhub-wiki.md`) Outreach Waves
   section with actuals: opens count, replies count, dates.
2. **Write the Wave 4 post-mortem** at
   `docs/wave-postmortems/wave-4-bangkok-hospitality.md`. Use the
   Wave 2 template structure: snapshot → result → what worked →
   what didn't → hypotheses scored. **Pre-register these
   predictions** so they aren't post-hoc.
3. **Update the operating queue** to mark Wave 4 send as `[done]`
   and add the next-wave action items.
4. **Don't immediately start Wave 5.** Take 24h to read the data
   first. Tactical haste here costs strategic clarity.

---

## Pre-registered predictions (made 2026-05-08, before Wave 4 sends)

For falsifiability — write these BEFORE the data lands:

- I expect **8 of 12 prospects to qualify** at Maps verification (some
  will hit ≥4/10 owner-reply ratio).
- I expect **6 of 8 qualifying sends to open** (75% open rate; Wave 2
  baseline).
- I expect **0-1 of 8 sends to reply** within 5 days. (Pre-revenue B2B
  cold reply rate is rarely above 5-10% even on perfect-fit segments.)
- I expect **0 sends to convert to paid signup within the 5-day
  window.** First customer takes longer than first reply; expecting
  conversion in <14 days is too aggressive.

If reality blows past these (1+ replies, 1+ paid signups), Wave 4 is
a strong signal beyond what's currently expected. If reality undershoots
all of them, the strategy needs revision.
