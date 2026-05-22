# Wave 6 +7-day follow-up template

For Wave 6 prospects who opened the audit URL but didn't reply.
Send 7 days after the original (Wave 6 sends 2026-05-26/27 →
follow-ups 2026-06-02/03, 9-11 AM ICT/SGT).

**One follow-up only. Industry recovery on a single follow-up is 30-50%.**
After this, drop and move on.

Pattern source: `docs/wave-postmortems/wave-5-followup-template.md`.
Adapted for Wave 6's vertical mix (dental + spa across Bangkok +
Singapore).

---

## Pre-send rules

- **Reply to the original Wave 6 thread** (don't start new).
  Preserves the audit URL context.
- **Sender:** `earth.reviewhub@gmail.com` (brand account).
- **Send window:** Tue 2026-06-02 or Wed 2026-06-03, 9-11 AM
  ICT/SGT.
- **Skip if:** prospect replied to the original — that's a Wave 6
  conversion, run `docs/skills/first-customer-playbook.md`.
- **Skip if:** audit URL view count is still 0 after 7 days. They
  never opened. One follow-up won't change that. Drop.
- **Skip if:** the audit URL returns non-200 (verify with curl -I).
  Don't re-surface a dead link.
- **Run the verification-cluster check FIRST** via
  `/api/admin/funnel?from=2026-05-26&to=2026-05-27` — if all "opens"
  cluster within a verification batch, NONE of these prospects
  actually opened and the followup is wasted. Confirm the
  cluster-check shows organically-spread timestamps before sending
  ANY followups.

---

## How to pick the right variant

Each follow-up references the original subject's framing (Variant A
"observation" / Variant B "direct benefit" / Variant C "question").
Match the original — don't switch styles mid-thread.

Use `docs/outreach/wave-6-send-sheet.md` to find which subject variant
each prospect got.

---

## Variant A (observation) — followup template

For prospects sent with Variant A subject lines (D-SG-1, D-SG-4,
D-BKK-3, S-SG-3, S-BKK-3).

**Subject:** Re: [original] (auto-prepended by Gmail Reply)

**Body:**
```
Hi,

Quick follow-up — noticed you opened the audit link last week but
didn't reply. Totally understand if it's not a fit.

One direct question: did the drafts capture the {voice anchor —
e.g. "named-trainer pattern", "Eastern + Western positioning",
"Mandarin-friendly tone"}, or did they read generic?

If they missed the mark, I want to know what was off (too formal?
wrong tone? missed a specific detail your reviews always include?).
If it's "not for us right now," that's a perfectly valid answer —
no follow-up either way.

Thanks for the time.
ReviewHub · reviewhub.review
```

**Per-prospect specifics for voice anchor:**

| Prospect | Voice anchor in followup |
|---|---|
| D-SG-1 TP Dental | the after-hours availability + named-doctor pattern |
| D-SG-4 An Dental | the Eastern + Western positioning + named-specialist pattern |
| D-BKK-3 Keishikai | the named-dentist (Dr Udom / Dr Torsak / Dr Malinee) pattern |
| S-SG-3 Privilège | the EN + ZH language-matching for Mandarin-friendly reviews |
| S-BKK-3 ZENVANA | the Talingchan wellness-not-pampering tone |

---

## Variant B (direct benefit) — followup template

For prospects sent with Variant B subject lines (D-SG-2,
D-BKK-1, S-SG-1, S-BKK-1).

**Subject:** Re: [original]

**Body:**
```
Hi,

Following up briefly — saw you opened the drafts last week but no
reply yet. Either you're slammed (totally understand) or the
drafts didn't land. If it's the latter, I'd love a one-line answer
to one of these:

  - "Too {formal/casual/generic} — the tone is wrong for {our
    brand}"
  - "{Specific detail — therapist names / doctor names} were
    generic — we name them in our replies"
  - "We already use {tool/agency} for this"
  - "Not interested right now"

Any of those is genuinely useful — silence is the one signal I
can't decode. Won't follow up again either way.

Thanks for the time.
ReviewHub · reviewhub.review
```

**Per-prospect specifics:**

| Prospect | "Our brand" detail | "Specific detail" replacement |
|---|---|---|
| D-SG-2 Pacific Dental | Scotts Medical Centre dental practice | named-doctor + treatment-type |
| D-BKK-1 Smile Signature | Sukhumvit international-patients flagship | named-dentist + international-patient context |
| S-SG-1 Serena Spa Orchard | Marriott boutique spa | therapist name + signature treatment |
| S-BKK-1 Loft Thai | Phra Khanong World-Champion-Therapists spa | therapist name + specific technique |

---

## Variant C (question framing) — followup template

For prospects sent with Variant C subject lines (D-SG-3,
D-BKK-2, S-SG-2, S-BKK-2).

**Subject:** Re: [original]

**Body:**
```
Hi,

Quick follow-up. Noticed you opened the audit URL but didn't reply
— that's the most common response so far, which tells me something
about the offer that's not landing yet.

One question: if you HAD replied, what would the next line have
been? Genuinely curious. Even "we don't reply to reviews and
that's the plan" is useful data. So is "the drafts read too
{generic / formal / casual} for {our brand}."

If "not interested" — that's fine, no follow-up either way.

Thanks for the time.
ReviewHub · reviewhub.review
```

**Per-prospect specifics:**

| Prospect | "Our brand" detail |
|---|---|
| D-SG-3 Dentalis | a 25-year founder-led Tanjong Pagar clinic |
| D-BKK-2 SmileBox | a 3-chair Thonglor boutique opened 2021 |
| S-SG-2 La Source | a Voco Orchard holistic spa |
| S-BKK-2 Su Esthetic | a 2004-era Korean spa with 6-guest sessions |

---

## What if the prospect REPLIED to the original (not opened-no-reply)?

Don't send the follow-up — they're already engaged. Switch to
`docs/outreach/wave-5-customer-dev-packs.md` (vertical-specific
question pack) for the conversation. The pack works for Wave 6
prospects too; same verticals, same patterns.

---

## After follow-up — what to record

Append to `docs/wave-postmortems/wave-6-follow-up-log.md` (create
if not exists) per prospect:

```
{date sent}  {prospect_id}  {variant_used}  {result_within_5_days}
```

Results: `replied / no-reply / not-interested / scheduled-call /
out-of-office-bounce`.

Aggregate follow-up reply-rate after 2026-06-08 (close of follow-up
window). Industry expects 30-50%. ReviewHub at 0-15% suggests the
follow-up angle itself is weak; 50%+ suggests the cold open is the
bottleneck (audit-preview is fine).

---

## What this template is NOT for

- First-time cold sends — use Wave 6 send sheet
- Re-pitching after a "no thanks" reply — respect the no
- Second / third followups — one only, never two
- Prospects who NEVER opened the audit — they're a different
  cohort; their failure mode is deliverability or subject-line, not
  pitch. Investigate those separately.
