# Runbook — first Stripe customer: manual provisioning

Until we wire a Stripe webhook for the ReviewHub Stripe account, every
new paid subscription needs you to manually grant access. This runbook
is the exact step-by-step so you don't have to figure it out under
time pressure when the first customer pays.

## Trigger

You'll receive **two emails** in quick succession from Stripe to
`death._.earth@hotmail.com` (the email the ReviewHub Stripe account
is registered to — see [docs/reviewhub-wiki.md](../reviewhub-wiki.md)):

1. **"New subscription: ReviewHub Starter / Pro / Business"** —
   from `notify@stripe.com`, subject contains the plan name and the
   customer's email
2. **"Receipt: payment of $14.00 / $29.00 / $59.00"** — customer-
   facing receipt, copied to you as the account owner

The customer themselves will land at
`https://reviewhub.review/register?from=stripe&plan=<starter|pro|business>&checkout_success=1`
right after paying. They see the "Payment received — welcome to
ReviewHub" banner I shipped 2026-05-16 (commit `613c4de`) and complete
account signup with the same email they paid with.

## ⏱ Time budget: under 2 minutes per customer

If you're spending more than 2 minutes, something's wrong — open
Sentry and check for `billing.checkout_started` audit events not
matched by a subsequent user.register.

## Step 1 — Get the customer's email from Stripe

Stripe dashboard → Sales → Subscriptions → click the new subscription
row → copy the **customer email** (top of the page). Format:
`firstlast@example.com`.

## Step 2 — Confirm they also created a ReviewHub account

```sh
# From any machine that can hit prod via authed-Chrome (or admin API key)
# Replace EMAIL_HERE with the Stripe customer email
curl -s "https://reviewhub.review/api/admin/users?email=EMAIL_HERE" \
  -H "Authorization: Bearer $RH_ADMIN_KEY" | jq
```

You should see a single user row with `id`, `email`, `created_at`.

**If no user row exists yet:** the customer hasn't completed the
`/register?from=stripe` form. Wait ~10 minutes; sometimes they get
distracted between paying and signing up. If still no row after an
hour, email them directly (they paid! they want this!) from
`earth.reviewhub@gmail.com`:

> Hi [name], saw your Stripe payment for ReviewHub Starter — looks
> like you didn't finish the account-creation step. Here's the
> direct link: https://reviewhub.review/register?from=stripe&plan=starter&checkout_success=1
>
> Use the same email you paid with so the systems line up.
>
> — Earth

## Step 3 — Mark the user as paid in the DB

Two SQL options. Pick A for one-shot, B if you want to also stash the
Stripe subscription ID for future webhook integration.

### A. Minimum-viable provision (fastest)

```sh
# Replace USER_ID and PLAN_HERE (starter | pro | business)
railway run --service reviewhub -- sqlite3 /app/data/reviews.db \
  "UPDATE subscriptions
      SET status = 'active',
          plan = 'PLAN_HERE',
          renewal_date = datetime('now', '+1 month')
    WHERE user_id = USER_ID;
   SELECT * FROM subscriptions WHERE user_id = USER_ID;"
```

⚠ **`railway run` executes against your LOCAL machine's filesystem
with Railway env vars wired**, NOT against the Railway volume.
The above only works if you SSH into Railway first:

```sh
railway ssh
# Then inside the container:
sqlite3 /app/data/reviews.db
# UPDATE ... (same SQL as above)
```

Per memory file `feedback_railway_run_db_divergence.md` — this is a
known foot-gun; always SSH for prod DB writes.

### B. Provision with Stripe metadata (recommended if you have 10 sec extra)

```sql
-- From Stripe dashboard, copy the subscription ID (sub_xxxxxxxxxxxxx)
-- and customer ID (cus_xxxxxxxxxxxxx) from the subscription detail page.
UPDATE subscriptions
   SET status = 'active',
       plan = 'PLAN_HERE',
       renewal_date = datetime('now', '+1 month'),
       billing_subscription_id = 'sub_xxxxxxxxxxxxx',
       billing_customer_id = 'cus_xxxxxxxxxxxxx'
 WHERE user_id = USER_ID;
```

Why this matters: when we wire the webhook later, having
`billing_subscription_id` already populated lets it reconcile against
existing rows instead of creating duplicates.

## Step 4 — Send the customer a personal welcome

This is the differentiator vs Birdeye / Podium — the founder personally
emails every first paying customer. Template (from
`earth.reviewhub@gmail.com`):

> Subject: Welcome to ReviewHub, [first name]
>
> Hey [first name],
>
> Earth here — the solo founder behind ReviewHub. Just wanted to say
> thanks for being one of our first paying customers. Your account
> is active and the next Google review on [their business] will ping
> your [LINE / Telegram / email] with an AI-drafted reply.
>
> Two things that'll help you get the most out of week one:
>
> 1. Connect either LINE or Telegram in Settings (or both — alerts
>    will fire on each channel). The notification card has a copyable
>    draft block so it's literally tap, paste, post.
>
> 2. If you want me to walk through the first reply with you, hit
>    reply with a time and I'll jump on for 15 min. (No upsell — I
>    want to see how you actually use it so I can fix friction.)
>
> Anything weird, broken, or missing — reply to this thread, not the
> support form. I'll see it within an hour during Bangkok daytime.
>
> — Earth

Send from the brand account (`earth.reviewhub@gmail.com`) — NOT
`theearth1659@gmail.com`. Per memory file
`feedback_identity_and_capability_check.md`.

## Step 5 — Log the win

1. Append to [`docs/reviewhub-wiki.md`](../reviewhub-wiki.md) under
   "Customers": one line with date, name, plan, source (audit URL /
   pricing direct / referral).
2. Update the operating queue [`docs/operating-queue.md`](../operating-queue.md):
   move "Wire Stripe webhook for auto-provisioning" from `[wait:signal]`
   to `[ ]` — first customer means it's worth building now.
3. (Optional but high-leverage) Post a one-line build-in-public update
   somewhere (X, LinkedIn, indie hackers): *"First paying customer for
   ReviewHub today. [Business type], $14/mo Starter."* Social proof.

## When to stop using this runbook

This runbook is the **bridge until ~customer #5**. Once you have a
handful of paid subs, the Stripe webhook is worth building:

- Webhook URL: `https://reviewhub.review/api/billing/webhook` (already
  exists — currently wired for LemonSqueezy; needs Stripe handler
  added)
- Stripe webhook signing secret env var: `STRIPE_WEBHOOK_SECRET`
- Events to handle: `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`
- Wire-up estimate: 2-3 hours including testing against Stripe's test
  fixtures

Until then, this manual flow is fine. Pre-revenue, talking to every
customer is a feature, not a cost.

## If the customer disputes the charge

Refund from Stripe dashboard (Sales → Refunds → Issue refund). Don't
push back; pre-revenue chargebacks compound fast on your Stripe
account health score. The $14-59 isn't worth the dispute fee.

Then immediately:
```sql
UPDATE subscriptions SET status = 'cancelled' WHERE user_id = USER_ID;
```

Email them: "No worries — your subscription is cancelled and the
refund is processing. If you change your mind, [resubscribe link].
Anything I can fix that would have made this work for you?"
