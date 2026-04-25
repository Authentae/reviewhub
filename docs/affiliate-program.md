# Affiliate / Referral Program — Design Doc

**Status:** scaffolding shipped (schema + referral-code endpoint +
signup attribution); payout integration pending until first 20+ paid
users exist.

## Goal

Let indie bloggers, YouTubers, and happy customers earn money for
referring paying ReviewHub users. Every dollar of affiliate payout buys
distribution that the founder doesn't have to generate personally —
critical for the solo / no-outreach GTM.

## Scope — what's shipped

1. **`users.referral_code` (TEXT, unique where not null)** — lazy-assigned
   on first GET `/api/auth/referral-code`. 8-char alphanumeric code,
   avoiding ambiguous characters (0/O/1/I).
2. **`users.referred_by_user_id` (INTEGER)** — populated at signup time
   when `?ref=CODE` appears on the signup URL or in the POST body.
3. **GET `/api/auth/referral-code`** — returns the caller's referral
   code, the shareable link, and count of users who signed up via it.
4. **Signup attribution** — `POST /auth/register` accepts `?ref=CODE`
   (query) or `ref: 'CODE'` (body). Silent on invalid codes.
5. **Database indexes** — unique-where-not-null on `referral_code` and
   a plain index on `referred_by_user_id` for stats queries.

## Scope — not shipped (future work)

| Item | Why deferred | Unblocks when |
|---|---|---|
| Payout calculation cron | No payees yet | After 5 affiliates sign up |
| LemonSqueezy affiliate API integration | LS has built-in affiliate tools; evaluate those first | When first affiliate is ready to get paid |
| Affiliate dashboard UI | Only useful once there's data to show | After 10 referrals exist |
| Commission tier structure | Too many unknowns today | After 3 months of data |
| Cookie/localStorage tracking for delayed signups | Complexity; URL param covers 80% of cases | After measuring conversion loss |

## How payout works (planned)

Two options, will pick closer to launch:

### Option A — LemonSqueezy Affiliates (preferred)

LemonSqueezy has a built-in affiliate program — each store can enable
it, and affiliates sign up through LS's own flow. ReviewHub gets
automatic payout + tax handling + reporting through LS. No payout
code needed on our side.

Pros:
- Zero code
- Tax + payout handled by LS (who is our Merchant of Record)
- Affiliates get their own dashboard

Cons:
- Locked into LS
- Attribution is cookie-based on LS's side — may not capture users
  who sign up via our register page first then upgrade later

### Option B — Custom (fallback if LS doesn't fit)

- Manual monthly job reads `users.referred_by_user_id` + joins
  `subscriptions` where plan != 'free' and payment was on time
- Computes 20% of each paid month for the first 12 months per referral
- Exports CSV of payout instructions
- Manual bank transfers (for first 10 affiliates) → switch to Wise
  bulk-payment API once volume justifies

## Commission structure

**Initial offer:** 20% lifetime commission on all paid-tier revenue
from referred users, for as long as the referred user stays subscribed.

Rationale:
- 20% is the indie-SaaS standard (competitors range 15-30%)
- Lifetime (vs. first-month-only) is more attractive to publishers
- "As long as the referred user stays" caps exposure — the referrer
  has skin in the game to refer good-fit users, not churn risks

Cap: $1,000/month per affiliate for the first year. Prevents a single
mega-referrer from making the program financially unviable before we
have data to price it properly.

## Fraud / abuse prevention

- **Self-referrals blocked:** check `referred_by_user_id != id` before
  ever paying out.
- **Email-domain overlap flag:** if a referrer's email domain matches
  the referred user's domain, hold payout for manual review.
- **Rapid-signup throttle:** more than 5 signups in 1 hour from a
  single referral code triggers a review queue item.
- **Free-tier only:** no commission is earned from Free-tier referrals,
  so farming fake signups has no ROI.
- **Refund clawback:** if a referred user refunds within 30 days, the
  corresponding commission is reversed.

## Launch plan

1. **Month 0 (now):** scaffolding shipped. Any user can get their code.
2. **Month 1-2:** soft-launch — mention to 5 known indie-SaaS bloggers
   via their public contact forms (async email only, no calls).
3. **Month 3:** evaluate LS Affiliates vs. custom build based on who
   actually signed up + what they want.
4. **Month 4:** first payout run (manual if needed).
5. **Month 6:** build affiliate dashboard if signal is strong.

## Terms (to publish on /affiliate page when ready)

Short version for now:

> You get 20% of what your referred users pay us, every month, for as
> long as they're paying. Capped at $1,000/month per affiliate. Paid
> monthly via LemonSqueezy (or manually until that integration is
> ready). Self-referrals don't count. Refunded payments are clawed back.
> We can change the terms with 30 days' notice, but anything you've
> already earned is yours.

Full legal version: TBD by counsel before launch.

## Metrics to track

- **Active affiliates** (unique referral codes used in signup in the
  last 30 days)
- **Referrals per affiliate** (to spot the 80/20)
- **Paid conversion rate of referred users vs. organic signups** —
  this is the key quality metric; if < 2x organic, program isn't
  acquiring better users and we should cut commission
- **Commission payout as % of MRR** — target: < 15% of new-MRR in
  steady state
