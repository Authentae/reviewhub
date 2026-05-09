# Wave 5 outreach pitch — LINE-native positioning

Drafted 2026-05-09. Wave 5 is the first outreach batch that tests the
LINE-native pivot positioning. If Wave 4 produces 0 replies (which is
the realistic-worst-case from the strategy doc), Wave 5 ships with a
DIFFERENT pitch — LINE notification as headline value — to test
whether the channel framing matters.

If Wave 4 produces 1+ replies, Wave 5 still ships but the LINE pitch
is the experimental arm in an A/B between "current generic pitch" and
"LINE-native pitch."

---

## What changed vs Wave 4 pitch

Wave 4 leads with: *"AI ของเราร่างคำตอบให้ดูครับ"* (AI drafts replies for
your review)

Wave 5 leads with: *"รีวิวมาเมื่อไหร่ ได้รับแจ้งใน LINE ทันที"* (real-time
LINE notification when reviews come in)

The pivot shifts from PRODUCT-value (drafts in your voice) to
WORKFLOW-value (the speed of LINE-native reply). The drafts are still
mentioned, but as the supporting mechanism, not the headline.

---

## Email body — Thai market — Wave 5

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ — แจ้งเตือนรีวิว Google ผ่าน LINE
พร้อมร่างคำตอบให้ทันที สำหรับร้านในกรุงเทพ

แวะดู Google ของ {business_name} เมื่อกี้ เห็นว่ามีรีวิว {N} อันที่ยังไม่ได้
ตอบ รวมถึง {PAIN}

ระบบของเราทำงานแบบนี้ครับ:
1. ลูกค้าเขียนรีวิวใน Google
2. LINE แจ้งคุณภายในไม่กี่วินาที พร้อมร่างคำตอบที่ AI เขียนในโทนของร้าน
3. คุณกดอนุมัติ ระบบโพสต์ให้บน Google

ลูกค้าใหม่อ่านคำตอบเพื่อดูว่าเจ้าของร้านใส่ใจรึเปล่า การตอบเร็วในโทนที่ฟัง
แล้วเป็น "เจ้าของจริง" คือจุดที่เครื่องมือต่างประเทศ (Birdeye, Podium) ทำไม่ได้
— เพราะเขาส่งแจ้งเตือนผ่าน Slack/อีเมลเป็นหลัก ซึ่งเจ้าของร้านในเมืองไทย
ไม่ได้เปิดบ่อย

ผมร่างคำตอบสำหรับ {business_name} ไว้ {N} อันแล้วครับ ลองเปิดดูได้เลย
ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

คำตอบที่ร่างเอาไปก๊อปวางใน Google ใช้ได้เลยฟรี ถ้าอยากให้ระบบทำแบบนี้
ทุกครั้งที่มีรีวิวใหม่ + แจ้งเตือนผ่าน LINE OA ของร้าน มีแพ็กเกจเริ่มต้น
฿490/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
ทำในกรุงเทพ
```

**Subject (TH):** `{business_name} — แจ้งเตือนรีวิว Google ผ่าน LINE`

**Why this Thai email works:**

- Self-intro line names what the product IS in one phrase: "review
  notification via LINE with AI-drafted reply"
- The 3-step workflow makes the speed claim concrete (10 seconds is
  abstract; "review → LINE → tap approve → posted" is not)
- Names the competitor weakness directly: foreign tools use Slack/email,
  Thai owners don't. This is honest positioning, not smear copy.
- Soft handover stays the same as Wave 4 — proven pattern
- "ทำในกรุงเทพ" (made in Bangkok) signature — moat reminder

---

## Email body — English market — Wave 5

```
Hi {first_name_or_blank},

I'm Earth, building ReviewHub — Google review notifications via
LINE with AI-drafted replies, built specifically for Bangkok
hospitality.

Was looking through {business_name}'s Google profile and noticed
{N} reviews are unanswered, including {PAIN}.

How it works:
1. New review hits Google
2. Your LINE OA gets a notification within seconds — with a
   pre-drafted reply in your voice
3. You tap approve; we post it to Google

The reason this matters more in Bangkok than in the US: foreign tools
(Birdeye, Podium) notify via Slack and email, which Thai-market owners
check infrequently. Reviews go unanswered for days. By the time you
reply, the moment has passed.

I drafted {N} replies for {business_name} already — take a look:

→ {AUDIT_URL}

Use any of them directly. If you'd like the system running on
autopilot with LINE notifications, the entry plan is ฿490 / $14 a
month.

— Earth
ReviewHub · reviewhub.review
Built in Bangkok
```

**Subject (EN):** `{business_name} — LINE notifications for Google reviews`

---

## Substitution rules (same as Wave 4)

- `{business_name}` — exactly as on Google
- `{N}` — actual unanswered count from audit
- `{PAIN}` — one specific observation from their reviews
- `{AUDIT_URL}` — generated via dashboard, verified HTTP 200
- `{first_name_or_blank}` — only if confidently identified

---

## A/B split if Wave 5 ships alongside Wave 4 fallback

If Earth wants to test LINE-native positioning vs current generic
positioning in the same wave:

- **Arm A (control):** existing Wave 4-style draft (AI-drafts headline)
- **Arm B (variant):** this Wave 5 draft (LINE-notification headline)
- 50/50 split across the next 10-12 prospects
- Read after 5-7 days: open rate, audit-URL view rate, reply rate
- Decision threshold: variant B beats control by 2× on any metric → ship LINE-native pivot

The simpler call (per the partner discussion 2026-05-09): just go all-in
on Variant B for Wave 5. The data is strong enough that A/B is overcautious.
Founder intuition + market data = sufficient signal to commit.

---

## Pre-send checklist (additions for Wave 5)

Standard Wave 4 checklist plus:

```
[ ] If sending to a prospect with Wongnai presence, check if their
    Wongnai reviews would also notify via LINE in the v1 product
    (currently Google-only). If not, drop the Wongnai mention.
[ ] Confirm the receiver is reachable on LINE OA (have they set one up?
    Check website footer, Facebook page, or just assume yes — Thai
    hospitality almost universally has LINE OA).
[ ] Do NOT promise the LINE notification is live yet if the integration
    isn't shipped. The pitch is: "we're building this for you" + "draft
    replies live now." Avoid implying current product feature.
[ ] If product hasn't shipped LINE OA integration yet, note in the
    audit-preview register CTA section: "LINE notifications coming
    soon — join the waitlist." Capture demand before build.
```

---

## What this pitch implicitly commits to building

If Wave 5 lands replies based on the LINE-notification angle, we have
to ship the LINE OA integration within ~14 days. The pitch creates
demand for a product feature we don't fully have yet.

The "honesty bridge" — for the period between Wave 5 sending and LINE
integration shipping — is to make audit-preview say "LINE notifications
coming June 2026 — your audit reserves your spot." This is a real
roadmap commitment, not vapor.

If Earth doesn't want to commit to building LINE OA integration, do
NOT send Wave 5 with this pitch. The pitch is the commitment. Half-
shipping (pitch without product) is the worst outcome.
