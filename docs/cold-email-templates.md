# Cold-email templates for ReviewHub outreach

> Send these from your real personal Gmail or `you@reviewhub.review`. **Not**
> a marketing tool. Not bcc'd. One at a time, personalized, replied to like
> a human. 10/day max for the first week or Gmail flags you.

## Why these work (read once)

1. **Subject line references their actual business state**, not a feature.
   "I noticed your 2-star review from last month" beats "Try ReviewHub
   Free!" by ~10x open rate.
2. **Body opens with proof you looked them up**, not a pitch.
3. **Includes one usable thing** (a drafted reply to *their* actual review).
   Even if they don't sign up, they get value. They remember you.
4. **Soft CTA**: "If useful, here's where to get it" — never "BUY NOW".
5. **One link maximum**. More links = spam filter triggers.

---

## Template 1 (Thai) — restaurant/cafe with negative review

**Subject:** `เห็นรีวิว {rating} ดาวล่าสุดของ {business_name} แล้ว`

```
สวัสดีครับ/ค่ะ {first_name},

ผมเป็นผู้ก่อตั้ง ReviewHub — แดชบอร์ดรวมรีวิว Google สำหรับธุรกิจไทย

แวะ Google Maps มาเห็น {business_name} มีรีวิว {review_count} รายการ
และมีรีวิว {rating} ดาวเมื่อ {month} ที่ยังไม่ได้ตอบ:

> "{negative_review_excerpt}"

ลองร่างคำตอบให้แล้ว — ถ้าใช้ได้ลองคัดลอกไปโพสต์บน Google เลยครับ:

---
{ai_drafted_response}
---

ถ้าอยากได้ร่างแบบนี้ทุกครั้งที่มีรีวิวใหม่ — ใช้ฟรีที่ reviewhub.review
(3 ร่างต่อเดือนฟรีตลอดไป, $14/เดือนถ้าต้องการไม่จำกัด)

ถ้าไม่ใช้ก็ไม่เป็นไรครับ — หวังว่าคำตอบที่ร่างให้จะมีประโยชน์

ขอบคุณครับ
{your_first_name}
ReviewHub · reviewhub.review
```

### Variables you fill manually for each prospect

| Variable | Where to find it |
|---|---|
| `{first_name}` | Owner's first name from their Google business listing or About page |
| `{business_name}` | Exact name from Google Maps |
| `{review_count}` | Total reviews shown on Google Maps |
| `{rating}` | The specific star rating of the negative review |
| `{month}` | Approximate month, e.g. "เดือนมีนาคม" |
| `{negative_review_excerpt}` | First 1–2 sentences of the actual negative review (verbatim) |
| `{ai_drafted_response}` | Run their review through `/tools/review-reply-generator` on your own site, paste the output |
| `{your_first_name}` | Yours |

---

## Template 2 (English) — same idea, English-speaking SMB owner

**Subject:** `Saw your 2-star Google review from last month`

```
Hi {first_name},

I'm the founder of ReviewHub — a Google review dashboard for local
businesses.

I was checking Google Maps and noticed {business_name} has
{review_count} reviews, with a {rating}-star one from {month} that
hasn't been replied to yet:

> "{negative_review_excerpt}"

Drafted a reply for you — feel free to copy it onto Google as-is:

---
{ai_drafted_response}
---

If you want this every time a review comes in, it's free to use at
reviewhub.review (3 drafts/month free forever, $14/month if you need
more).

No worries either way — hope the draft above is useful regardless.

{your_first_name}
ReviewHub · reviewhub.review
```

---

## Template 3 (Thai) — ALL-positive-reviews business

When they have only 4–5 star reviews, the "noticed your 2-star" hook
doesn't work. Use this instead.

**Subject:** `รีวิว 5 ดาวของ {business_name} ตอบไปกี่อันแล้วครับ?`

```
สวัสดีครับ/ค่ะ {first_name},

แวะ Google มาเจอ {business_name} — รีวิวเฉลี่ย {avg_rating} ดาว
จาก {review_count} รีวิว เก่งมากครับ

แต่สังเกตว่ามีหลายรีวิวที่ยังไม่ได้ตอบกลับเลย เช่นอันนี้:

> "{positive_review_excerpt}"

Google เคยรายงานว่าธุรกิจที่ตอบรีวิว (แม้แต่รีวิวดี) จะปรากฏ
ในผลค้นหาบ่อยกว่าธุรกิจที่ไม่ตอบ ~30%

ลองร่างคำตอบให้คุณ {first_customer_name} แล้ว:

---
{ai_drafted_response}
---

ถ้าอยากได้แบบนี้ทุกครั้งที่มีรีวิวใหม่ — ลองใช้ฟรีที่ reviewhub.review

ขอบคุณครับ
{your_first_name}
```

---

## Template 4 (Thai) — follow-up if no reply after 7 days

Sent only ONCE. If they don't reply to the second one, drop them. Don't
become a stalker.

**Subject:** `Re: เห็นรีวิว {rating} ดาวล่าสุดของ {business_name} แล้ว`

```
สวัสดีอีกครั้งครับ/ค่ะ {first_name},

แค่อยากให้แน่ใจว่าอีเมลก่อนหน้าไม่ตกไปอยู่ในสแปม

ลองร่างคำตอบให้แล้วเมื่ออาทิตย์ก่อน — ถ้าใช้แล้วก็ไม่ต้องตอบครับ
ถ้ายังไม่ได้อ่าน ส่งให้ดูอีกรอบ:

> {original_email_quoted_in_2_lines}

ถ้าตัดสินใจไม่ใช้ก็ไม่ต้องตอบเลยนะครับ ไม่ส่งซ้ำอีกแน่นอน

ขอบคุณครับ
{your_first_name}
```

---

## What NOT to do

- ❌ **Do NOT bcc multiple prospects.** Each email is one-to-one.
- ❌ **Do NOT use Mailchimp / SendGrid / any marketing tool** for this.
  They taint your domain reputation. Use real Gmail.
- ❌ **Do NOT include images / logos / formatted HTML.** Plain text only.
  Marketing-formatted email = filtered out.
- ❌ **Do NOT include 2+ links.** One link, to your site. That's it.
- ❌ **Do NOT send 50 in one day.** 10/day Mon–Fri = 50 in week 1.
  More than 10/day from a fresh Gmail account = your account gets
  flagged within 48 hours.
- ❌ **Do NOT auto-reply via Claude.** When they reply, YOU read and
  YOU respond. They smell automation in 2 seconds.
- ❌ **Do NOT skip the personalization.** If you can't find their first
  name + a real recent review, skip that prospect. Generic "Hi there"
  emails get 0% reply rate.

## Tracking

Drop each email into a Google Sheet:

| date_sent | business_name | email | language | template_used | replied_at | outcome |
|---|---|---|---|---|---|---|
| 2026-04-28 | Sakura Coffee | owner@... | th | T1 | 2026-04-29 | trial_signup |

`outcome` values: `no_reply`, `polite_no`, `replied_question`, `trial_signup`,
`paid_signup`, `bounced`.

After 50 sends, calculate:
- **Open rate** (use Gmail's "read receipt" sparingly or assume from reply rate)
- **Reply rate** — your single most important number
- **Conversion rate** — replies → trials
- **Trial → paid** — trials → first month revenue

Industry benchmark for cold outreach this personalized:
- Reply rate: 8–15%
- Trial signup: 30–50% of replies
- Trial → paid: 10–20% of trials

Math at 10% reply / 40% trial / 15% paid: 50 sends → 5 replies → 2
trials → 0.3 paying customers. So you're looking at roughly **150–300
sends to land your first paying customer this way.**

That sounds bad until you remember each customer is $14–59/month
recurring. One paying customer pays for 5+ months of your tooling.

## When to stop using cold email

- You have 30+ paying customers via outbound — you can hire someone
  else to do this, or switch budget to ads
- Your reply rate drops below 3% over 3 batches of 50 — your message
  isn't landing, redo the templates from scratch with what you learned
- One customer publicly tweets that you spammed them — pause and
  rethink targeting

## Tools you might want later (not now)

- **Hunter.io** — find email addresses from a domain ($49/mo)
- **Apollo.io** — same plus enrichment ($99/mo, free tier exists)
- **Clay.com** — best-in-class for hyper-personalized at scale ($149/mo)
- **Streak CRM** — Gmail-native CRM, free tier good for first 100 prospects
- **Mailtrack** — free open tracking inside Gmail, gives you the open-rate signal

Don't buy any of these until you've sent your first 50 manually. The
manual sends teach you things tools hide.
