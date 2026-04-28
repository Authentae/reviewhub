# Onboarding email playbook

The post-signup nudge sequence that turns a free signup into an active
user. Paste this entire file into Claude, then say "draft the day-2 email
for a Thai cafe owner who hasn't connected Google" — it will produce
something the user actually reads.

---

## The sequence at a glance

| Day | Trigger | Goal | Tone |
|---|---|---|---|
| 0 | Signup | Welcome + 1 click to first value | Warm, personal, fast |
| 2 | Hasn't connected Google AND hasn't imported CSV | Get them past the activation wall | Helpful, no pressure |
| 7 | Still nothing | Offer hands-on help on LINE/email | Founder-personal |
| 14 | Connected but no AI drafts used | Show them the AI drafts feature | Curious, low-pressure |
| 30 | Still on free, used >5 AI drafts | Soft upgrade nudge to Solo | Honest |

Sequences pause if they reply to any email — humans pick up.

---

## Voice rules

DO:
- Sign as "Authentae" or "[founder name], ReviewHub" — never "ReviewHub Team"
- Plain text or very minimal HTML. No marketing email design.
- Subject lines under 7 words. No emoji in subjects (lower deliverability).
- Concrete one-step CTA. "Connect Google →" or "Import a CSV →"
- Match locale: Thai users get Thai emails. Don't translate awkwardly —
  the localized translations.js has the source of truth phrasings.

DON'T:
- "Welcome to the ReviewHub family"
- "We're so excited to have you on board"
- Multi-section emails with 3 headlines and 5 buttons
- Emojis in subject (Gmail filters them harder)
- "Don't miss out" / "limited time"
- Survey requests in the first 14 days (they have nothing to say yet)

---

## Day 0 — Welcome (sent immediately on signup)

**Subject (EN):** Welcome — one quick step
**Subject (TH):** ยินดีต้อนรับ — ขั้นตอนเดียวครับ

**Body (EN):**
> Hey [first name],
>
> You're in. The fastest way to see ReviewHub do its thing: connect your
> Google Business Profile (one OAuth click, 20 seconds). After that, all
> your reviews show up on the dashboard within ~30 minutes, and AI
> drafts a reply for each one in your voice.
>
> [Connect Google →]
>
> If you don't use Google or you're on a platform like Wongnai, Tabelog,
> Yelp, or 20+ others, just import a CSV instead — Settings → Import
> takes about 30 seconds.
>
> Reply to this email if anything's confusing — it goes straight to me.
>
> — Authentae
> reviewhub.review

**Body (TH):**
> สวัสดีครับคุณ[ชื่อ]
>
> ขั้นตอนที่เร็วที่สุดในการเริ่มใช้ ReviewHub: เชื่อมต่อ Google Business
> Profile (คลิก OAuth ครั้งเดียว, 20 วินาที) หลังจากนั้นรีวิวทั้งหมด
> จะมาที่แดชบอร์ดภายใน ~30 นาที และ AI จะร่างคำตอบให้ทุกรีวิว
> ในสไตล์ของคุณ
>
> [เชื่อมต่อ Google →]
>
> ถ้าใช้ Wongnai, Yelp, Tabelog หรือแพลตฟอร์มอื่น ให้นำเข้าไฟล์ CSV
> แทน — ที่ Settings → Import ใช้เวลาประมาณ 30 วินาที
>
> มีอะไรไม่เข้าใจ ตอบอีเมลนี้ได้เลยครับ ผมอ่านเองทุกฉบับ
>
> — Authentae
> reviewhub.review

---

## Day 2 — Activation nudge (no connection yet)

**Subject:** Stuck on Google? / ติดตรงเชื่อม Google ไหมครับ
(Pick whichever language matches the user's locale.)

**Body (EN):**
> Hey [first name] —
>
> Noticed you haven't connected a platform yet. Two paths from here:
>
> 1. Google: takes 20 seconds, one OAuth click. The big unlock.
>    [Connect Google →]
>
> 2. Anything else (Yelp, Wongnai, Tabelog, etc.): export your reviews
>    as CSV from that platform, then upload here.
>    [Sample CSV ↓] / [Open Settings →]
>
> If something specific is blocking you, reply and I'll help directly.
>
> — Authentae

---

## Day 7 — Founder-personal (still no activation)

Plain text, no buttons, no headers — feels like a real email from a person.

> Hey [first name] —
>
> I run ReviewHub solo. I noticed you signed up a week ago but haven't
> connected anything yet. No pressure at all — but if there's a specific
> thing that's blocking you (the Google OAuth flow looks scary, you don't
> use Google at all, you couldn't figure out the CSV format, etc.), I'd
> like to know. Sometimes I can fix it on my end in 10 minutes.
>
> Just reply to this — goes to my inbox, not a support team.
>
> — Authentae

---

## Day 14 — Feature highlight (connected but no AI drafts)

**Subject:** You haven't tried the AI yet

**Body:**
> Hey [first name] —
>
> Quick one: you've got [N] reviews on the dashboard but haven't used
> the AI draft button yet. It's the whole point of ReviewHub — click
> "Draft reply" on any review and you'll see what it does.
>
> Free plan includes 3 drafts/month. Try one on your trickiest review
> (the 1-star, ideally) — that's where it's most useful.
>
> [Open dashboard →]
>
> — Authentae

---

## Day 30 — Soft upgrade nudge (free user, >5 drafts used)

> Hey [first name] —
>
> You've used [N] AI drafts this month. That's more than the free plan
> gives ([N - free quota]) so you've been falling back to template
> replies — which isn't the same.
>
> Solo at $14/mo unlocks unlimited drafts. If you're managing one
> business and reviewing every reply, that's the right plan. If you have
> multiple locations, Shop at $29 makes more sense (3 teammates,
> sentiment trends, weekly digest).
>
> Annual = ~17% off either way.
>
> [See plans →] [Upgrade to Solo →]
>
> No pressure — free plan stays forever.
>
> — Authentae

---

## What NOT to send

- Drip emails timed to UTC midnight (Thai users hate getting them at 7am
  Bangkok time on Sunday) — schedule by user timezone
- "Did you mean to sign up?" pseudo-confirmations after Day 0
- Surveys, NPS, "rate your experience" — anything that asks them to do
  work for free before they've gotten value
- Cross-promo to other products
- "Last chance" / "we're closing your account" — it's a free plan, you
  don't close anything
- Mentioning a free trial — there is no trial
