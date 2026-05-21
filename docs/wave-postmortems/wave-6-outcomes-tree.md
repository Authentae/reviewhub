# Wave 6 outcomes — decision tree

Pre-committed actions for each Wave 6 result shape. Read once at the
harvest moment (Wave 6 sends ~Tue/Wed 2026-05-26 → harvest ~Sun 2026-06-01).
Don't re-derive at harvest time — the present-self locked this in to
avoid decision fatigue.

Pattern source: `docs/wave-postmortems/wave-5-outcomes-tree.md`. This
adapts that to Wave 6's specific shape: 13 verified-email prospects
across 2 cities × 2 verticals (Bangkok dental, Singapore dental,
Bangkok spa, Singapore spa), all sent with `?variant=L` audit URLs.

---

## Wave 6 hypothesis snapshot (LOCKED 2026-05-22, before send)

| Hypothesis | Confirmed by | Falsified by |
|---|---|---|
| Wave 5's apparent open rate (64% looked like signal, was actually verification-batch contamination — true rate was ≤7%) was caused by Earth's own clicks, NOT prospect engagement | Wave 6 open rate stays low (≤15%) AND no clustering at known verification-batch timestamps | Wave 6 open rate clearly >25% across all prospects |
| Email-on-website (Wave 6) outperforms pattern-guessed-email (Wave 5) on deliverability | Wave 6 bounce rate ≤5% (vs Wave 5's 28.5%) | Wave 6 bounce rate >15% |
| Singapore SMB market responds better than Bangkok to cold outreach (premium positioning, English-fluent default) | Wave 6 SG opens (4 of 7 prospects = 57%) significantly outperform BKK opens (rate-wise) | SG opens and BKK opens roughly equal OR BKK > SG |
| Variant L audit-preview (low-friction lead, async-ask primary) converts opens→replies better than Wave 5's control/E | Wave 6 reply rate >0% (literally any reply, even "no thanks") | Wave 6 reply rate stays 0% |
| Dental + spa verticals together produce at least 1 conversion-quality reply | ≥1 reply that warrants conversation | 0 replies across all 13 |

Hypotheses 1-2 are SHIP-quality regardless of outcome (we learn how
to send better next time). Hypotheses 3-5 are CONVERSION-quality
(actual signal on whether ReviewHub is reachable).

---

## Outcome A — Wave 6 hits ≥1 reply

**Status:** First confirmed prospect engagement signal from ANY wave.
Wave 1-5 had 0 confirmed real opens (Wave 5's apparent opens were
verification-batch); Wave 6 with verified emails + Variant L is the
first clean test.

**What to do (immediately on seeing the reply):**

1. **Drop everything else.** Run `docs/skills/first-customer-playbook.md`.
   - Acknowledge within 30 min (3-sentence reply max).
   - Ask the smallest possible next question. Default: "Mind if I send
     a short async note about what was working / not working in the
     drafts? If yes I'll fire it now; if no, all good."
2. **Pause Wave 7 prep.** The first reply matters more than the next
   wave's prospects. The customer-dev pack at
   `docs/outreach/wave-5-customer-dev-packs.md` is your script.
3. **Note in `docs/reviewhub-wiki.md`:**
   - Which vertical converted (dental SG / dental BKK / spa SG / spa BKK)
   - Which prospect ID (D-SG-1, D-BKK-2, etc.)
   - The exact opening line of their reply (the cue for follow-up)
4. **Update `docs/strategy/post-wave-5-synthesis.md`** — the vertical
   + city combination that produced the reply becomes the priority
   for Wave 7 (5-10 more prospects in that combination).

**What NOT to do:**

- Don't celebrate publicly. Even "first prospect reply" tweets read as
  desperate until the customer ACTUALLY PAYS.
- Don't ship product changes "to make it perfect for them." They
  replied because what exists is enough.
- Don't pitch the other verticals in the conversation. Listen first.

**If ≥1 reply lands in Singapore AND ≥1 in Bangkok:**
- That's geography-agnostic signal — bigger than vertical-only signal.
- Plan Wave 7 with 5-10 prospects in BOTH cities, same verticals.

**If only Singapore replies fire:**
- Geography matters. Wave 7 = Singapore-only expansion + Singapore
  KL/Hong Kong analogues.

**If only Bangkok replies fire:**
- Geography matters the OTHER way (verified-email-on-website worked
  for the existing channel). Wave 7 = more Bangkok with same protocol.

---

## Outcome B — Wave 6 = high opens (>40%) but 0 replies

**Status:** Same shape as Wave 5 IF view counts are real (not
verification-batch contamination). Confirms audit-preview funnel is
the bottleneck, NOT the cold-email pitch.

**Diagnostic check FIRST:**

Before treating opens as signal, RUN THE VERIFICATION-CLUSTER CHECK:

```bash
node scripts/wave-diagnostic.mjs --wave=6 --stats=tmp/outreach-stats-2026-06-01.json
```

Look at the `first_viewed_at` timestamps. If they cluster within a
30-second window matching Earth's verification habits (e.g. all at
2026-05-26 21:51:XX), the opens are NOT prospects — they're Earth.

If clusters are detected: treat as Outcome C (deliverability
problem OR send-day verification-click contamination again).

If clusters are NOT detected (timestamps are spread organically over
days): proceed to Outcome B response below.

**What to do (true Outcome B confirmed):**

1. **Send Wave 6 followups** Tue 2026-06-02 / Wed 6-3 (9-11 AM
   ICT/SGT) using the vertical-specific templates from
   `docs/wave-postmortems/wave-5-followup-template.md`. One follow-up
   only. Industry recovery ~30-50%.
2. **In parallel: ship an audit-preview funnel diagnostic.** The
   `/admin/funnel` endpoint shipped in Phase 3 of this overnight
   session will tell you EXACTLY where on the audit-preview page
   prospects bounce (scroll-depth, time on page, CTA-click without
   conversion).
3. **Don't ship more variants until you watch Clarity replays of the
   opens.** Open `clarity.microsoft.com` → ReviewHub project →
   filter to the 5+ prospects whose audit URLs got opened during
   send window. Watch each replay. The behavior reveals which
   specific friction point lost them.
4. **Don't double down on email until audit-preview is fixed.** We're
   now 6 waves into "audit opens but doesn't convert" — the next
   experiment must be on the audit page itself, not on prospect
   volume.

**What NOT to do:**

- Don't pivot to a new channel (LINE/IG/cold-call) before exhausting
  the audit-preview iteration loop.
- Don't add product features.
- Don't ship more marketing surfaces.

---

## Outcome C — Wave 6 = <15% opens

**Status:** Deliverability OR audience problem confirmed.
Wave 5's verification-batch-corrected rate was ≤7%, so this just
confirms it persists.

**Diagnostic priority order:**

1. **Mail-tester sanity check.** Send a fresh test email from
   `earth.reviewhub@gmail.com` to a mail-tester.com inbox. Compare
   to the 2026-05-13 baseline (score 9.4/10).
   - If score dropped: sender reputation issue. Pause Wave 7,
     diagnose, possibly switch to a fresh sender domain.
   - If score holds: deliverability is fine, problem is audience or
     subject-line.
2. **Subject-line check.** Did the test variants A/B/C produce ANY
   difference in opens? Tag-back to send-sheet and group by subject.
   - If one subject CLEARLY outperformed: refine that for Wave 7.
   - If all three ≈ same: subject is not the lever — try a different
     cohort instead.
3. **Bangkok vs Singapore split.** Compare the 6 BKK opens vs the 7
   SG opens. If SG dramatically outperforms (e.g. 50%+ vs 0% BKK),
   the deliverability problem is Bangkok-specific (gmail.com →
   thai-domain emails may have a delivery issue, or Bangkok inboxes
   are saturated with cold pitches differently).
4. **Channel pivot consideration.** If audience + subject + sender
   are all fine but opens stay low → email is the wrong channel for
   the segment. Try LINE OA outbound (Earth-managed list) or warm
   intros via existing network.

**What NOT to do:**

- Don't send Wave 7 to prove deliverability — burns more prospects on
  a broken channel.
- Don't dismiss as "sample size too small." 0% open on 13 verified-
  email sends IS signal.

---

## Outcome D — 1 reply, but it's "not interested" or "wrong product"

**Status:** Engagement confirmed (they read enough to type a
sentence). Counts as a reply for hypothesis-5 purposes BUT the
actionable signal differs from Outcome A.

**What to do:**

1. **Reply once with multiple-choice curiosity:** "Thanks for the
   honest answer — genuinely useful. Mind if I ask: was it (a) wrong
   vertical, (b) wrong tool category, (c) wrong timing, or (d)
   already using something like this? No follow-up needed either
   way — just trying to learn what's a fit and what isn't."
2. **Record the answer.** Even 1 such response is more useful than 5
   more cold sends. Specifically:
   - If (a) wrong vertical → drop that vertical from Wave 7.
   - If (b) wrong tool → reposition the pitch.
   - If (c) wrong timing → schedule a 30-day check-in (not before).
   - If (d) already using something → ask which competitor; intel
     for the pricing page + battlecards.
3. **Continue treating Wave 6 as Outcome B/C** based on other prospect
   behavior — one "no thanks" doesn't refute the funnel hypothesis.

---

## Outcome E — 1 reply asking to schedule a call OR continue async

**Status:** Highest-value outcome (engaged + wants more).

**What to do:**

1. **Default to async** per `about_me_observed.md` (Earth's
   written-only preference). Reply within 24h, propose 2-3 questions
   back. Use the vertical-specific pack from
   `docs/outreach/wave-5-customer-dev-packs.md`.
2. **If they specifically ask for a call:** schedule within 24-48h,
   20 min cap. Don't prepare a deck — listen. Use the call to learn
   why they opened the audit, what they liked/didn't, what they
   currently do.
3. **End the call with a yes/no:** "Want to try ReviewHub free for
   30 days? Connect Google after, see the first auto-drafts on LINE
   tonight."
4. **If they say yes:** treat as first paying customer pipeline.

---

## Outcome F — Wave 6 manifest mismatch (0 prospects matched in diagnostic)

**Status:** Tooling problem, not signal.

**What to do:**

1. Open `/api/admin/outreach-stats` JSON output → grep for the Wave 6
   business names → check what business_name string actually exists
   in `audit_previews`.
2. Update `docs/outreach/wave-6-manifest.json` (TBD — create this
   structured manifest before sending; same pattern as
   `wave-5-manifest.json`).
3. Rerun the diagnostic.

Going forward: create the wave-N-manifest.json BEFORE sending, not
after.

---

## What this doc is NOT

- **Not a substitute for Earth's judgment.** Pre-committed branches
  are defaults. If a reply has a quirky shape (e.g. "we'd pay $100/mo
  if it also did X"), Earth's read of the prospect beats any
  pre-written branch.
- **Not the playbook itself.** This doc says "which branch to enter."
  The playbooks (first-customer-playbook.md, customer-dev-packs.md,
  followup-template.md) say "what to do inside the branch."
- **Not exhaustive.** Outcomes G-Z exist. The named branches cover
  ~85% of likely outcomes. Anything outside named branches gets
  Earth's full attention, not a rote response.

---

## When to update this doc

- **BEFORE Wave 6 result-harvest:** lock the hypothesis matrix above.
  Don't re-derive at harvest time.
- **DURING result-harvest:** don't update. Read once, execute the
  branch, no edits.
- **AFTER Wave 6 closes (full followup window passed, ~2026-06-08):**
  update the hypothesis matrix with what was confirmed / falsified.
  Carry forward to wave-7-outcomes-tree.md.
