# Wave 5 outcomes — decision tree

Pre-committed actions for each Wave 5 outcome. Read once at the
result-harvest moment (~Sun 2026-05-24), execute the matching branch.
Don't re-derive — that's what the present-self wrote this doc to
prevent.

Pattern source: `docs/wave-postmortems/wave-4-outcomes-tree.md`.
This adapts that to Wave 5's 4-vertical structure (muay thai / spa /
coffee / dental) and updates the hypothesis matrix.

---

## Wave 5 hypothesis snapshot (locked 2026-05-21, before result-harvest)

| Hypothesis | Confirmed by | Falsified by |
|---|---|---|
| Bangkok hospitality (Waves 1-4) was the wrong vertical, not the wrong audience | Wave 5 ≥1 reply from non-hospitality | Wave 5 = 0 replies AND opens look like Waves 1-4 |
| Audit-preview funnel is the bottleneck (audience-fit was fine) | Wave 5 high opens AND 0 replies | Wave 5 ≥1 reply (any vertical) |
| Email channel works for ALL Bangkok SMBs | Wave 5 ≥40% open across all 4 verticals | Wave 5 <30% open in 2+ verticals |
| The 14-prospect sample-size is sufficient to call a winner | Wave 5 gives one vertical a CLEAR signal (e.g. 2+ replies in one vertical, 0 in others) | Wave 5 gives ambiguous signal (e.g. 1 reply, 1 open-no-reply, distributed across verticals) |

Hypotheses 2 and 3 are dependent — falsifying 2 also weakens 3.

---

## Outcome A — Wave 5 hits ≥1 reply from ANY vertical

**Status:** First customer signal. Wave 5 was for vertical-fit
learning — getting even one reply means the audience problem was real,
not the offer.

**What to do:**

1. **Drop everything else.** Run `docs/skills/first-customer-playbook.md`
   if it exists, otherwise:
   - Acknowledge within 30 min (3-sentence reply max, no walls of text).
   - Ask the smallest possible next question (most natural: "happy to
     hop on a 20-min call this week — Tue 2-4pm or Wed 3-5pm work?").
   - Don't oversell. They opened the audit and replied; they're already
     more sold than any cold-outreach copy could make them.
2. **Pause Wave 6 prep.** First conversation matters more than next-
   wave prospects.
3. **Note in `docs/reviewhub-wiki.md`:** which vertical converted,
   which specific prospect, what the reply opening line was.
4. **Update strategy doc:** the converting vertical becomes the
   priority for Wave 6 (10-15 more prospects in that vertical).
5. **Send Wave 5 followups anyway** to opened-no-reply prospects in
   OTHER verticals — 30-50% recovery means 1-2 more conversions
   possible. Lower priority than the first reply, but cheap.

**What NOT to do:**

- Don't celebrate publicly. Anyone who tweets about "first customer
  signal" before they actually pay sounds desperate.
- Don't ship product changes "to make it perfect for them." They
  replied because what exists is already enough. Adding features
  delays the deal.
- Don't pitch every other vertical mid-call. The converter wants to
  know if WE can help THEM, not whether we serve coffee shops too.

**If 2+ replies in DIFFERENT verticals:** higher leverage. The cross-
vertical signal means the audience-fit issue was real and broader than
hospitality. Run the playbook on the highest-conversion-potential
prospect first (intent in their reply > intent in their open).

---

## Outcome B — Wave 5 = ≥40% opens but 0 replies (same pattern as Waves 1-4)

**Status:** Hypothesis 2 (audit-preview funnel is the bottleneck) is
confirmed. Audience-fit was fine; the offer/CTA/page is the friction.

**What to do:**

1. **Send Wave 5 followups** (Tue 2026-05-26 / Wed 5-27) to all
   opened-no-reply prospects. Use `docs/wave-postmortems/wave-5-followup-template.md`
   with the vertical-specific variants. One follow-up only.
2. **In parallel: rewrite the audit-preview CTA.** Three A/B variants:
   - Variant 1 — "Generate replies for free" (current): unchanged baseline.
   - Variant 2 — "Show me what the draft looks like" (lower-commitment CTA).
   - Variant 3 — "Talk to Earth, founder, 20-min call" (skip the
     self-serve path entirely, go human).
3. **Send 5-10 new prospects with the rewritten audit page** as Wave 5.5.
   Pick the highest-open-rate vertical from Wave 5 (decided by the
   diagnostic CLI output).
4. **Don't double down on cold outreach** until the audit-preview
   variant has a winner. We're 5 waves into "audit-preview converts
   open-no-reply at 0%" — sending another 14 prospects through the
   same broken funnel produces the same result.

**What NOT to do:**

- Don't add features to the product. The bottleneck is funnel
  conversion, not product capability.
- Don't ship more marketing surfaces. We have 100+. The conversion
  surface (audit-preview) is the only one being measured against
  prospect behaviour.

---

## Outcome C — Wave 5 = <30% opens in ≥2 verticals

**Status:** Deliverability or sender-reputation issue. Waves 1-4 hit
35%; <30% in two verticals = signal that the sender account or copy
is being flagged.

**What to do:**

1. **Run mail-tester immediately** from `earth.reviewhub@gmail.com`.
   Score under 8/10 = problem confirmed. Above 8/10 = sender is fine,
   it's the subject line or open-rate timing.
2. **Check Google Postmaster Tools** for `earth.reviewhub@gmail.com`
   — domain reputation, IP reputation, spam rate.
3. **Check Gmail "Sent" folder** for bounce notifications or "delivery
   delayed" warnings on any Wave 5 send.
4. **DO NOT send Wave 6 from the same account** until diagnosed. If
   sender reputation is shot, switch to a fresh account (e.g.
   `earth@reviewhub.review` with proper SPF/DKIM/DMARC via Resend)
   OR start using LINE / IG DM as the channel for the next wave.

**What NOT to do:**

- Don't send Wave 6 to "prove" deliverability — that burns 20 more
  prospects on the same broken channel.
- Don't dismiss the result as "sample size" — 0/14 deliverability
  signal IS a real signal at 30%+ historical baseline.

---

## Outcome D — Wave 5 = 1 reply BUT it's a "not interested" or "wrong product" reply

**Status:** Counts as a reply for hypothesis purposes BUT the actionable
signal is different. They engaged enough to type a sentence; what they
typed matters.

**What to do:**

1. **Reply once with curiosity:** "Thanks for the honest answer —
   genuinely useful. Mind if I ask: was it (a) wrong vertical, (b)
   wrong tool, (c) wrong timing, or (d) just not enough trust in a
   tool you've never heard of?" — multiple-choice reply.
2. **Record the answer in `docs/reviewhub-wiki.md`** under "what
   prospects told us." Even 1 such answer is more useful than 5 more
   cold sends.
3. **Continue treating Wave 5 as Outcome B** (opens-no-reply pattern)
   — one "no thanks" doesn't refute the funnel hypothesis.

---

## Outcome E — Mix of opens + 1 reply that's a "schedule a call"

**Status:** Highest-value outcome. They engaged AND want a conversation.

**What to do:**

1. **Schedule within 24h.** "Tue 2-4pm or Wed 3-5pm Bangkok — pick
   one." No back-and-forth on timing.
2. **Don't prepare a deck.** They want to talk, not be presented to.
   Use the call to listen — what made them open the audit, what made
   them reply, what they currently do for reviews, what they hate
   about it.
3. **End the call with a yes/no ask:** "Want to try ReviewHub free for
   30 days? I'll connect your Google Business Profile right after
   the call, and you'll see the first auto-drafted replies tonight."
4. **If they say yes:** treat as first paying customer pipeline. Even
   if they're on Free tier, the qualitative data from the call is
   gold.

---

## Outcome F — Wave 5 manifest doesn't match actual sends (diagnostic shows 0 matched)

**Status:** Tooling mismatch — Earth's spreadsheet has business_name
strings that don't match the audit_previews.business_name in the DB.

**What to do:**

1. Open the diagnostic output's "Unmatched in manifest" rows.
2. Open `/api/admin/outreach-stats` JSON and find the Wave 5 timeframe
   audits (created_at between 2026-05-19 and 2026-05-20).
3. Update `docs/outreach/wave-5-manifest.json` business_name strings
   to match what's in the DB. Rerun the diagnostic.
4. Going forward (Wave 6): create the audit_previews with EXACTLY the
   business_name from the manifest. Add the manifest line as a comment
   in the send-script.

---

## What this doc is NOT

- **Not a substitute for Earth's judgment.** Pre-committed branches
  are defaults. If the actual reply has a quirky shape (e.g. "we'd
  pay $100/mo if it also did X"), Earth's read of the prospect beats
  any pre-written branch.
- **Not the playbook itself.** This doc says "which branch to enter."
  The playbooks (first-customer-playbook.md, etc.) say "what to do
  inside the branch."
- **Not exhaustive.** Outcomes G-Z exist. The named branches cover
  ~85% of likely outcomes. Anything outside the named branches gets
  Earth's full attention, not a rote response.

---

## When to update this doc

- BEFORE Wave 5 result-harvest: lock the hypothesis matrix above. Don't
  re-derive at harvest time.
- DURING result-harvest: don't update. Read once, execute the branch,
  no edits.
- AFTER Wave 5 closes (full followup window passed, ~2026-06-02):
  update the hypothesis matrix with what was actually confirmed /
  falsified. Carry forward to wave-6-outcomes-tree.md.

