# Wave 2 +3-day follow-ups — ready to send Monday 2026-05-12

All 3 Wave 2 prospects opened the audit URL but didn't reply.
Industry recovery on a single follow-up is 30-50%. These are
ready to send Monday morning Tue 9-11am ICT (per the
"hospitality reads email mid-morning weekday" hypothesis from
Wave 1 post-mortem).

**Send order:** Old Capital first (most-engaged: opened within
~2 hr of send), then Loftel 22, then Chakrabongse last (highest
likelihood of being a "thanks but no" since they're the most
upmarket and have a higher response-rate baseline).

**Send from:** earth.reviewhub@gmail.com (brand account, NOT
theearth1659).

**Pre-send checklist:**
- [ ] Production health green (`curl -s https://reviewhub.review/api/health`)
- [ ] Each audit URL still returns 200 (Old Capital: eb9b38c2…34fd,
      Loftel 22: 5413ee40…edc2, Chakrabongse: 9326cf61…4340)
- [ ] Send between Tue 9-11am ICT, not late afternoon
- [ ] Reply to the original thread (don't start a new one) so the
      audit URL context is intact

---

## 1. Old Capital Bike Inn — `info@oldcapitalbkk.com`

**Reply to original thread "Old Capital Bike Inn — รีวิว Google
ที่ยังไม่ได้ตอบ" or whatever the original subject was.**

```
สวัสดีครับ

ติดต่อกลับมาแค่อันเดียว — เห็นว่าคุณเปิด audit ที่ส่งไปเมื่ออาทิตย์ก่อน
แต่ไม่ได้ตอบกลับมา เลยอยากถามตรงๆ ว่ามีคำถามอะไรเกี่ยวกับ draft
คำตอบที่เราร่างให้บ้างไหมครับ

ถ้า:
- โทนคำตอบไม่ตรงกับสไตล์ของ Old Capital — บอกได้เลย ปรับให้
- ไม่อยากใช้แอป แค่อยากเอา draft ไปก๊อปวางเอง — URL ยังใช้ได้อีก 28 วัน
- ตอนนี้ยุ่งหรือไม่ใช่จังหวะที่เหมาะ — ไม่เป็นไรครับ ตอบแค่ "later"
  ก็พอ ผมจะไม่กวนต่อ

หรือถ้าไม่ใช่ทางที่ใช่เลย แค่ตอบ "ไม่ใช่" ผมก็โอเคครับ — ข้อมูลที่
ตรงไปตรงมาช่วยผมพัฒนาเครื่องมือที่เหมาะกับร้านเล็กๆ ในกรุงเทพฯ
มากกว่าการเงียบ

ขอบคุณครับ
Earth
```

**Why this works:** acknowledges the open without being creepy
about it ("เห็นว่าคุณเปิด"), frames three plausible reasons for
not replying (tone / DIY-only / busy) — covers most likely
objections without naming them aggressively, and explicitly
invites a "no" so non-engagement converts to data.

---

## 2. Loftel 22 Hostel — `loftel22bangkok@gmail.com`

**Reply to original thread.**

```
สวัสดีครับ

ติดต่อกลับมาสั้นๆ — เห็นว่าเปิด audit URL ที่ส่งไปเมื่อวันก่อน 2 ครั้ง
อยากถามตรงๆ ว่า draft คำตอบที่ AI ร่างให้พอใช้ได้ไหมครับ หรือมีตรง
ไหนที่รู้สึก "ไม่ใช่"

ถ้าโทนแข็งไป / นุ่มไป / ไม่เหมือน Loftel 22 ตามปกติ — บอกได้เลย
ปรับให้ ถ้าใช้ได้แต่ตอนนี้ยุ่ง — URL ยังใช้ได้อีก 28 วัน ก๊อปไปวางเอง
ตอนสะดวกได้

ถ้าไม่ใช่ทางที่ใช่ — ตอบแค่ "ไม่ใช่" ก็พอครับ ไม่กวนต่อ ฟีดแบ็ก
ตรงไปตรงมาช่วยผมเยอะกว่าการเงียบ

ขอบคุณครับ
Earth
```

**Why this works:** Loftel viewed twice (more engagement signal),
so reference that specifically. Same "three options + permission
to say no" structure.

---

## 3. Chakrabongse Villas — `reservation@chakrabongse.com`

**Reply to original thread. Send LAST — highest baseline response
rate (60%+) means they're more likely to politely decline than
not-respond.**

English here because Chakrabongse is internationally-positioned
and the original outreach went in English.

```
Hi —

Just one quick follow-up. I noticed the audit page got opened
twice over the weekend, but no reply yet — wanted to check
whether the drafts I sent were useful at all, or if something
about the approach didn't fit Chakrabongse.

A few common reasons people open and don't reply:

- The draft tone doesn't match how Chakrabongse usually writes
  to guests — totally fixable, the AI calibrates from your edits
- The current setup (whoever handles reviews now) is working
  fine and there's no problem to solve
- Timing — high season, busy, not the moment

If it's none of those and just "this isn't a fit," a one-word
"not interested" is genuinely useful — saves us both time and
helps me understand what tools actually serve Bangkok properties
at your tier.

The audit URL stays live for 28 more days regardless, so feel
free to grab any of the drafts manually if useful.

Thanks for the time,
Earth
```

**Why this works:** matches their formal/upmarket register,
explicitly enumerates three plausible reasons, gives the "no"
permission, and leaves the audit URL as a low-pressure asset.

---

## After sending

For each prospect, log result in
`docs/wave-postmortems/wave-2-bangkok-hospitality.md` under
"Reply data":

```
| Prospect | Open count | Followup sent | Reply | Outcome |
|---|---|---|---|---|
| Old Capital Bike Inn | 1 | 2026-05-12 | TBD | TBD |
| Loftel 22 Hostel | 2 | 2026-05-12 | TBD | TBD |
| Chakrabongse Villas | 2 | 2026-05-12 | TBD | TBD |
```

Update by Wed 5/14 EOD with whatever comes back.
