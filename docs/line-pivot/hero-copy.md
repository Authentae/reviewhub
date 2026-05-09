# Landing-page hero copy — LINE-native variant

Drafted 2026-05-09 as part of the LINE-native repositioning evaluation
(see `docs/line-pivot/README.md` for context).

This is COPY ONLY — no code shipped yet. Earth reviews + edits before
any code change.

---

## Current hero (English-positioning, generic global SMB)

**Eyebrow:** *(none on current Landing.jsx)*
**Headline:** *(varies — has rotated; current per `og:title`):*
> ReviewHub — AI review replies in 10 seconds

**Subhead:**
> Reply to every Google and Wongnai review in 10 seconds. AI drafts
> replies in 10 languages including Thai, Japanese, Korean, Chinese —
> in your voice. Import 60+ platforms via CSV.

**CTA:** Get started free / View pricing

**Audience read:** "global English-speaking solo operator." Competes
with Birdeye / Podium directly.

---

## Variant A — LINE-native, Thai-first

The strongest pivot. Reframes the product as built FOR Thai SMBs, not
translated INTO Thai. Bangkok-native is the moat.

**Eyebrow (TH default):** *เครื่องมือตอบรีวิว Google สำหรับร้านในกรุงเทพ*

**Headline (TH):**
> รีวิวมาเมื่อไหร่ ได้รับแจ้งใน LINE ทันที.
> ตอบกลับใน 10 วินาที.

(EN equivalent below the headline as a smaller line:)
> *New Google review lands → LINE notification → AI-drafted reply ready
> in 10 seconds. Built in Bangkok, for Bangkok.*

**Subhead (TH):**
> เชื่อม Google Business Profile หนึ่งครั้ง รีวิวใหม่ทุกอันแจ้งเตือนเข้า
> LINE ของคุณ พร้อมร่างคำตอบที่เขียนในโทนของร้าน กดอนุมัติครั้งเดียว
> ระบบโพสต์ให้บน Google ลูกค้าใหม่เห็นว่าร้านตอบจริง

**CTA primary:** ลองดูฟรี — ใช้ LINE ของคุณ
**CTA secondary:** เห็นว่ามันทำงานยังไง (audit-preview demo link)

**Microcopy below CTA:**
> ฟรี 3 ร่างคำตอบต่อเดือน · ไม่ต้องใส่บัตรเครดิต · ระบบเริ่มจาก ฿490/เดือน

**Audience read:** "Bangkok hospitality / restaurant / café owner who
already lives in LINE." Competes with nothing — there is no Thai-
native review-reply tool with LINE OA integration.

---

## Variant B — Bilingual, LINE prominent but not exclusive

Softer pivot. Keeps English audience accessible but makes LINE the
prominent differentiator. Useful if Earth wants to test LINE-as-feature
before committing to LINE-as-core.

**Eyebrow:** *AI review replies for Google, Wongnai, and 60+ platforms*

**Headline:**
> Get a LINE notification when a review lands.
> Reply in 10 seconds with an AI draft.

**Subhead:**
> Connect Google once. Every new review pings your LINE OA with a
> reply already drafted in your voice. Approve with one tap; we post
> it. Built in Bangkok for hospitality, restaurant, and clinic owners
> who actually live in LINE — not in Slack.

**CTA primary:** Try it free
**CTA secondary:** See an audit example

**Microcopy:** *3 free drafts/month · No card · ฿490 / $14 per month*

**Audience read:** "Thai-fluent SMB owner OR English-fluent owner in
Thailand." Both feel addressed. Loses some niche-down sharpness vs A.

---

## Variant C — Speed-first, LINE as proof point

Leads with the SPEED claim (which is the actual product value). LINE
is mentioned as the mechanism that makes speed real, but isn't the
headline.

**Eyebrow:** *Reply to Google reviews in 10 seconds, not 10 minutes*

**Headline:**
> Speed is the product.
> LINE notification → AI draft → one-tap approve → posted to Google.

**Subhead:**
> Most review tools email you when a review lands. By the time you
> see it, the moment has passed. ReviewHub pings your LINE the second
> a review hits Google, with the reply already drafted. From new-review
> to live-on-Google: under a minute.

**CTA:** Try the free audit

**Audience read:** "Owners frustrated with slow review-response
workflows." Frames speed as the moat; LINE supports it.

---

## My partner-recommendation: Variant A

Reasons:

1. **The data backs niche-down on Bangkok.** 80%+ of Thailand on LINE,
   92% weekly use, 70%+ follow brand accounts. A Thai-first product
   for a Thai-living-in-LINE audience is structural fit, not feature.
2. **The current funnel pre-positioning is wrong for current outreach.**
   Wave 4 is 9 Thai hospitality prospects. They land on a generic-
   English landing page that mentions "60+ platforms" and "Wongnai" but
   buries the Thai-fit. Variant A makes the landing match the email.
3. **/vs/ pages become irrelevant in this positioning** — but those
   competitors aren't competing for Thai market anyway. Variant A's
   competitive set is "nothing" (no other Bangkok-native review tool
   does LINE OA). That's the strongest possible positioning.
4. **It's the move that requires conviction.** Variant B and C are
   "let's not commit" half-measures. The whole point of the LINE-
   native bet is committing. Half-measures don't pay off.

**The cost of Variant A:**

- Re-do landing page hero (~2 hours code + screenshot review)
- /vs/ pages stay live but get a "Built for Thai market" banner +
  drop from primary nav
- Pricing page emphasizes baht prominently (USD smaller)
- Marketing copy across audit-preview / register / about-page
  re-aligns to Bangkok-native framing

Total ~1 day of code + copy. Not 14 days.

**The 14-day cost is the LINE OA INTEGRATION** (webhook + Flex Messages
+ LINE Login OAuth) — that's separate, ships AFTER Variant A landing
proves the positioning resonates with Wave 5 traffic.

---

## What ships first if Earth approves Variant A

1. Landing.jsx hero rewrite (~2 hours)
2. AuditPreview.jsx hero subtle update to mention LINE notification
   as a "coming soon" pre-signal (~30 min)
3. Pricing.jsx baht-first emphasis (~30 min)
4. New /line page explaining the LINE OA notification feature roadmap
   ("we're building this; tell us what you'd want") — captures email
   signups for waitlist (~1 hour)
5. Wave 5 outreach pitch updated to lead with LINE positioning (~30 min)

Total ~4 hours of code + copy. Day 1 of the LINE pivot. Then evaluate
in 7 days based on Wave 5 conversion + waitlist signups.

The LINE OA integration code itself ships AFTER waitlist signals
demand. Doesn't gate the pivot.
