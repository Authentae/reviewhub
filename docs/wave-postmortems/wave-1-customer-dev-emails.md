# Wave 1 customer-dev outreach — 9 emails to send

Wave 1 (2026-05-04, mixed-vertical) had 1/9 opens and 0 replies.
The "audience problem" framing is partly right but we're flying
blind on WHY 8 of 9 didn't open. Best way to find out: ask them.

These aren't sales emails. They're customer-development emails —
short, no pitch, asking for honest "what would have made this
useful" feedback. The goal is **information**, not conversion.

If even 2-3 of 9 reply with real reasons, we get more strategic
signal than another full Wave 4 send.

**Send timing:** Tue 5/12 morning, after Wave 2 follow-ups go out.
Same morning is fine — these are different threads, no risk of
inbox fatigue.

**Pre-send check:**
- Each is a NEW email, NOT a reply to the original thread
- Subject line: short, no audit-URL reference (we want them to
  read the email, not see "ah, the audit thing again")
- Send from earth.reviewhub@gmail.com (brand account)

---

## Common template (customize the bracketed bits per recipient)

```
Subject: Quick question — 30 seconds

Hi {first_name or "there"},

I sent you a Google reviews note last week — totally fine if it
wasn't relevant. Not following up to pitch.

Genuine question: when small-business outreach about review tools
lands in your inbox, what makes you delete vs read? I'm trying to
understand what actually helps Bangkok {vertical} owners and
the "I deleted it because…" answers are more useful to me than
any of the yeses.

One sentence is enough. Or "didn't see it" — that's also data.

Thanks either way,
Earth
ReviewHub (made-in-Bangkok side project)
```

---

## Per-prospect adaptations

Pink Chili (the only opener) gets a slightly different version
because we KNOW they engaged. The other 8 get the standard
template above.

### 1. Pink Chili Thai Cooking School (Wave 1 SOLE OPENER, 4 views)

**Send TH (we have email in Thai presumably).**

```
Subject: คำถามสั้นๆ ครับ — 30 วินาที

สวัสดีครับ

อาทิตย์ก่อนผมส่ง audit คำตอบรีวิว Google ไปให้ — เห็นว่าเปิดดูหลาย
ครั้งแต่ไม่ได้ตอบกลับมา ไม่ได้ติดต่อมาขายของครับ

อยากถามตรงๆ: ในเมื่อเปิดดูแล้ว มีอะไรที่ทำให้ตัดสินใจไม่ตอบกลับ?
คือ draft คำตอบที่ AI ร่างให้ไม่เข้า / ราคาไม่ใช่ / ไม่ใช่จังหวะ /
หรือมีอย่างอื่น?

ผมเข้าใจดีว่าโรงเรียนทำอาหารกับร้านอาหารทั่วไปอาจต้องการเครื่องมือ
ที่ต่างกัน — feedback แบบ "ไม่เอาเพราะ..." จะช่วยผมพัฒนาเครื่องมือ
ให้เหมาะกับเจ้าของร้านในกรุงเทพฯ มากขึ้น

ตอบประโยคเดียวก็พอครับ
Earth
ReviewHub (โปรเจกต์เล็กๆ ในกรุงเทพฯ)
```

### 2. House of Taste Thai Cooking School (didn't open)
**TH email, standard template.** {vertical} = "โรงเรียนทำอาหาร"

### 3. Tingly Thai Cooking School (didn't open)
**EN email, standard template.** {vertical} = "Thai cooking school"

### 4. Sweets Cottage Academy (didn't open)
**TH email, standard template.** {vertical} = "โรงเรียนสอนทำขนม"

### 5. May Kaidee Tanao Vegetarian (didn't open)
**EN email, standard template.** {vertical} = "vegetarian restaurant"

### 6. White Ivory B&B (didn't open)
**EN email, standard template.** {vertical} = "B&B"

### 7. Vera Nidhra B&B (didn't open)
**EN email, standard template.** {vertical} = "B&B"

### 8. Better Moon Guesthouse & cafe (didn't open)
**TH email, standard template.** {vertical} = "เกสต์เฮาส์/คาเฟ่"

### 9. Aim House Bangkok Hotel (didn't open)
**EN email, standard template.** {vertical} = "small hotel"

---

## Skip: Baan Sukhumvit Inn

Email bounced (`baansukhumvit@yahoo.com — Address not found`).
They never received the original. Don't follow up — we have no
relationship to follow up on.

---

## Monday morning execution protocol (15 min)

Wave 2 follow-ups are already drafted in Gmail (Drafts folder,
3 emails). Wave 1 customer-dev wasn't drafted because Gmail's SPA
fought programmatic recipient-extraction. Monday morning, do this:

1. Open **earth.reviewhub@gmail.com** (Gmail account /u/5)
2. Open the **Sent** folder
3. Filter to May 4: `in:sent after:2026/5/3 before:2026/5/5`
4. For each of the 9 prospects (skip Baan Sukhumvit — bounced):

   Click the original sent thread → copy the recipient email
   (right side of the thread header) → open a new compose
   (`c` keyboard shortcut) → paste recipient → paste subject
   "Quick question — 30 seconds" → paste body from the
   template above (TH for Pink Chili / House of Taste /
   Sweets Cottage / Better Moon, EN for the other 5)

   ~90 sec per prospect × 9 = ~14 min

5. Save each as draft (Gmail auto-saves; just close the compose)

6. **Send all together** Tue 9-11am ICT (after the 3 Wave 2
   follow-ups go out). Different recipients, no inbox-fatigue
   risk.

**Do this BEFORE the Wave 4 verification work** — customer-dev
information takes priority because it shapes Wave 4 targeting.
If 3+ Wave 1 cohort reply with "I use ChatGPT" or "I never check
this email," Wave 4's channel/audience strategy needs to update.

## What to do with replies

Aggregate every reply (or "didn't see it" / "deleted because…")
into `docs/wave-postmortems/wave-1-cooking-schools.md` under a
new section "Customer-development findings (2026-05-12+)."

Look for clusters:
- 3+ saying "subject line looked spammy" → fix subject line
- 3+ saying "I don't reply to reviews so the tool doesn't help me" →
  audience-fit confirmed wrong, drop verticals from Wave 4 target list
- 3+ saying "I use ChatGPT" → ChatGPT competition is real
- Mixed/no pattern → the "8/9 didn't open" was just channel/timing
  noise, no strategic insight to harvest

Don't generalize from N=2. Need 3+ in the same direction to act.

## What success looks like

- 2-3 reply with anything actionable → high-value (this is rare,
  treat as gold)
- 1-2 reply briefly → some signal, log and watch
- 0 reply → confirms the segment is unreachable via email; pivots
  Wave 4 channel (LINE/IG instead)

Either way, this is **information collection**, not pipeline.
Don't chase any reply that comes back trying to convert it. Reply
once, thanks them, log the answer, move on.
