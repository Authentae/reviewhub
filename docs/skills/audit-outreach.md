# Audit-outreach playbook

The DM/email script for sending an outbound audit to a prospect. Lives
between `lead-finding.md` (who to message) and the closing call (after
they reply).

The single most important rule: **lead with the result, not the
pitch.** Send the audit URL first. The article that inspired this
flow ("services are the new software") boils down to one trick: the
prospect sees the deliverable before they're asked to buy. Resistance
drops by an order of magnitude.

## What you've already done before sending the DM

1. Generated the outbound audit on the dashboard
2. Got back a shareable URL like `reviewhub.review/audit-preview/abc123`
3. Confirmed the URL renders properly on a phone (the prospect WILL
   open it on mobile — most owners do)
4. Identified the contact channel from `lead-finding.md` output (IG /
   LINE / FB / email)

Now you send the message.

## The DM template — Thai market (LINE + Instagram + Facebook)

This is the workhorse. Use this for 80% of your Thai outreach. It's
deliberately short — owners read DMs in 3–5 seconds while serving
customers.

```
สวัสดีค่ะคุณ{owner_name_or_blank}

แวะดู Google ของ{business_name}แล้วเห็นว่ายังมีรีวิว{N}อันที่ยังไม่ได้
ตอบ รวมถึง{1_star_or_recent_pain}ด้วย เลยลองร่างคำตอบให้ดูเล่น ๆ ลองดูได้ที่นี่นะคะ

→ {audit_url}

ถ้าโอเคจะตั้งระบบให้ตอบรีวิวแบบนี้ไปเรื่อย ๆ เดือนละ 590 บาทค่ะ
ถ้าสนใจคุยสั้น ๆ 10 นาทีก็ทักได้เลยน้า

— Earth (ReviewHub, Bangkok)
```

Substitution rules:
- `{owner_name_or_blank}` — only if you can find it. Otherwise drop.
  Wrong name is worse than no name.
- `{business_name}` — exactly as it appears on Google. Don't auto-
  translate (e.g., keep "Roast8ry" not "โรสต์เอท")
- `{N}` — the unanswered count from your audit. Don't fudge.
- `{1_star_or_recent_pain}` — pick ONE of:
  - "1 ดาวจากเมื่อสัปดาห์ก่อนที่ลูกค้าบ่นเรื่องบริการ"
  - "รีวิวยาวจาก{date}ที่ดูเหมือนต้องการคำตอบ"
  - "หลายคอมเมนต์ที่ลูกค้าถามคำถามแต่ยังไม่มีใครตอบ"
  Specifics > generics. The prospect should feel "she actually read
  my reviews," not "this is a templated blast."

## The DM template — English market

For Singapore, Australia, Philippines, Hong Kong, etc.

```
Hi {owner_name_or_blank},

Stumbled on {business_name} on Google — noticed {N} reviews are
unanswered including {recent_pain}. Drafted reply suggestions for
all of them — take a look:

→ {audit_url}

If you want, I can keep this running for you for $14/mo. Happy to
do a 10-min call to walk through it.

— Earth, ReviewHub (Bangkok)
```

## Channel-specific tweaks

### Instagram DM
- First message gets filtered to Message Requests if you're not
  followed back. Open with literally just the audit URL preview
  (Instagram auto-renders it as a card) + 2 short lines. Too much
  text = bot detection = shadowban.

### LINE Official Account (LINE OA)
- LINE auto-collapses long messages. Put the URL in the FIRST line
  so it shows in the preview. Then the pitch.
- Don't use the platform's broadcast feature — that's spam-flagged.
  Send 1:1 DMs.

### Facebook Page DM
- The slowest-reply channel of the four. Owners check Facebook DMs
  weekly, not daily. Lower expectations.
- DO use because it's the only contact method for a lot of
  conservative-vertical owners (older salons, traditional bakeries).

### Email
- Use ONLY when no DM channel exists. Email reply rate is half of IG
  reply rate for SMBs.
- Subject line: `{business_name} — 6 unanswered reviews on Google`.
  Specific, no clickbait.
- Keep body shorter than DM (people skim email). 3 sentences + URL.

## Don't do these (failure modes I've seen)

- ❌ "Hope you're doing well!" — corporate-bot tell. Skip pleasantries.
- ❌ "We're a software platform that..." — no one cares about the
  software. They care about the result.
- ❌ Sending a PDF / attachment — friction. URL only.
- ❌ Following up in <24 hours — looks desperate. Wait 3 days minimum.
- ❌ Following up more than ONCE total — after that you're spam.
- ❌ Cross-channel followups — if you DM'd Instagram and they didn't
  reply, don't email them too. Pick one channel and respect their
  signal.
- ❌ Using "AI" in the first message — for SMB owners in 2026 that
  word still triggers skepticism. Say "drafted" or "wrote up,"
  reveal the AI angle on the call.
- ❌ Quoting the price too high in the DM. The "590 บาท / $14" anchor
  works because it's lower than they expect. If you say "starting at
  590" and the call closes at "well actually the Pro plan is $29"
  you've lost trust. Quote the entry price, upsell on the call.

## The follow-up message (only ONE allowed, sent 3+ days later)

```
สวัสดีอีกครั้งค่ะ ลิงก์ตัวอย่างคำตอบรีวิวที่ส่งให้ดูยังเปิดได้นะคะ
→ {audit_url}

ไม่กดดันค่ะ ถ้าตอนนี้ยังไม่ใช่จังหวะ ทักมาทีหลังก็ได้น้า
```

English:
```
Hi again — the draft replies link is still live if you want to peek:
→ {audit_url}

No pressure. If now isn't the moment, ping me anytime later.
```

The "no pressure" line matters. Owners who didn't reply the first time
are usually busy, not uninterested. Acknowledging that respects their
time and keeps the door open for a reply 6 weeks later when they
finally have a quiet evening.

## What happens when they reply

Three reply patterns and how to handle each:

### Reply A: "Wow, this is cool. How does it work?"

This is the high-intent reply. They want a call.

```
ขอบคุณค่ะ! โทรคุย 10 นาทีเลยดีกว่ามั้ย เลือกเวลาได้ที่นี่
→ {your_calendly_url}

หรือถ้าจะคุยทาง LINE ตอนนี้ก็ได้เลย เราจะดู{business_name}ด้วยกันแล้ว
ลองตั้งให้ดูเลย
```

Aim for the call. The audit got attention; the call closes.

### Reply B: "What's the catch?"

They saw the audit, like it, but suspect a gotcha. Be direct:

```
ไม่มีอะไรซับซ้อนค่ะ:
- 590 บาท/เดือน ยกเลิกได้ตลอด
- AI ร่างคำตอบให้ คุณกดอนุมัติก่อนเผยแพร่เสมอ — ไม่มีการตอบอัตโนมัติ
- ข้อมูลรีวิวเก่าทั้งหมดถูก import ให้ตอนเริ่มใช้

อยากเห็นแดชบอร์ดมั้ยคะ จะเปิดให้ดูได้ที่ {dashboard_demo_url}
```

The "no auto-publish" line is the single most reassuring thing for
owners who've been burned by spam-bots before.

### Reply C: "ไม่สนใจค่ะ ขอบคุณ" / "Not interested, thanks"

```
ไม่เป็นไรค่ะ ขอบคุณที่สละเวลาดูน้า ถ้าเปลี่ยนใจวันไหนทักมาได้เลย

ขอถามนิดนึงได้มั้ยคะ — ส่วนไหนของ {audit_url} ที่รู้สึกว่ายังไม่ค่อยตรง?
อยากเอาไปปรับให้ดีขึ้น (ไม่กดดันให้ตอบเลย)
```

Two reasons for the second line:
1. The signal — knowing what didn't land is gold for the next 100 outreaches
2. Sometimes "not interested" is "not interested today" and the
   gentle question revives the thread

## On the closing call (10–15 min)

After they say yes to a call, the call itself is short:

1. **First 60 seconds:** "Cool — let me share my screen and just show
   you the dashboard with your business already in it." Don't
   pitch — show.
2. **Next 5 minutes:** walk through 3 features, in this order:
   1. The drafted replies (they already saw these in the audit;
      now show editing one to feel the workflow)
   2. The email alert that fires when a new review lands
   3. The bulk-respond view for catching up on backlog
3. **Closing:** "Want me to set this up for you now? I'll import
   your existing reviews, draft replies for the unanswered ones,
   and you take it from there. Setup is free; the 590-baht/mo
   starts when your card hits the LemonSqueezy page."
4. **Handle silence:** if they pause, say "or take a few days, the
   audit URL stays live." Then SHUT UP. Don't fill the silence.

## Pricing on the call

| Setup | Monthly | When to quote |
|---|---|---|
| Free setup | 590 ฿ / $14 (Starter) | Default. Use this 80% of the time. |
| Free setup | 999 ฿ / $29 (Pro) | If they have 6+ platforms or asked about analytics |
| Free setup | 1,990 ฿ / $59 (Business) | Multi-location chain only |
| 3,000 ฿ one-time | 590 ฿/mo | If they ask "can you import all my old reviews and write replies for them?" — that's a setup-fee opportunity. The import itself is free; the manual reply-writing for the backlog is the upsell. |

Don't invent custom pricing. Stick to the four tiers + the optional
3,000-baht backlog-cleanup fee. Custom pricing is a trust-killer.

## When to update this playbook

After every 10 outreaches, take 5 minutes to:
- Note which message variant got more replies (DM A vs DM B)
- Note which vertical / city is converting
- Update the "don't do these" list if you ship a new failure mode
- Move pricing tweaks here so the next 10 outreaches benefit

Keep this file editable, not a stone tablet. The Thai market in 2026
isn't the same as the Thai market in 2027 — what works now will need
adjustment. The framework stays; the specifics drift.

## What success looks like at scale

After a month of running this loop:
- 100–150 outbound touches sent
- 15–30 replies
- 5–10 calls booked
- 2–5 closes
- 1,180–2,950 ฿/mo MRR added (assuming Starter average)

Not life-changing income on its own. But:
- This is in addition to organic / inbound signups
- The closes are sticky (review management is recurring need)
- Compounding — month 2 you start month 1 with 2–5 paying customers
  already in the funnel
- After 6 months you have 12–30 paying customers, 90% of whom are
  still on, and word-of-mouth starts kicking in (Bangkok cafe scene
  is small)

The math works. Patience does.
