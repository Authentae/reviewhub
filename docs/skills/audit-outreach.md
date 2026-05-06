# Audit-outreach playbook

The DM/email script for sending an outbound audit to a prospect. Lives
between `lead-finding.md` (who to message) and the closing call (after
they reply).

The single most important rule: **lead with the result, not the
pitch.** Send the audit URL first. The article that inspired this
flow ("services are the new software") boils down to one trick: the
prospect sees the deliverable before they're asked to buy. Resistance
drops by an order of magnitude.

## Segment by awareness — a 0%-response owner is not the same prospect as a 50%-response owner

Owners who never answer reviews are usually NOT lazy. They genuinely
don't know that:
1. New customers read the *responses* (not just reviews) to gauge
   whether the business cares — BrightLocal surveys: 88%+ of
   consumers say a business's reply influences their decision.
2. Google's local-pack algorithm factors response rate into ranking.
   No-reply businesses rank below otherwise-equivalent reply-active
   ones.
3. An unanswered 1-star review reads to a new browser as "the
   business doesn't even read complaints" — which is much worse than
   the original complaint.

When sending the audit, segment by their current response rate (visible
on their Google Business Profile):

- **0% response (never replies)** — UNAWARE segment. Lead with one
  short education line BEFORE the audit URL. They don't know reviews
  matter; the audit alone won't move them. One sentence is enough —
  don't lecture.
- **1–60% response (replies inconsistently)** — AWARE-BUT-LAZY
  segment. Skip the education line. Jump straight to "noticed N
  reviews unanswered, drafted some replies." They know the value;
  they need the activation energy.
- **60%+ response (replies consistently)** — DISQUALIFY. They're
  already doing the work; the demo is unimpressive to them, and the
  ROI math doesn't work. Skip.

The Thai email template below has both versions — pick based on
the prospect's response rate.

## What you've already done before sending the DM

1. Generated the outbound audit on the dashboard
2. Got back a shareable URL like `reviewhub.review/audit-preview/abc123`
3. Confirmed the URL renders properly on a phone (the prospect WILL
   open it on mobile — most owners do)
4. Identified the contact channel from `lead-finding.md` output (IG /
   LINE / FB / email)

Now you send the message.

## CRITICAL: Thai politeness particle — match to YOUR gender

Thai uses gendered politeness particles. Pick once, use everywhere:
- **Male sender** → use `ครับ` (and `นะครับ`, `ใช่ครับ`, etc.)
- **Female sender** → use `ค่ะ` (and `นะคะ`, `ใช่ค่ะ`, etc.)

The templates below default to `ครับ` (current sender Singharash is
male). If you're female, find/replace `ครับ` → `ค่ะ` and `นะครับ` →
`นะคะ` before sending. NEVER mix the two — using the wrong particle
reads as either a bot blast OR confused, both kill credibility.

## The DM template — Thai market (LINE + Instagram + Facebook)

This is the workhorse. Use this for 80% of your Thai outreach. It's
deliberately short — owners read DMs in 3–5 seconds while serving
customers.

```
สวัสดีครับคุณ{owner_name_or_blank}

แวะดู Google ของ{business_name}แล้วเห็นว่ายังมีรีวิว{N}อันที่ยังไม่ได้
ตอบ รวมถึง{1_star_or_recent_pain}ด้วย เลยลองร่างคำตอบให้ดูเล่น ๆ ลองดูได้ที่นี่นะครับ

→ {audit_url}

ถ้าโอเคจะตั้งระบบให้ตอบรีวิวแบบนี้ไปเรื่อย ๆ เดือนละ $14 (~฿480) ครับ ชำระเป็น USD
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

## Full email outreach playbook

For founders who want email as their primary channel (it works better
than DM for B2B verticals — hotels, agencies, professional services —
and is the right starting channel for anyone less comfortable with
Instagram/LINE).

### CRITICAL: do not send cold email from your transactional domain

Your `noreply@reviewhub.review` sends verification + billing emails
to paying customers. Do NOT also send cold outreach from that domain.

- Cold email gets flagged as spam by some recipients (always — it's a
  numbers game, not a quality issue)
- Spam reports lower the entire `reviewhub.review` domain reputation
- Paying customers' password-reset emails start landing in spam
- Customer can't reset password → support ticket → churn → bad time

Use a **dedicated outbound Gmail** for cold sends. Current outbound
sender: `earth.reviewhub@gmail.com`. Send 1:1 from Gmail's compose
window. Manual sending only — no automation, no third-party
mail-blast tools (Lemlist / Apollo / etc. all need a properly
warmed dedicated sending domain to not destroy your brand).

When outbound proves itself (50+ closes), graduate to a real sending
domain like `hello@reviewhub.email` with proper SPF/DKIM/DMARC + a
2-week warm-up. Not before.

### Volume rules

- **Personal Gmail cap**: 10 cold sends per day for the first 2 weeks.
  Gmail's anti-bulk safeguards kick in around 20+/day on a personal
  account. Above that and your sends start landing in spam regardless
  of content quality.
- After 2 weeks of consistent 10/day, can ramp to 25/day.
- Above 50/day on a personal Gmail = account suspension risk.

### Subject lines that get opened

Keep specific, factual, no clickbait. Cold email goes through 3
spam filters and 1 human triage — the subject has to survive all 4.

**Good:**
- `{business_name} — 6 unanswered Google reviews`
- `Reply drafts for {business_name}'s Google reviews`
- `Saw {business_name} on Google`
- `{business_name} — quick observation`

**Bad (auto-flagged):**
- "Quick question?" (spam marker, stop using this in 2026)
- "Boost your reviews!" (corporate-bot)
- ALL CAPS ANYWHERE
- Emoji in subject line (cold mail spam-flag)
- "Re:" / "Fwd:" tricks (gets you blocked)

### Email body — Thai market — UNAWARE segment (0% response rate)

Use this when the prospect has answered ZERO reviews. The opening
education line is the difference between "delete unread" and "huh,
I should look at this."

```
สวัสดีครับ

ลูกค้าใหม่ส่วนใหญ่อ่านรีวิวก่อนจอง — และสิ่งที่หลายคนไม่รู้คือ
พวกเขาอ่าน "การตอบกลับของร้าน" ด้วย เพื่อดูว่าร้านสนใจลูกค้าจริงไหม
รีวิวที่ไม่มีใครตอบเลยทำให้ดูเหมือนร้านปิดไปแล้ว

แวะดู Google ของ{business_name}แล้วเห็นว่ารีวิวล่าสุดหลายอันยังไม่ได้
ตอบเลยครับ {specific_observation_about_their_reviews}

เลยลองร่างคำตอบให้ดูเล่นๆ ใช้ AI ช่วยร่าง {N} รีวิวของจริง ลองดูได้
เลยครับ — ไม่ต้องลงทะเบียนอะไร:

→ {audit_url}

ใช้ฟรีได้เลย ก๊อปไปแปะใน Google เลย ถ้าอยากให้ระบบทำให้เรื่อยๆ
มีแพ็กเกจเริ่มต้น $14 หรือประมาณ ฿480 ต่อเดือน (ชำระเป็น USD)

ส่งมาให้ดูเผื่อมีประโยชน์เฉยๆ ครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

`{specific_observation_about_their_reviews}` — ALWAYS pull at least
one detail from their actual reviews (instructor name they're being
praised for, dish people keep mentioning, etc.). This is the
difference between "she actually read mine" vs "templated blast."

### Email body — Thai market — AWARE-BUT-LAZY segment (1–60% response)

Skip the education paragraph. They know reviews matter — they reply
to some. They just need a frictionless way to do more.

For tourist-facing properties (hotels, hostels, restaurants in
tourist zones, cooking schools), include the multilingual mention.
It's the line that makes a Bangkok owner say "oh, this is built for
my market." For purely-Thai-audience businesses, skip it — irrelevant.

```
สวัสดีครับคุณ{owner_name},

แวะดู Google ของ{business_name}แล้วเห็นว่ายังมีรีวิว{N}อันที่ยังไม่ได้
ตอบ รวมถึง{specific_pain}ด้วย

เลยลองร่างคำตอบให้ดูเล่นๆ ใช้ AI ช่วยร่าง แต่เขียนในโทนที่น่าจะใกล้เคียง
กับวิธีที่{business_name}น่าจะตอบเองครับ ลองดูได้ที่นี่นะครับ — ไม่ต้อง
ลงทะเบียนอะไร แค่เปิดดูเฉยๆ:

→ {audit_url}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ — รีวิวภาษาญี่ปุ่น/เกาหลี/
จีน/อังกฤษ ก็ตอบกลับเป็นภาษานั้นๆ ไม่ใช่ตอบอังกฤษทุกภาษา (เครื่องมือ
ส่วนใหญ่ทำได้แค่อังกฤษ)

ถ้าโอเคจะใช้คำตอบเหล่านั้นได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ให้
เรื่อยๆ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน ตั้งระบบใช้เวลาประมาณ 10 นาที

ถ้าคุณตอบรีวิวเองอยู่แล้วก็ไม่ต้องใช้ครับ ส่งให้ดูเผื่อมีประโยชน์เฉยๆ ครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

### Email body — English market

Use the multilingual mention specifically for international-facing
properties (hotels, hostels, tour operators, anywhere that gets
reviews in 5+ languages). Skip it for purely-English-audience
properties (US Yelp users etc.) — irrelevant noise for them.

```
Hi {owner_name},

Was looking through {business_name}'s Google profile and noticed
{N} reviews are unanswered, including {specific_pain}.

I drafted reply suggestions for all of them — AI-drafted, but in a
tone that sounded like how you might reply yourself. Take a look (no
signup, just a preview link):

→ {audit_url}

The drafts auto-detect the reviewer's language too — so the Japanese,
Korean, and Chinese reviews get replies in those languages, not
English ones. Most review-reply tools only do English.

Use any of those drafts directly if you like, on the house. If you
want this running on autopilot every time a new review lands, the
entry plan is $14/mo and takes ~10 min to set up.

No pressure. If you're already replying to your own reviews, totally
fine — just sending in case it's useful.

— Earth
ReviewHub · reviewhub.review
Bangkok
```

### Subject + body substitutions

Same rules as the DM template:
- `{owner_name}` — only if you can find it. "Hi คุณสมชาย" beats "Hi
  there." Wrong name is worse than no name; if uncertain, drop it.
- `{business_name}` — exactly as on Google. Don't translate.
- `{N}` — the unanswered count from your audit. Don't fudge.
- `{specific_pain}` — pick ONE concrete thing from their reviews:
  - "a 1-star from last week about cold coffee"
  - "two reviews from {month} that look like they expect a reply"
  - "several customer questions in the comments"
  Specifics > generics.

### The follow-up email (one allowed, sent 5 days after the first)

```
Hi again,

The draft replies link for {business_name} is still open if you want
to peek:

→ {audit_url}

No follow-ups after this one — just wanted to leave the door open.

— Earth
```

Thai version:
```
สวัสดีอีกครั้งครับ

ลิงก์ตัวอย่างคำตอบรีวิวของ{business_name}ยังเปิดได้นะครับ:

→ {audit_url}

ไม่ส่งติดตามอีกแล้วครับ ทักมาทีหลังก็ได้น้า

— Earth
```

### Tracking spreadsheet

Set up a Google Sheet with these columns:

| Date sent | Business name | Email | Audit URL | Opened? | Replied? | Reply gist | Closed? | Notes |

Fill it in as you send. The "Opened?" column gets updated by
checking `/outbound-audits` in the dashboard — it shows view count
+ first opened timestamp per audit.

Review the sheet every Sunday evening:
- Which subject-line variant got more opens?
- Which vertical / city is converting?
- Which prospect ghosted after opening?
- 5 minutes of pattern-spotting; tighten the next week's outreach
  based on what you see.

### Email-specific failure modes

In addition to the DM "Don't do these" list above:

- ❌ HTML formatting / colored fonts / images in the email body.
  Plain text only. Anything fancy = spam-flag for cold.
- ❌ Tracking pixels (the auto-add by some Gmail extensions).
  Disable any "track if opened" extension in your Gmail before
  sending. The view-count comes from the audit URL itself, which
  is fine — pixels in the email body are not.
- ❌ Attachments. URL only.
- ❌ "Reply STOP to opt out" at the bottom — that's a CAN-SPAM-act
  signature for B2C bulk mail. For 1:1 B2B sends it actually flags
  you as a bulk sender. Skip it.
- ❌ BCC'ing yourself or a CRM on every send. CRMs add tracking
  headers that Gmail's anti-spam learns to recognize on the
  recipient side. Send clean.

### When you DON'T have an email for the prospect

Some Google profiles list only a phone number. You have three
options:

1. **Skip them** — there are always more leads. Pace > completionism.
2. **Visit the website listed on their Google profile** — most
   businesses publish an email on a Contact page.
3. **Use the website's contact form** — slowest, lowest reply rate,
   but works as a last resort for high-priority leads.

Don't cold-call. The article you read suggested cold calling works,
but for review-management it doesn't — owners can't evaluate the
audit URL on a voice call. The whole pitch depends on them clicking.

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
- ❌ Quoting the price too high in the DM. The "$14 (~฿480)" anchor
  works because it's lower than they expect. If you say "starting at
  $14 (~฿480)" and the call closes at "well actually the Pro plan is $29"
  you've lost trust. Quote the entry price, upsell on the call.

## The follow-up message (only ONE allowed, sent 3+ days later)

```
สวัสดีอีกครั้งครับ ลิงก์ตัวอย่างคำตอบรีวิวที่ส่งให้ดูยังเปิดได้นะครับ
→ {audit_url}

ถ้าตอนนี้ยังไม่ใช่จังหวะ ค่อยทักมาทีหลังก็ได้ครับ
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
ขอบคุณครับ! โทรคุย 10 นาทีเลยดีกว่ามั้ย เลือกเวลาได้ที่นี่
→ {your_calendly_url}

หรือถ้าจะคุยทาง LINE ตอนนี้ก็ได้เลย เราจะดู{business_name}ด้วยกันแล้ว
ลองตั้งให้ดูเลย
```

Aim for the call. The audit got attention; the call closes.

### Reply B: "What's the catch?"

They saw the audit, like it, but suspect a gotcha. Be direct:

```
ไม่มีอะไรซับซ้อนครับ:
- $14 (~฿480)/เดือน ยกเลิกได้ตลอด
- AI ร่างคำตอบให้ คุณกดอนุมัติก่อนเผยแพร่เสมอ — ไม่มีการตอบอัตโนมัติ
- ข้อมูลรีวิวเก่าทั้งหมดถูก import ให้ตอนเริ่มใช้

อยากเห็นแดชบอร์ดมั้ยคะ จะเปิดให้ดูได้ที่ {dashboard_demo_url}
```

The "no auto-publish" line is the single most reassuring thing for
owners who've been burned by spam-bots before.

### Reply C: "ไม่สนใจครับ ขอบคุณ" / "Not interested, thanks"

```
ไม่เป็นไรครับ ขอบคุณที่สละเวลาดูน้า ถ้าเปลี่ยนใจวันไหนทักมาได้เลย

ขอถามนิดนึงได้มั้ยคะ — ส่วนไหนของ {audit_url} ที่รู้สึกว่ายังไม่ค่อยตรง?
อยากเอาไปปรับให้ดีขึ้น (ตอบเฉพาะที่อยากตอบนะครับ)
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
   and you take it from there. Setup is free; the $14/mo
   starts when your card hits the LemonSqueezy page."
4. **Handle silence:** if they pause, say "or take a few days, the
   audit URL stays live." Then SHUT UP. Don't fill the silence.

## Pricing on the call

| Setup | Monthly | When to quote |
|---|---|---|
| Free setup | $14 (~฿480) (Starter) | Default. Use this 80% of the time. |
| Free setup | 999 ฿ / $29 (Pro) | If they have 6+ platforms or asked about analytics |
| Free setup | 1,990 ฿ / $59 (Business) | Multi-location chain only |
| 3,000 ฿ one-time | $14/mo | If they ask "can you import all my old reviews and write replies for them?" — that's a setup-fee opportunity. The import itself is free; the manual reply-writing for the backlog is the upsell. |

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

## Pricing-objection journal — log every "no" so the next "yes" is closer

Cold-outreach pricing isn't validated by guessing. It's validated by
collecting actual rejections and seeing the pattern. Every time a
prospect replies negatively (or worse — opens, doesn't reply, then
later turns down the follow-up), capture the objection here. After
~10 entries, the price is either right (objections are rare and split
across reasons) or wrong (one reason dominates → adjust).

### How to log
Append a bullet after each declined conversation. Keep it terse —
2-3 fields max. Don't editorialize; capture words verbatim where
possible.

```
- {date} · {business_name} · {plan tier they declined} · "{verbatim
  objection in their language}" → {your interpretation in 5 words}
```

### Pattern thresholds
After 10 logged entries:
- **>5 cite price-too-high**: pricing is wrong for this segment, not
  the product. Test a $7/mo Starter or quarterly billing before
  changing the offer.
- **>5 cite "I'll do it manually"**: the value-prop doesn't beat
  zero-cost manual reply. Tighten the why-this-matters (response-rate
  → ranking, etc.) in the cold email; or pivot to a higher-ticket
  vertical (hotels, dental clinics) where opportunity cost is bigger.
- **>5 cite "we already use {X}"**: there's a competitor we're losing
  to. Find them, reverse-engineer their pricing/positioning, decide
  whether to differentiate or pivot.
- **>5 ghost (open URL, never reply)**: the audit-preview page isn't
  closing. The CTA isn't compelling, or the drafts aren't good enough
  to feel valuable. A/B the page; show it to 3 friends and ask "would
  you click 'set this up for me' here?"
- **Mixed pattern, no winner > 3**: pricing is approximately right.
  Keep volume-grinding.

### The journal

```
- 2026-05-04 · Pink Chili Thai Cooking · n/a · (no reply yet) → too early to interpret
- 2026-05-04 · House of Taste · n/a · (no reply yet) → too early
- 2026-05-04 · White Ivory B&B · n/a · (no reply yet) → too early
- 2026-05-04 · Vera Nidhra B&B · n/a · (no reply yet) → too early
- 2026-05-04 · Aim House Bangkok · n/a · (no reply yet) → too early
- 2026-05-04 · Better Moon Guesthouse · n/a · (no reply yet) → too early
- 2026-05-04 · May Kaidee Tanao · n/a · (no reply yet) → too early
- 2026-05-04 · Tingly Thai Cooking · n/a · (no reply yet) → too early
- 2026-05-04 · Sweets Cottage Academy · n/a · (no reply yet) → too early
```

(Add new entries above this line as conversations land.)

## Production health check before each outreach session

Before sending the day's batch, run the smoke script to make sure the
prospect-facing URLs are healthy. A broken `/audit-preview/<token>`
(500 page, expired SSL, deploy mid-flight) means every audit URL DM'd
that day is wasted.

```bash
./scripts/prod-smoke.sh
```

Hits the public surfaces, confirms 200s on landing/pricing/register
and 404s on bogus audit tokens. Takes ~10 seconds. If it fails, fix
before sending — a cold email pointing at a 500 destroys credibility.

## Reply playbook — what to say when they respond

When the 9 cold sends start landing replies, the 30-second window to
respond shapes whether the conversation continues. These are
pre-written for the 5 most likely cases. Treat them as starting
points; personalize the first sentence to whatever they actually
said, then drop in the body verbatim.

### 1. "$14/month is too expensive"

The most common objection on Bangkok SMB price sensitivity. Response:
acknowledge → reframe to ROI per saved hour → offer a concrete
"low-volume" entry path. Don't apologize for the price; the cost is
fair if the customer has the right volume.

**EN:**
```
Totally fair — pricing depends on how many reviews you actually get.
A quick math check: at $14/month you'd break even with about 4-5
saved minutes per review (tom-yum-gai-shop math: 2 min to read +
think + type vs 10 sec to approve a draft). If you get fewer than
~10 reviews/month it probably doesn't pencil. If you're getting 30+
it pays for itself before lunch.

Want me to send the actual reply drafts for your last 10 reviews
free, no signup, just so you can decide on real data?
```

**TH:**
```
เข้าใจครับ ราคาเหมาะสมหรือไม่ขึ้นอยู่กับจำนวนรีวิวที่ได้จริง
ลองคำนวณดู: $14/เดือน คุ้มเมื่อประหยัดเวลาตอบรีวิวประมาณ 4-5 นาทีต่อรีวิว
(2 นาทีคิด+พิมพ์เอง vs 10 วินาทีกดอนุมัติ draft) ถ้าได้รีวิวน้อยกว่า 10 ต่อเดือน
อาจไม่คุ้ม แต่ถ้าได้ 30+ คุ้มก่อนกลางวันเลยครับ

อยากให้ส่ง draft คำตอบ 10 รีวิวล่าสุดให้ฟรีไหมครับ? ไม่ต้องสมัคร
แค่จะได้ตัดสินใจจากตัวเลขจริง
```

### 2. "I'll do it manually / I have time"

The "I don't need a tool" objection. Don't argue against manual
reply (you'll lose). Reframe as scaling: tool wins when reviews go
up, not when they're at current volume. Plant the future-self
realization without saying it.

**EN:**
```
That works great when you're at your current volume. The owners who
ended up using us were doing it manually for years and then either
(a) opened a second location and the load doubled, or (b) had a
viral month where they got 50 reviews in 2 weeks and the backlog
broke them. The tool's mostly insurance for those moments.

If you ever do find yourself behind, the audit URL I sent you stays
live for 30 days — feel free to use the drafts manually any time.
```

**TH:**
```
เข้าใจเลยครับ ตอบเองดีที่สุดถ้าพอไหว ลูกค้าที่มาใช้ของเราส่วนใหญ่เคยตอบเอง
มาก่อน แล้วเจอ (ก) เปิดสาขา 2 แล้วงานเพิ่มเท่าตัว หรือ (ข) มีเดือนที่
รีวิวเข้ามารัวๆ 50 รีวิวใน 2 อาทิตย์ แล้วตอบไม่ทัน เครื่องมือคือเผื่อช่วงนั้น
ครับ

URL ที่ส่งไปยังใช้ได้ 30 วัน ก๊อป draft ไปแปะเองได้ตลอดครับ ไม่ต้องใช้แอป
ก็ได้
```

### 3. "We already use [competitor X]"

Don't trash-talk the competitor — they'll defend the sunk cost.
Pivot to differentiator + offer "no switch needed, parallel test."
Common competitors in this market: Birdeye, Podium, Reviewshake,
local Thai tools. Most are 5-10× our price.

**EN:**
```
Nice — sticking with what works is right. Most owners who switched
to us came from {competitor} for one specific reason: {one
differentiator}. We don't need you to cancel anything to find out
if the drafts are better — the audit URL above is exactly that
test. Same reviews, our drafts, you compare. If theirs are better,
that's good info.

Curious what made you pick {competitor} originally — that helps me
know if we're a fit at all.
```

Differentiators by competitor:
- **Birdeye / Podium**: 10× cheaper for the same Google-reply
  feature; we don't sell a CRM you don't need.
- **Reviewshake**: We auto-post, they require manual copy-paste.
- **Local Thai tools**: We support Thai + English natively in the
  same draft; most local tools force one or the other.

**TH:**
```
ดีครับ ที่ใช้อยู่ทำงานได้ก็อย่าเปลี่ยน ลูกค้าส่วนใหญ่ที่ย้ายมาจาก
{competitor} ย้ายมาเพราะเหตุผลเดียวคือ {differentiator} ไม่ต้องยกเลิก
ของที่ใช้อยู่เลย — URL audit ด้านบนเปรียบเทียบ draft เราได้ ถ้าของเขา
ดีกว่าก็ใช้ของเขาต่อครับ ข้อมูลที่ดี

อยากรู้ครับว่าทำไมตอนแรกถึงเลือก {competitor} จะได้รู้ว่าเราเหมาะหรือเปล่า
```

### 4. "Not interested right now"

Vague brush-off. Two paths: (a) graceful exit + plant a seed for
later, (b) one-question follow-up to surface the real objection. Go
with (a) by default; (b) only if they engaged at all (opened the URL,
said anything beyond "no thanks").

**EN — graceful exit (default):**
```
All good — totally understand. The audit URL stays live for 30
days, so feel free to grab the drafts any time without replying.
And if your situation changes (new location, new staff, busier
month), you have my email.

Best of luck with {business_name} — the reviews I read for the
audit were genuinely impressive.
```

**EN — surface the objection (if they engaged):**
```
Fair enough. Mind if I ask one thing — was it the AI part, the
price, the fact that you'd rather DIY, something else? I'm trying
to figure out what tool actually helps small {vertical} owners and
the "no, because…" answers are more useful to me than the yeses.
```

**TH — graceful exit:**
```
เข้าใจครับ URL audit ใช้ได้อีก 30 วัน ก๊อป draft ไปใช้ได้ตลอดถ้าเปลี่ยนใจ
ครับ ถ้าสถานการณ์เปลี่ยน (สาขาใหม่ คนใหม่ เดือนยุ่งๆ) ติดต่อกลับมาได้

โชคดีกับ {business_name} ครับ รีวิวที่ผมอ่านจาก audit ดีมาก
```

### 5. "Send me more info / what's the catch?"

Real interest. The product IS the demo (audit URL + signup); a sales
call would just be re-explaining what they already saw. Don't push
for a call — push them to sign up directly. Self-serve at 11pm beats
"let me check my calendar."

**EN:**
```
Sure — here's the short version:

1. You connect your Google Business profile once (OAuth, takes 30
   seconds). We pull your reviews automatically going forward.
2. Each new review, we draft a reply in your tone. You see it in
   the dashboard, edit if needed, hit Approve. Reply posts to
   Google live.
3. Auto-posting can be off if you want manual review only. Vacation
   mode pauses notifications. Tone (casual / warm / formal) is
   per-business.

Catch: there isn't really one — $14/mo, no contract, cancel any
time. Quirk: it's a small operation (me + the codebase), so support
is "email me and I reply within a few hours" not a ticket queue.

Easiest way to see it work: just sign up at reviewhub.review (free
plan, no card needed). Takes 60 seconds. I watch new signups
personally for the first week, so if anything's confusing or broken
I'll fix it the same day. Reply to this email if you get stuck on
any step.
```

**TH:**
```
ได้ครับ สรุปสั้นๆ:

1. เชื่อม Google Business ครั้งเดียว (OAuth, 30 วินาที) เราดึงรีวิวให้
   อัตโนมัติ
2. รีวิวใหม่ทุกครั้ง เราร่างคำตอบให้ในโทนของคุณ คุณเห็นในแดชบอร์ด
   แก้ได้ กด Approve คำตอบจะขึ้น Google ทันที
3. ปิด auto-post ได้ถ้าอยากตรวจเอง โหมดหยุดยาวหยุดการแจ้งเตือนได้
   ตั้งโทน (สบายๆ / อบอุ่น / ทางการ) แยกแต่ละร้าน

ไม่มี catch — $14/เดือน ไม่มีสัญญา ยกเลิกได้ตลอด ข้อจำกัด: เป็นทีมเล็ก
(ผม + codebase) support คือ "อีเมลมา ตอบภายในไม่กี่ชั่วโมง" ไม่ใช่
ticket queue ใหญ่

วิธีที่ง่ายที่สุดคือสมัครเลยที่ reviewhub.review (แพ็กเกจฟรี ไม่ต้องใช้
บัตรเครดิต) ใช้เวลา 60 วินาที ผมดูบัญชีใหม่ทุกบัญชีในสัปดาห์แรกเอง
ถ้าติดอะไรหรือมีบั๊กผมแก้ให้วันนั้นเลย ตอบอีเมลนี้ถ้าติดที่ไหนครับ
```

### 6. "Interested! How do I try this?" (warm response — DON'T waste it)

Different from objection #5 ("send me more info"). #5 is skeptical;
#6 is already convinced and asking for the path. Speed matters —
this is the highest-conversion moment in the funnel. Reply within
30 minutes if at all possible.

The reply does THREE things in 4 sentences:
1. Confirms you saw their reply (no robotic delay)
2. Gives them the direct link with their business name pre-filled
3. Sets one expectation about what happens in the first 5 minutes

**EN:**
```
Glad it landed! Here's the direct path:

→ reviewhub.review/register?from=audit&business={business_name_url_encoded}

Sign up takes 60 seconds. You'll connect your Google profile (OAuth),
we'll pull your reviews automatically, and you'll see the first AI-
drafted reply waiting in your inbox within ~5 minutes. Free plan, no
card. Reply here if anything's confusing — I personally watch every
new signup the first week.
```

**TH:**
```
ดีใจที่สนใจครับ! ลิงก์ตรงเลย:

→ reviewhub.review/register?from=audit&business={business_name_url_encoded}

สมัคร 60 วินาที จะให้เชื่อม Google (OAuth) เราดึงรีวิวให้อัตโนมัติ
แล้วประมาณ 5 นาทีจะเห็นคำตอบแรกที่ AI ร่างให้รออยู่ใน inbox
แพ็กเกจฟรี ไม่ต้องใช้บัตร ถ้าติดตรงไหนตอบอีเมลนี้เลยครับ ผมดู
บัญชีใหม่ทุกบัญชีในสัปดาห์แรกเอง
```

**TODO — sub-asset:** A 60-second screencast of "first signup → first
reply approved → reply visible on Google" would convert higher than
the "5 minutes from now" promise. Costs nothing to record once;
embed in this reply going forward. Loom or QuickTime → upload to
the static folder served by Railway → link in the reply body.

### Variables to fill in

`{competitor}` and `{differentiator}` come from the prospect's reply
(they'll name the competitor; pick the matching differentiator from
the table). `{business_name_url_encoded}` is `encodeURIComponent()`
of their business name (e.g. `The%20Corner%20Bistro`) so the
register page pre-fills cleanly.

No call-booking link needed — we deliberately route prospects to
self-serve signup instead. The audit URL already did the demo; the
signup flow is the conversion event.

### Tone notes

- Don't start with "Thanks for your reply!" — too eager. Open with
  "Totally fair" / "เข้าใจครับ" / "Nice" — peer-tone, not
  salesperson-tone.
- Drop everything else if they ask a specific question. The
  templates are framing aids, not scripts to read at someone.
- After 2 follow-ups with no progress, stop. Don't be the founder
  who emails 5x.
