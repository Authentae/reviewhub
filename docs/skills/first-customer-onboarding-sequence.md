# First-customer onboarding email sequence (30-day arc)

**Activates:** The moment the first paying customer's webhook fires
(LemonSqueezy `subscription_created` → `/api/billing/webhook`) OR
when Earth manually marks a user as paid via `/admin`.

**Purpose:** The first 30 days are when customers either internalise
ReviewHub as part of their workflow OR forget about it and churn at
next month's charge. A 5-email arc keeps them engaged without
spamming — each touchpoint times to a moment they actually need
something.

**Sender:** `earth.reviewhub@gmail.com` (brand account). Per Earth's
"no founder name" preference, signatures are "ReviewHub" not "Earth."

**Why an email sequence (not in-app):** First customers may not log
in daily. Email is the channel that reaches them where they are.
In-app onboarding (welcome modal, etc.) belongs separately — this
sequence is the parallel email track.

---

## E1 — Welcome (Day 0, immediately after webhook)

**Timing:** Within 5 minutes of payment. Critical — the window
between "I just paid" and "did anything happen" is when customers
form their first impression. Close it fast.

**Subject:** `Welcome to ReviewHub — your account is live`

**Body:**
```
Hi {first_name_or_business_name},

Your ReviewHub Starter subscription is active. Here's exactly what
happens next:

1. Set up your account (2 min)
   {DASHBOARD_URL} — sign in with the email you used for purchase.

2. Connect Google (1 click)
   In Settings → Integrations → Connect Google Business Profile.
   ReviewHub will sync your last 30 reviews and start watching for
   new ones.

3. Get drafts on LINE or Telegram (3 min)
   In Settings → Notifications → connect LINE or Telegram. The next
   time a new review lands, you get a draft on your phone within
   60 seconds. Tap to copy, paste in Google.

That's the whole workflow. If something doesn't work in the first
48 hours, reply to this email — we read everything.

ReviewHub · reviewhub.review
```

---

## E2 — First-draft check-in (Day 2)

**Timing:** 48 hours after E1. Only sends IF they've actually
connected Google AND have ≥1 draft generated. (If they haven't
connected Google, send the "connect Google" nudge below instead.)

**Subject:** `Your first ReviewHub draft — did it sound right?`

**Body:**
```
Hi {first_name_or_business_name},

Your first AI-drafted reply landed yesterday for the review from
{reviewer_first_name} ({review_first_words}...).

One question: did the draft sound like {business_name} would
actually post it, or did it read generic? A one-line answer (or
even a 👍 / 👎) is genuinely useful — it's how we tune the prompts
for your specific tone.

If you HAVEN'T posted it to Google yet, you can edit + post from
the dashboard, or copy from LINE/Telegram and paste into Google's
reply box. Both work.

ReviewHub · reviewhub.review
```

**Branch — if Google not connected yet by Day 2:**

Subject: `Quick step we missed — connecting Google`

Body:
```
Hi {first_name_or_business_name},

Noticed your ReviewHub account is active but Google isn't connected
yet. Without that, drafts can't generate. Three options:

1. Connect from Settings → Integrations (1 click, 60 seconds)
2. Forward me a screenshot of where you're stuck and I'll walk you
   through it (sometimes Google's OAuth flow is grumpy on certain
   browsers)
3. If the answer is "I changed my mind" — reply with "refund please"
   and I'll process within 24 hours. 30-day window is well past
   day 2.

No pressure either way.

ReviewHub · reviewhub.review
```

---

## E3 — First-week voice check (Day 7)

**Timing:** Day 7 after payment. Sends regardless of whether E2
fired (different content).

**Subject:** `One week with ReviewHub — what's working?`

**Body:**
```
Hi {first_name_or_business_name},

You've had ReviewHub for a week. By now you've seen {draft_count}
drafts roll through (or you haven't — different problem).

Three things I'm trying to learn — answer one if any apply:

  1. What's the BEST draft we generated for you so far? (Copy/paste
     it back if easy — I want to see what we got right.)
  2. What's the WORST draft? (Same — I want to see what to fix.)
  3. Anything in the dashboard that's confusing or missing?

A one-line answer to any of these is the most useful feedback we
get. Even "nothing's broken, it just works" is signal.

ReviewHub · reviewhub.review
```

---

## E4 — Time-saved framing (Day 14)

**Timing:** Two weeks. Reinforces the value before the second
billing cycle (Day 30 for monthly Starter).

**Subject:** `Two weeks in — quick numbers`

**Body:**
```
Hi {first_name_or_business_name},

Quick check on the two weeks since you joined ReviewHub:

  Drafts generated:  {draft_count}
  Drafts posted to Google: {posted_count}
  Avg time to first draft after review: ~{avg_seconds}s
  Time saved vs typing each from scratch: ~{minutes_saved} min

(These numbers are visible anytime in Dashboard → Analytics.)

If those numbers feel low or wrong, that's worth a reply — we
might be missing reviews or your business isn't getting many new
ones this week.

If they feel about right, you're now {minutes_saved}-minutes ahead
on review replies — small but compounds.

ReviewHub · reviewhub.review
```

**Defensive coding note:** if any `{X_count}` is 0 (e.g. no drafts
posted yet because they're still reviewing before posting), the
template needs different framing. Default branch:

Subject: `Two weeks in — anything to fix?`

Body:
```
Hi {first_name_or_business_name},

Quick check on the two weeks since you joined ReviewHub:

  Drafts generated:  {draft_count}
  Drafts posted to Google: {posted_count}

If "drafts generated" is 0, you might not be getting many new
reviews this week (totally normal for some businesses) OR Google
isn't fully connected (less normal — reply if so).

If "posted" is 0 but "generated" is >0, you're either reviewing
each before posting (totally valid) or you don't trust the drafts
(reply with what's off — that's the most useful feedback we get).

ReviewHub · reviewhub.review
```

---

## E5 — Renewal context (Day 27)

**Timing:** 3 days before second billing cycle. Most-emails-from-
SaaS-companies-ignored window. Keep ultra-short.

**Subject:** `ReviewHub renews in 3 days`

**Body:**
```
Hi {first_name_or_business_name},

Quick heads-up: ReviewHub renews {renewal_date} for $14.

If you'd rather cancel, no problem — Settings → Billing → cancel.
No questions, no retention prompts. (You stay subscribed through
the end of the paid period.)

If you're staying: nothing to do.

If something's not working, reply to this email FIRST before
canceling — we can usually fix in 24 hours.

ReviewHub · reviewhub.review
```

---

## Operational rules

1. **Each email sends ONLY ONCE per customer.** Idempotency via a
   `customer_email_sent` table or a `users.onboarding_email_X_sent_at`
   column. Don't double-send.
2. **All template variables MUST have safe defaults.** A null
   `draft_count` should produce "0" not "{undefined}". Defensive
   string formatting.
3. **E2's branching logic (Google connected? has drafts?) must be
   gated** before send. If neither path applies, skip E2 entirely
   for that customer (don't send a generic version that ignores
   their state).
4. **All sends should go via Resend** (existing infra) — not LS's
   email-marketing tool. LS broadcasts are for marketing; these are
   transactional + behavioral.
5. **Send window: 9-11 AM in customer's local timezone.** Default
   to UTC+7 (Bangkok) if no timezone signal; better: detect from
   their LS-provided locale at signup.
6. **Reply tracking:** any reply to these emails goes to Earth's
   inbox (the From-address). Resend doesn't auto-thread; Earth
   manually responds to each reply within 24 hours.

---

## When to update this sequence

- **After first 5 paying customers go through it** — gather
  open/reply rates per email, look at where customers drop off,
  iterate.
- **When churn happens** — if a customer cancels on Day 28-30, look
  at which emails they opened, reply rate, and what they said.
  Update the sequence to address whatever they said.
- **When a customer says "X email was really helpful" or "Y was
  annoying"** — log to wiki, refine template.

---

## What this sequence is NOT

- **NOT a marketing campaign.** Each email triggers off a real
  state transition (paid, draft generated, week elapsed). Not a
  drip on a schedule.
- **NOT a sales nurture.** They're already paying. Goal is RETENTION
  + EXTRACTION OF FEEDBACK, not upgrade.
- **NOT scalable forever.** At 100 customers this works. At 1000,
  the "reply within 24 hours" promise breaks. Plan for retirement
  or automation when MRR hits ~$1k.

---

## Pre-deployment checklist

- [ ] Implement send-trigger logic in server (or schedule via a
      worker) — wire to webhook receipt
- [ ] Add `users.onboarding_emails_sent` JSON column for idempotency
- [ ] Template files in `server/src/emails/onboarding-1.html` etc
- [ ] Smoke-test against Earth's own email (treat as test customer)
- [ ] Wait 30 days, watch metrics, iterate

---

**Status:** DRAFT — pre-built for the first-customer landing.
Activates only when LS webhook fires for first paid signup.
