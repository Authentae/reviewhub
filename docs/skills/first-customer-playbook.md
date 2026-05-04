# First-customer playbook

What to do in the first 24 hours after someone says yes. Pre-built
now, deployed on first reply. The goal is to over-deliver early so
the customer is hooked before the first month-end charge — and to
make first-customer mistakes once instead of repeatedly.

## When this kicks in

Triggered by any of:
- A reply to one of the 9 cold sends saying "yes" / "sign me up" /
  "tell me more and the answer is yes" / Thai equivalent
- A signup at reviewhub.review/register that completes the email
  verification step
- A successful billing checkout (LemonSqueezy webhook)

The first qualifying event wins. If they reply yes by email AND
sign up before you respond, treat it as one customer with extra
self-serve momentum.

## Hour 0 — Acknowledgement (within 30 min of their action)

The window between "I just signed up" and "did anyone notice" is
where 50% of new SaaS users churn silently. Close it loud.

### Email response

Send from earth.reviewhub@gmail.com (the same account they replied
to or got the audit from), NOT from noreply@reviewhub.review.
Personal-feel matters here.

```
Hey {first_name},

Saw you signed up — thanks for trying it. I'm Earth, the founder
(and currently the entire engineering team — small operation,
that's the truth).

I'm watching your account specifically for the next 48 hours. If
ANYTHING is confusing, broken, or just weird, email me directly and
I'll reply within an hour. Things to know:

- Your audit URL ({audit_url}) is still live for 30 days; the
  drafts I made are already in your dashboard if you want to
  review-and-publish them now.
- Auto-posting to Google is on by default. If you'd rather review
  each reply before it goes live, toggle in Settings → Reply
  preferences (TBD: build the toggle).
- The status page is at /status if you ever wonder "is it me or
  the app."

What's your single biggest review-management headache right now?
That's what I'd want to make sure you can fix in the first day.

— Earth
```

### Internal: log the customer

Add to a new file `docs/customers.md` (gitignored — contains PII):
```
{name} · {email} · {business_name} · acquired {date} via {source}
  audit_url: {url}
  notes: {anything memorable from cold-email replies}
  first_login_at: TBD
  first_reply_published_at: TBD
  first_billing_charge_at: TBD
```

Tracking these per-customer milestones manually for the first 5
customers — lets you see exactly where the activation funnel breaks
in real life, not in test data.

## Hour 0-24 — Watching the funnel

Things to check throughout the first day. Spend 5 min each, 4-6
times.

### Every 2 hours, log into the admin dashboard and check:

1. **Did they verify email?** If still pending after 2h, send a
   nudge: "Did the verification email land in spam? Forward me a
   screenshot if it never arrived and I'll fix the SMTP path."
2. **Did they connect Google?** Most common stuck point. If
   verified but no platform_connection row, send: "The Google
   connect step trips a few people because the OAuth screen looks
   spammy. Want me to walk you through it on a 5-min call?"
3. **Did reviews ingest?** Once Google's connected, reviews land
   within 5 min. If not after 30 min, manually trigger a sync from
   the admin endpoint and email: "Triggered a manual fetch — should
   land in your dashboard now."
4. **Did they reply to anything?** First reply published is the
   real activation event, not the signup. If they have unanswered
   reviews 24h after Google connect, send template-prompt: "Saw 3
   reviews land — want me to walk through the first reply with you?"
5. **Did response_posted_at populate?** Confirms the auto-post
   actually worked end-to-end. If they replied locally but
   response_posted_at is null after 5 min, something's broken in
   the platform-post path. Investigate immediately.

### What to NOT do

- Don't send marketing emails. They'll get the lifecycle sequence
  (day 1 / 3 / 7 / 14) automatically; that's enough.
- Don't ask for testimonials yet — too early.
- Don't pitch the upgrade. Free → Starter is usage-driven, not
  founder-pushy.
- Don't add them to a "customer Slack" or "founders chat" or
  anything that creates ongoing social obligation. They want a
  product, not a relationship.

## Day 1 end — The honest check-in

24 hours after signup, send one email:

```
Hey {first_name} — quick honest check-in. You've been on for 24h.

Three questions, ignore any that aren't useful:

1. Did anything confuse you in the first 10 minutes?
2. Have any of the AI drafts felt wrong (off-tone, generic, missed
   context)? Reply with the review URL and I'll look at the prompt.
3. What made you actually pull the trigger and sign up — was it
   the audit URL, the price, something else?

No need to reply if everything's fine — I'll assume green.

— Earth
```

Treat replies as gold. The "what made you pull the trigger" answer
is your highest-quality marketing copy for the next 100 cold sends.

## Day 7 — Unsolicited save

7 days after signup, before any churn risk:

```
Hey {first_name},

You've replied to {N} reviews this week — average rating moved from
{X} to {Y}, you've responded to {Z}% of new ones (industry default
is 40%). That's the real signal.

If you're up for it, two things help me a lot:

1. A 1-line testimonial I can put on the site. Anything that's
   honest — including critical ("the onboarding was confusing but
   the drafts are good"). Either way, no pressure.
2. If anyone you know runs a Google-reviewed business and might
   benefit, I'll comp their first month. Email me the intro and I
   handle the rest.

Either of those = I owe you a drink the next time we cross paths
in BKK.

— Earth
```

The asks are deliberately optional + non-transactional ("up for
it," "no pressure"). Customers who say yes to either become
champions; ones who don't are still happy customers.

## Common problems + responses

### "The drafts don't sound like me"

Most-common feedback. Two fixes available:

1. Per-business reply tone (Settings → AI reply tone). Casual /
   warm / formal. Each tone has 8-10 prompt rules tuning the AI.
2. Manual edit the first 3-5 drafts before publishing — the AI
   doesn't learn from this directly (no per-business
   fine-tuning), but seeing your actual replies gives YOU pattern
   recognition for which tone works.

If neither fixes it, let me know and I'll look at the specific
prompts; sometimes the platform's review style doesn't match the
default.

### "It auto-posted before I could review!"

Real complaint, panicked customer. Acknowledge the design choice +
offer the toggle:

```
That's on me — auto-post is on by default because most owners told
us they wanted hands-off. There IS a way to require manual approval
for every reply (Settings → Reply preferences) but it's a future
addition we haven't shipped yet. For the immediate moment: I can
flip your account to "drafts only, no auto-post" manually. Want me
to do that now?
```

(TODO: ship the per-account "draft-only mode" so this doesn't
require manual ops.)

### "Google rejected the reply"

Rare but real. Google's content policy occasionally flags AI replies
that mention competitors, refunds, or specific staff names. The
provider's `replyToReview` will return an error and the row's
response_posted_at stays null.

```
Google flagged the reply for {their stated reason}. This happens
occasionally with mentions of {competitor / refund / specific name}.
I've reverted the post; you can edit the reply in your dashboard
and try again. The error message is in your dashboard logs at
{path}.
```

(TODO: surface the exact rejection reason in the UI; right now it's
console-only.)

### "Cancel my account"

It happens. Don't fight it. Don't ask why three times. One email:

```
No problem — cancelled. If you're up for sharing what the dealbreaker
was, that helps me build the right product going forward; if not,
no worries.

If you ever want to come back, your data is retained for 30 days
(GDPR-compliant erasure on request). Reactivation is just signing
back in.

Best of luck.

— Earth
```

Single ask, single offer, single sentence each. Do not extend.

## What this playbook DOES NOT cover

- Refund handling — see `docs/policies/refund-policy.md` (TBD)
- Legal questions — see `legal/triage-nda` agent
- Multi-location / agency-tier needs — refer to roadmap "read-only
  role" item (currently `[wait:user]` on architecture choice)
- Press / media inquiry — out of scope for first-customer phase

## Iteration log

After the first 5 customers, come back and rewrite this file based
on what actually happened. The pre-built version is informed by
generic SaaS-onboarding patterns; the rewritten one will be informed
by real ReviewHub customers.

```
Customer 1: {date}, {business_name}, {what surprised us}
Customer 2: …
Customer 3: …
```
