# Audit-preview CTA variants — Scenario A spec

Drafted 2026-05-08 to unblock Week 2 of the 30-day strategy. If Tuesday
5/12 Wave 2 follow-ups land 0 replies + Wave 4 sends Wed produce
opens-but-no-replies, **the audit-preview page is the conversion
bottleneck.** This doc gives Earth ready-to-ship copy variants so the
A/B test can fire by end of Week 2 without copy-write delay.

## What the test answers

The Wave 2 result was 3/3 opens, 0/3 replies. Two hypotheses:

1. **The audit URL itself is the bottleneck.** The page shows drafts but
   the CTA copy isn't compelling enough to move the prospect from
   "neat" to "I want this." → CTA copy variant.
2. **The pitch is wrong upstream.** The email convinced them to look,
   but the offer (paid SaaS at $14/mo) doesn't match what they thought
   they were signing up for. → email body, not CTA, is the issue.

We can only test (1) by varying CTA. If (1) doesn't move the needle on
Wave 4-5 view→click rate, (2) is more likely and email body needs
work.

## Current CTA (control — variant A)

**Surface:** `client/src/pages/AuditPreview.jsx`, lines ~200-235.

```
[eyebrow]  Want this on autopilot?
[headline] Set this up for {business_name} in 10 minutes
[body]     Connect Google once. New reviews land — ReviewHub drafts
           a reply in your voice. You approve with one click; it posts
           to Google. Replies that took 30 min each take 30 seconds.
           $14/mo (~฿490).
[button]   Yes, set this up for me →
[micro]    No credit card to start · 14-day refund window · cancel
           anytime
```

**Plausible event:** `AuditRegisterClick` (already wired).

---

## Variants (B-E)

Pick 1 to ship as a 50/50 A/B split alongside the control. **Don't run
all four.** ~20 audits sent (Wave 4 + 5) is the minimum N to read the
signal.

### Variant B — "Autopilot framing"

Removes the "set this up" verb-imperative. Names the mechanism the
prospect just experienced (the AI drafted these for them) and offers
to keep doing it.

```
[eyebrow]  Liked these drafts?
[headline] Have ReviewHub draft these next time, automatically
[body]     This was a one-time audit. Connect your Google profile and
           the same AI drafts a reply for every new review — in your
           voice, in the reviewer's language. Approve with one click;
           it posts. $14/mo (~฿490).
[button]   Get this on autopilot →
[micro]    No card · 14-day refund · cancel anytime
```

**Hypothesis:** the current "set this up for me" wording asks them to
*do* something. "Have ReviewHub draft these" lets the brand do something
*for* them. Lower commitment perception, higher click rate.

**Plausible event:** add `AuditRegisterClick_AutopilotV` for distinct
tracking.

### Variant C — "Time saved"

Leads with the owner's pain (replies take time) and the math.

```
[eyebrow]  Replies that took 30 minutes
[headline] Save 30 minutes per review for {business_name}
[body]     A thoughtful, on-brand reply usually takes 5-30 minutes.
           ReviewHub drafts one in 5 seconds — in your voice, ready to
           approve. Connect Google once. Pay $14/mo (~฿490) when it
           saves you the 5th hour.
[button]   Save me the time →
[micro]    No card · 14-day refund · cancel anytime
```

**Hypothesis:** price anchored to time-saved (5 hours) reads as ROI,
not cost. Best for owners who already feel the time problem (matches
200+-review audience hypothesis).

**Plausible event:** `AuditRegisterClick_TimeV`.

### Variant D — "Soft + reciprocity"

Acknowledges the audit was free and offers a low-friction next step.
For prospects who feel "what's the catch?" pressure on the current CTA.

```
[eyebrow]  These drafts are yours
[headline] Like them? The first month is on us.
[body]     The drafts above are free — copy and paste them into Google
           if you'd rather not sign up. If you do connect ReviewHub,
           the first month is free. After that it's $14/mo (~฿490).
           Cancel anytime, no card to start.
[button]   Start the free month →
[micro]    Free for 30 days · cancel anytime · no card now
```

**Hypothesis:** Wave 2 saw 3/3 opens but 0 replies. "Free first month"
removes the perceived risk of signing up for a paid tool to test it.
**Caveat:** introduces a free trial which the codebase explicitly
killed (`memory/project_reviewhub_pricing.md` says trials are dead).
Need product decision before shipping. **Skip unless Earth re-opens
the trial question.**

### Variant L — "Low-friction lead" (shipped 2026-05-21)

**Hypothesis being tested:** the price tag ($14/mo) entering the
viewport too early in the trust journey causes the 35%-open / 0%-reply
gap across Waves 1-4. By demoting the paid CTA below the founder card
and elevating async-ask (LINE + email) to PRIMARY, the prospect's
first action becomes commitment-free.

**Surface:** `client/src/pages/AuditPreview.jsx` — inverts the
existing CTA section structure when `ctaVariant === 'L'`.

```
[eyebrow]  Drafts above are yours — keep them either way
[headline] Anything off, or a fit for {business_name}?
[body]     I'm Earth — solo founder, Bangkok. A one-line "this draft
           missed the mark" or "looks good but we already use X" is
           genuinely useful either way. No call, no signup — just
           async chat.

[PRIMARY button]   💬 Chat on LINE
[PRIMARY button]   ✉ Email Earth

[founder card]     I reply within a day, async. You're one of the
                   first 30 prospects — I'm watching this inbox.

[secondary link]   Already convinced? Skip the chat:
                   Set it up for $14/mo (~฿499) →
                   (small, low-contrast, framed as opt-in not buy-now)
```

**Sticky bar copy (matches the variant):**

```
Anything off, or a fit? · A one-line "yes / no / wrong fit" is
genuinely useful.
[button]  💬 Chat on LINE  (green, primary)
```

The sticky CTA target SWAPS from Stripe checkout to LINE deep-link —
that's the test's core: never put the price in the viewport before
the prospect chooses to engage.

**Plausible event names** (per variant; lets us split funnels):
- Main CTA, LINE click   → `AuditLineChatClick_LowFriction`
- Main CTA, email click  → `AuditFounderReplyClick_LowFriction`
- Secondary Stripe       → `AuditRegisterClick_LowFriction`
- Sticky LINE click      → `AuditLineChatClick_LowFriction` (source=sticky disambiguates)

**URL override:** `?variant=L` appended to any audit-preview share URL
forces this variant. Use this for Wave 5.5+ retargeting where Earth
wants specific prospects to see L (e.g. the highest-opener vertical
from Wave 5 result-harvest). Without the override, ~1/3 of NEW share
tokens get assigned L randomly via `assignCtaVariant` hash.

**When to ship beyond Wave 5.5:**

- If L's reply-rate > control's by 2+ replies across ≥10 L-tagged sends
  → make L the new control, replace mod-3 hash with new structure
- If L's reply-rate ≤ control → the bottleneck isn't price-in-viewport.
  Investigate: audience quality, email subject line, audit page load
- If L produces "talked to Earth" conversations but no paid conversions
  → the offer or pricing itself is the issue, not the funnel

**Smallest hint of success worth keeping L permanent:** even ONE reply
within 5 days of an L-tagged send (vs 0 across 22 control sends in
Waves 1-4). Statistical significance at this sample size is impossible;
binary qualitative signal is.

---

### Variant E — "Permission-asking"

Lower-pressure entry. Reads less like "buy" and more like "let us
help."

```
[eyebrow]  This audit was free
[headline] Want ReviewHub to keep drafting for {business_name}?
[body]     Connect Google once. Every new review gets a draft reply
           in your voice — you approve, we post. $14/mo (~฿490). The
           drafts above stay yours regardless of what you decide.
[button]   Yes, keep the drafts coming →
[micro]    No card to start · 14-day refund · cancel anytime
```

**Hypothesis:** "Yes, keep the drafts coming" is a softer click than
"Yes, set this up for me." Reads as opt-in to a service we're already
providing, not a new commitment.

**Plausible event:** `AuditRegisterClick_PermissionV`.

---

## Recommended A/B pair

If picking ONE variant to ship against control:

→ **Variant E (Permission-asking).** Reasons:
- Closest in structure to control → cleaner A/B (one variable changed)
- No pricing-model change required (vs Variant D's free trial)
- Specifically addresses the Wave 2 pattern: opens but no replies =
  "interested but not ready to commit"
- Microcopy stays identical ("No card to start...")

If Earth wants a more aggressive contrast: **Variant B (Autopilot)** —
bigger semantic distance from control, will produce a clearer signal
with the same N.

## Implementation note

The page currently has ONE CTA block. To A/B:

1. Add a variant flag based on `auditPreview.id % 2` (or query param
   on the share-token URL) to deterministically assign each audit to
   A or B
2. Render either control or variant block based on flag
3. Distinct Plausible event name per variant (already noted above)
4. Log the variant assigned to the `audit_previews` table — adds a
   `cta_variant` column (`'control'` or `'B'`/`'E'`/etc.)

Code-side ship is ~30 min. Don't ship until Tuesday's data confirms
Scenario A — premature otherwise.

## After 20 audits sent

Read the click-through rate per variant via Plausible:

- Control: AuditRegisterClick / AuditPreview-views
- Variant: AuditRegisterClick_{V} / AuditPreview-views with variant flag

Statistical floor: 20 audits per arm × ~80% open rate (Wave 2 baseline)
= ~16 viewers per arm. With a 5%+ click-rate delta, the test reads
clean enough to commit.

If both arms hit 0% click rate → upstream pitch problem (email body),
not CTA. Drop CTA work, rewrite email.

If control beats variant → ship the variant *language* back to the
email subject + body. Variant-winning CTAs often work as cold-email
hooks too.
