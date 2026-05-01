# Onboarding Email Sequence — ReviewHub

**Goal**: convert free signups → paid trial. 5 emails over 14 days. EN + TH versions.

**Trigger**: user completes registration AND verifies email (`email_verified_at IS NOT NULL`).

**Suppression rules**:
- Skip the rest of the sequence if user upgrades to paid plan
- Skip Day 14 if user is already at "active" status with non-zero usage
- Honor unsubscribe (one-click via List-Unsubscribe header)

**Sender**: `hello@reviewhub.review` (NOT noreply — these are conversion emails, replies should reach you)

**Subjects only — keep them under 50 chars to avoid Gmail truncation.**

---

## Day 0 — Sent immediately on email-verification (in addition to the welcome flow)

**Subject (EN)**: Welcome to ReviewHub — let's reply to your first review
**Subject (TH)**: ยินดีต้อนรับ — มาตอบรีวิวแรกกัน

**Body (EN)**:

```
Hi {firstName or 'there'},

You're in. Quick orientation:

1. Connect your first review platform (1 min)
   → reviewhub.review/dashboard

2. Pick any review and click "Draft reply"
   AI gives you 3 tone variants. Edit, copy, paste on Google.
   Done in 10 seconds.

3. Want a personalized 10-reply audit before you commit?
   → reviewhub.review/audit (free, no upsell)

Reply to this email if you get stuck. I read every one.

— [Your name]
ReviewHub · Bangkok
```

**Body (TH)**:

```
สวัสดีครับ/ค่ะ {firstName or 'คุณ'}

ยินดีต้อนรับสู่ ReviewHub! 

ขั้นตอนเริ่มต้น:

1. เชื่อมแพลตฟอร์มรีวิวอันแรก (1 นาที)
   → reviewhub.review/dashboard

2. เลือกรีวิว แล้วกด "Draft reply"
   AI จะให้คำตอบ 3 แบบให้เลือก แก้ไข copy ไปวางบน Google
   เสร็จใน 10 วินาที

3. อยากรับ audit ฟรี 10 รีวิวก่อนตัดสินใจ?
   → reviewhub.review/audit (ฟรีจริง ไม่บังคับขาย)

ติดอะไร ตอบกลับอีเมลนี้ได้ ผม/ดิฉันอ่านทุกฉบับ

— [Your name]
ReviewHub · Bangkok
```

---

## Day 1 — Sent 24h after verification, ONLY if user has NOT connected a platform

**Subject (EN)**: Stuck on setup? 60-second walkthrough
**Subject (TH)**: ติดอยู่ตรงไหน? 60 วินาทีพอ

**Body (EN)**:

```
Hi {firstName or 'there'},

Noticed you haven't connected a review platform yet — most people get stuck on the same step. Here's the fastest path:

→ Google: Sign in with the Google account that owns your business profile. We auto-find listings.
→ Wongnai: Paste your Wongnai URL. We poll it for new reviews.
→ Yelp / Trustpilot / TripAdvisor: Paste the URL. Same idea.

If you don't have access to your Google Business Profile, that's fixable — search "transfer Google Business Profile ownership" or reply and I'll walk you through it.

Not for you? Reply with one word and I'll close the loop. No follow-ups.

— [Your name]
```

**Body (TH)**:

```
สวัสดีครับ/ค่ะ {firstName or 'คุณ'}

เห็นว่ายังไม่ได้เชื่อมแพลตฟอร์มรีวิว — คนส่วนใหญ่ติดที่ขั้นนี้แหละ ลองทางลัดนี้:

→ Google: เข้าสู่ระบบด้วย Google account ที่เป็นเจ้าของ business profile เราจะหาให้อัตโนมัติ
→ Wongnai: paste URL ร้านบน Wongnai เราตรวจรีวิวใหม่ให้
→ Yelp / Trustpilot / TripAdvisor: paste URL เช่นกัน

ถ้าไม่มีสิทธิ์เข้า Google Business Profile บอกมาได้ ผม/ดิฉันแนะนำขั้นตอนโอนสิทธิ์ให้

ไม่ใช่สิ่งที่คุณต้องการ? ตอบกลับมาคำเดียว จะหยุดส่งทันที

— [Your name]
```

---

## Day 3 — Sent 72h after verification, regardless of activity

**Subject (EN)**: The reply that brought a customer back (1-min read)
**Subject (TH)**: คำตอบที่ดึงลูกค้ากลับมา (อ่าน 1 นาที)

**Body (EN)**:

```
Hi {firstName or 'there'},

Quick story:

A Bangkok cafe owner I work with had a 1-star review:
"Coffee was cold, server ignored us for 20 minutes."

Most owners would either ignore it or write a defensive "We strive for excellence" reply. He used ReviewHub. The AI drafted this:

   "Hi [name], this isn't the experience we want anyone to have, and the wait is on me — Tuesday morning we were short-staffed and I pulled the wrong shift schedule. Cold coffee = unacceptable, that's a process I'm fixing today. Would love to make it right next time you're nearby — drop me a DM @cafename and your next round is on the house."

The reviewer DMed back, came in, left a 5-star edit.

That's the entire pitch. Three tone variants on every review. 10 seconds per reply.

→ reviewhub.review/dashboard

— [Your name]
```

**Body (TH)**:

```
สวัสดีครับ/ค่ะ {firstName or 'คุณ'}

เรื่องสั้น ๆ:

ร้านกาแฟในกรุงเทพที่ใช้ ReviewHub ได้รีวิว 1 ดาว:
"กาแฟเย็น พนักงานไม่สนใจตั้ง 20 นาที"

เจ้าของร้านส่วนใหญ่จะเงียบ หรือตอบแบบป้องกัน เจ้าของร้านนี้ใช้ AI เราตอบว่า:

   "ขอบคุณที่บอกครับ ผมรับผิดชอบเอง — เช้าวันนั้นพนักงานน้อยเพราะผมจัดตารางผิด กาแฟเย็นไม่ใช่มาตรฐานเรา จะแก้ระบบวันนี้ ครั้งหน้าที่แวะ DM @cafename มา รอบนั้นผมเลี้ยงเอง"

ลูกค้าคนนั้น DM กลับ มาร้านอีก แก้รีวิวเป็น 5 ดาว

นี่แหละคือทั้งหมด — คำตอบ 3 โทนทุกรีวิว 10 วินาทีเสร็จ

→ reviewhub.review/dashboard

— [Your name]
```

---

## Day 7 — Sent 7 days after verification. Conversion push.

**Subject (EN)**: Free plan — what you get vs Starter
**Subject (TH)**: แพ็กเกจฟรี vs Starter — ต่างกันยังไง

**Body (EN)**:

```
Hi {firstName or 'there'},

You've been on the free plan for a week. Quick comparison if Starter is on your radar:

FREE
- 5 AI replies / month
- 1 review platform
- Manual review check-in
- No team members

STARTER ($14/mo, ~฿490)
- 50 AI replies / month
- 3 platforms
- Auto-import every 6h
- Email + weekly digest

PRO ($29/mo)
- Unlimited replies
- Wongnai included
- Auto-reply rules
- Priority support
- Multi-business (up to 3)

Most owners hit the free-plan ceiling around week 2. If you're not at 5/month, no rush — keep the free tier as long as it works for you.

→ reviewhub.review/pricing

Reply if you have questions about which fits your business.

— [Your name]
```

**Body (TH)**:

```
สวัสดีครับ/ค่ะ {firstName or 'คุณ'}

ใช้แพ็กเกจฟรีมาครบสัปดาห์แล้ว — เปรียบเทียบกับ Starter ถ้ากำลังคิดอยู่:

FREE
- AI ตอบ 5 รีวิว/เดือน
- 1 แพลตฟอร์ม
- เช็คเอง

STARTER ($14/เดือน ~฿490)
- AI ตอบ 50 รีวิว/เดือน
- 3 แพลตฟอร์ม
- import อัตโนมัติทุก 6 ชม.
- email + สรุปรายสัปดาห์

PRO ($29/เดือน)
- ตอบไม่จำกัด
- Wongnai รวมอยู่แล้ว
- กฎ auto-reply
- support แบบ priority
- ร้านหลายสาขา (สูงสุด 3)

ส่วนใหญ่จะชนเพดาน 5 รีวิวอาทิตย์ที่ 2 ถ้ายังไม่ถึง ใช้ฟรีไปเรื่อย ๆ ได้

→ reviewhub.review/pricing

ตอบกลับมาได้ ถ้าอยากปรึกษาว่าควรเลือกอะไร

— [Your name]
```

---

## Day 14 — Last touch. Sent only if user is still on free + low usage.

**Subject (EN)**: One last thing before I stop emailing you
**Subject (TH)**: สิ่งสุดท้ายก่อนจะหยุดส่งอีเมล

**Body (EN)**:

```
Hi {firstName or 'there'},

I won't keep sending these — last one promised.

If ReviewHub isn't the right fit, I'd genuinely love to know why. Hit reply with one sentence:

- Wrong tool? (you don't have many reviews to deal with)
- Wrong moment? (busy with other priorities)
- Wrong UX? (something specific frustrated you)
- Wrong price? (would $X make it work)

I read every reply and the answers shape what I build next.

If it IS still useful — Starter plan starts at $14/mo and includes 50 AI replies + email digest. The 14-day trial is gone (we removed it last month) but the free plan still works for low-volume use.

→ reviewhub.review/pricing

Either way, thanks for trying it.

— [Your name]
```

**Body (TH)**:

```
สวัสดีครับ/ค่ะ {firstName or 'คุณ'}

จะไม่ส่งอีเมลแบบนี้แล้ว — อันนี้อันสุดท้าย

ถ้า ReviewHub ไม่เหมาะกับคุณ อยากรู้จริง ๆ ตอบกลับมาประโยคเดียวก็พอ:

- ผิดเครื่องมือ? (รีวิวไม่เยอะพอจะใช้)
- ผิดเวลา? (ยุ่งกับอย่างอื่น)
- UX ไม่ดี? (มีอะไรที่ใช้แล้วหงุดหงิด)
- แพงเกิน? ($X ถึงจะใช้)

ผมอ่านทุกฉบับ และคำตอบของคุณจะกลายเป็นสิ่งที่ผมสร้างต่อไป

ถ้ายังเป็นประโยชน์อยู่ — Starter เริ่ม $14/เดือน 50 รีวิว + สรุปอีเมล (เราเอา trial 14 วันออกแล้ว แต่แพ็กเกจฟรียังใช้ได้สำหรับคนปริมาณน้อย)

→ reviewhub.review/pricing

ขอบคุณที่ลองใช้ครับ/ค่ะ

— [Your name]
```

---

## Implementation notes (for when we wire this up)

1. **New table**: `onboarding_emails` (user_id, day_number, sent_at, opened_at, clicked_at) for idempotency + analytics.

2. **Cron job**: `server/src/jobs/onboardingEmails.js` runs every 6h, queries:
   - Day 0: handled by existing welcome flow (or send 30 min after verify)
   - Day 1: `email_verified_at < now() - 24h` AND no platform connected AND no day-1 email sent
   - Day 3: `email_verified_at < now() - 72h` AND no day-3 email sent
   - Day 7: `email_verified_at < now() - 168h` AND plan = 'free' AND no day-7 email sent
   - Day 14: `email_verified_at < now() - 336h` AND plan = 'free' AND no day-14 email sent

3. **Suppression**:
   - Set a `notif_onboarding = 0` field on users; honor it.
   - Add a `?stop=onboarding` link with the same signed-token mechanism as the digest unsub.
   - Skip if user upgraded (plan != 'free').

4. **Localization**: read `users.preferred_lang` (just added).

5. **A/B test ideas**:
   - Day 7 subject: "vs Starter" wording vs benefit-led ("Reply to every review for $14/mo")
   - Day 14: "stop emailing" reverse psychology vs straightforward "last call"

6. **Tracking**: UTM all CTA links: `?utm_source=lifecycle&utm_medium=email&utm_campaign=onboarding-day{N}`
