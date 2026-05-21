# Wave 5 +7-day follow-up template

For Wave 5 prospects who opened the audit URL but didn't reply.
Send 7 days after original (Wave 5 sends 2026-05-19/20 → follow-ups
Tue 2026-05-26 / Wed 2026-05-27, 9-11 AM Bangkok).

**One follow-up only. Industry recovery on a single follow-up is 30-50%.**
**Worth the 3-min compose time per prospect.**

After this follow-up, drop and move on. Don't double-follow.

Pattern source: `docs/wave-postmortems/wave-4-followup-template.md`.
Adapted for Wave 5's vertical mix (muay thai / spa / coffee / dental).

---

## Pre-send rules

- **Reply to the original thread** (don't start a new one) — preserves
  the audit URL context the prospect already saw.
- **Sender:** `earth.reviewhub@gmail.com` (brand account — NOT
  theearth1659@gmail.com).
- **Send window:** Tue/Wed 9-11 AM ICT (the proven open-rate window
  from Wave 2-4 data).
- **Skip if:** prospect replied to the original — that's a Wave 5
  conversion, run `docs/skills/first-customer-playbook.md` instead.
- **Skip if:** audit URL view count is still 0 after 7 days — they
  never opened. One follow-up won't change that. Drop.
- **Skip if:** the audit URL is broken / 404 (verify with curl -I).
  Don't send a follow-up that re-surfaces a dead link.
- **Identify the EXACT view-count moment** in the body. Owners notice
  "saw you opened it Tue at 6pm" — proves attention beats cold script.

---

## How to pick the right template

Run `node scripts/wave-diagnostic.mjs --wave=5 --stats=<json>` first.
The output's "Followup candidates" section lists opened-no-reply
prospects with their vertical. Use the vertical-specific template
below.

---

## Muay Thai variant (English)

For Chuwattana / Eminent Air / Luktupfah / Rithirit / Master Toddy
who opened the audit URL but didn't reply.

```
Hi {Master/Khun} {NAME},

Quick follow-up — I noticed you opened the audit link last week but
didn't get a chance to reply. Totally understand if it's not a fit;
just wanted to ask one direct question:

Were the AI-drafted replies in your style, or did they read
generic-corporate?

That's the only thing I'm trying to learn from gym owners right now —
whether the voice matches what you'd actually post. If it didn't, I
want to know what was off (too formal? wrong English? missed your
fighters-by-name pattern?).

If it's a "not for us right now," that's a perfectly valid answer
too — I won't follow up again either way.

Thanks for taking the look,
Earth
reviewhub.review
```

**Why this works:** the cold ask is "tell me what was wrong with my
drafts." That's lower-pressure than "want to buy?" and most owners
will answer it honestly because it costs them nothing and feels like
helping.

---

## Spa variant (English)

For CORAN / Dahra / Infinity / Preme / Treasure who opened-no-reply.

```
Hi {NAME},

Following up — saw you opened the audit link last week, but no reply
yet. Either you're slammed (totally understand) or the drafts didn't
land. If it's the latter, I'd love a one-line answer to one of these:

  - "Too formal — Thai guests don't want that tone"
  - "Therapist names were generic — we list ours in replies"
  - "We already use {tool/agency} for this"
  - "Not interested right now"

Any of those is genuinely useful for me. I'm trying to learn what
makes review replies feel right vs wrong for boutique-spa voices, and
the silence is the one signal I can't decode.

Won't follow up again either way.

Thanks for the time,
Earth
reviewhub.review
```

**Why this works:** multiple-choice ask. Owners who'd never type a
paragraph WILL pick one of four bullets. Surfaces objection categories
even on "no" replies — which is the diagnostic data we actually need.

---

## Coffee variant (English)

For Ink and Lion / Ceresia / etc.

```
Hi {NAME},

Quick follow-up. Noticed you opened the audit URL but didn't reply —
that's the most common response so far, which tells me something about
the offer that's not landing.

One question: if you HAD replied, what would the next line have been?
Genuinely curious. Even "we don't reply to reviews and that's the
plan" is useful data.

If "not interested" — that's fine, won't follow up again.

Cheers,
Earth
reviewhub.review
```

**Why this works:** acknowledges the silence as data. Doesn't pretend
the silence is a misunderstanding to be cleared up. Most owners
respect the directness.

---

## Dental variant (English)

For the verified dental prospects who opened-no-reply.

```
Hi Dr. {NAME},

Following up briefly — saw you opened the audit link last week. No
reply, totally fine; just wanted to ask one thing before I close the
loop.

Was the issue (a) AI tone wrong for a clinic, (b) PHI / patient-
privacy concern, (c) already using a tool for this, or (d) just not
a priority?

Any of those answers is more useful than my guesses. I'm trying to
understand whether dental practices are a fit for what I'm building
or whether the category is wrong.

No follow-up after this either way.

Thanks for the time,
Earth
reviewhub.review
```

**Why this works:** dental has specific objections (PHI, compliance)
that the multiple-choice surfaces directly. If the answer is (b), that
becomes a positioning input for the /for-dentists page.

---

## Thai variant (for any TH-default prospect)

For any prospect where the original was sent in Thai (verify in sent
folder before using).

```
สวัสดีครับ

ติดต่อกลับมาสั้น ๆ — เห็นว่าเปิด audit URL ที่ส่งไปเมื่อสัปดาห์ที่แล้ว
แต่ยังไม่ได้ตอบกลับมา ไม่กดดันครับ — แค่อยากถามตรง ๆ ว่า:

draft คำตอบที่ AI ร่างให้ ใช้ได้จริงไหม
หรือมีตรงไหนที่อ่านแล้วรู้สึก "ไม่ใช่"

ถ้าไม่ตอบกลับ ก็เป็นคำตอบที่ใช้ได้ครับ — ไม่ส่งติดตามอีก

ขอบคุณที่สละเวลาดู
Earth
reviewhub.review
```

**Tone note:** "ไม่กดดัน" was banned in `feedback_thai_pragmatics.md`
as a calque. Reconsider — in this specific follow-up context (NOT
cold-open), it reads less power-claim and more apologetic. Earth's
call. If still wrong, drop the whole "ไม่กดดันครับ" line.

---

## What to send if the prospect IS replied-marked but we never saw an actual email reply

This happens when Earth marks-replied for "they replied on LINE / IG
DM / phone." That's a Wave 5 conversion → don't follow up; run the
first-customer playbook.

---

## Tracking after follow-up

For each follow-up sent, record in `docs/wave-postmortems/wave-5-follow-up-log.md`:

- Prospect name
- Variant used (muay thai / spa / coffee / dental / TH)
- Date sent
- Result: replied (within 5 days) / no-reply / "not interested" / "schedule call"

The follow-up reply-rate is its own data point. Industry expects
30-50%. ReviewHub at 0-15% would suggest the followup angle itself is
weak; at 50%+ would suggest the cold open is the bottleneck (not the
offer).

---

## What this template is NOT for

- **First-time cold sends to new prospects.** Use the cold-outreach
  templates in `docs/outreach/wave-5-drafts.md`.
- **Re-pitching after a "no thanks" reply.** Respect the no. Move on.
- **Second / third followups.** One follow-up only. Don't burn the
  relationship.
- **Wave 5 prospects who never opened.** Those are deliverability or
  audience problems, not pitch problems. Different fix path.
