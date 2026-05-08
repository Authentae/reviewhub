# Wave 4 +5-day follow-up template

For Wave 4 prospects who opened the audit URL but didn't reply.
Send 5 days after original (so Tue 5/12 sends → follow-up Sun 5/17;
Wed 5/13 sends → follow-up Mon 5/18). One follow-up only — never
two. After this, drop and move on.

**Industry recovery on a single follow-up is 30-50%.** Worth the
3-min compose time per prospect.

**Source pattern:** `docs/wave-postmortems/wave-2-followups-monday.md`
(the Old Capital / Loftel / Chakrabongse template that's already
proven). This file generalizes it for Wave 4's 12 prospects.

---

## Pre-send rules

- **Reply to the original thread** (don't start a new one) — preserves
  the audit URL context the prospect already saw
- **Sender:** earth.reviewhub@gmail.com (brand account)
- **Send window:** Tue/Wed 9-11am ICT (matches what worked in Wave 2)
- **Skip if:** prospect REPLIED to original send — that's a Wave 4
  conversion, run `docs/skills/first-customer-playbook.md` instead
- **Skip if:** audit URL view count is still 0 after 5 days — they
  never opened, follow-up won't move them. Drop and move on.
- **Tone rule (TH):** no power claims (`ไม่กดดัน` calques). Soft +
  invite "ไม่ใช่" as a valid response.

---

## Thai template — for any of the 9 TH Wave 4 prospects who opened-no-reply

```
สวัสดีครับ

ติดต่อกลับมาสั้น ๆ — เห็นว่าเปิด audit URL ที่ส่งไปเมื่อ {SEND_DATE_RELATIVE}
แต่ยังไม่ได้ตอบกลับมา อยากถามตรง ๆ ว่า draft คำตอบที่ AI ร่างให้พอใช้ได้ไหมครับ
หรือมีตรงไหนที่รู้สึก "ไม่ใช่"

ถ้าโทนคำตอบไม่ตรงกับสไตล์ของ {PROPERTY_NAME} — บอกได้เลย ปรับให้
ถ้าใช้ได้แต่ตอนนี้ยุ่ง — URL ยังใช้ได้อีก {DAYS_REMAINING} วัน เอาไปก๊อปวางเองตอนสะดวกก็ได้
ถ้าไม่ใช่ทางที่ใช่เลย — ตอบแค่ "ไม่ใช่" ก็พอครับ ไม่กวนต่อ

ฟีดแบ็กตรง ๆ ช่วยผมพัฒนาเครื่องมือที่เหมาะกับ {VERTICAL_DESCRIPTOR} จริงมากกว่าการเงียบครับ

ขอบคุณครับ
Earth
```

### TH substitutions

- `{SEND_DATE_RELATIVE}` — examples: `วันก่อน` (general "the other day"),
  `เมื่ออาทิตย์ก่อน` (last week), `เมื่อ 5 วันก่อน` (5 days ago).
  Pick whichever sounds most natural.
- `{PROPERTY_NAME}` — exactly as on Google. Don't translate.
- `{DAYS_REMAINING}` — count from `audit_previews.expires_at`
  minus today. Audit URLs expire 35 days after creation; if sent Tue
  5/12, remaining ~28 days at follow-up time.
- `{VERTICAL_DESCRIPTOR}` — pick one that matches the prospect:
  - "ที่พักเล็ก ๆ ในกรุงเทพฯ" (small accommodation in Bangkok) — for
    Lamphu Tree, Lamphu House, Baan 2459, Bangkok Voyage, Baan Vajra
  - "โรงแรมบูทีคในกรุงเทพฯ" (boutique hotels in Bangkok) — for Lilit,
    Volve, IR-ON, Methavalai
  - "ที่พักแบบ wellness ในกรุงเทพฯ" (wellness accommodations in Bangkok)
    — for Raweekanlaya specifically

---

## English template — for the 3 EN Wave 4 prospects who opened-no-reply

(Public House #8, Nouvo City #7, and any Wave 4 prospect flipped to EN
during verification.)

```
Hi {FIRST_NAME_OR_BLANK},

Quick follow-up — saw the audit URL got opened {DAYS_AGO} days ago but no
reply, wanted to check in. Was the draft tone off, or just busy week?

If the drafts felt off-brand for {PROPERTY_NAME}, let me know what
you'd want different — happy to regenerate.
If you liked them but haven't had time, the URL stays live for another
{DAYS_REMAINING} days — copy any of them into Google whenever.
If it's just not the right tool — a one-word "no" is plenty. I won't
chase it.

Direct feedback helps me build the right thing for independent boutique
hotels in Bangkok more than silence does.

— Earth
```

### EN substitutions

- `{FIRST_NAME_OR_BLANK}` — e.g., "Paul" for Public House (Sachdev),
  blank for Nouvo (no first name surfaced). Wrong name beats no name;
  drop if uncertain.
- `{DAYS_AGO}` — usually "5", calculated from original send date
- `{PROPERTY_NAME}` — exactly as on Google; don't translate
- `{DAYS_REMAINING}` — same calculation as TH

---

## What to do after the follow-up window closes

For each prospect, by Mon 5/19 (one week after follow-up sent):

| Outcome | Action |
|---|---|
| Replied to original or follow-up | Run first-customer-playbook.md |
| Opened original + opened follow-up + no reply | Move to "warm but stuck" cohort. Do NOT email a third time. Re-engage via X (organic) or LINE (1:1) only after 30+ days. |
| Opened original + did NOT open follow-up + no reply | Cold prospect. Drop. Don't add to lists. |
| Never opened either | Drop. Email channel was wrong for this prospect. Don't retry email. |
| Replied "no" / negative | Thank them once for the candor. Log in `docs/skills/audit-outreach.md` pricing-objection journal if applicable. Drop. |

---

## What this template does NOT do

- **Doesn't add a new pitch.** Don't introduce a discount, a new
  feature, a "limited time" frame. The original email made the offer;
  the follow-up checks if they're stuck on it. New pitches in
  follow-ups read as desperate (and Wave 1 lesson: desperation kills
  reply rate more than cold-pitch does).
- **Doesn't reference response-rate stats.** ("Most owners reply
  within X days" / "Hospitality industry average is..."). Reads as
  shaming. Skip.
- **Doesn't ask for a meeting.** The original email already invited a
  10-min call. The follow-up just opens the door for a "yes" or
  "no" — meeting offers come AFTER they say yes.
- **Doesn't add a P.S. line.** P.S. on cold/follow-up emails reads as
  "I have a manipulative copy template." Wave 2 follow-ups don't use
  one; Wave 4 shouldn't either.
