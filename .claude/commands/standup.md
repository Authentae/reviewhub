---
description: Daily ReviewHub brief — what happened overnight, what to ship today
---

You're running the morning standup. Be terse. Use a single markdown table per section.

## Step 1 — Production health

```bash
curl -s https://reviewhub.review/api/health
```

Report: status, uptime, version, any component flagged as DOWN.

## Step 2 — Overnight signups + activity

```bash
railway logs 2>&1 | grep -E "user.register|user.login|billing.checkout|review.respond" | tail -20
```

Count: new signups, new logins, new checkouts, new replies posted.

## Step 3 — Errors in last 24h

```bash
railway logs 2>&1 | grep -iE "error|exception|fatal|TypeError" | grep -v "wp-admin" | tail -10
```

If anything looks new (not just bot scanners hitting /wp-admin), call it out as P1.

## Step 4 — Operating queue snapshot

Read [docs/operating-queue.md](docs/operating-queue.md). For each section
(CODE/WEB/BUSINESS/CUSTOMER/OPS), count `[ ]` (todo) vs `[wait:*]` (blocked) vs
`[done]`. Surface the single highest-priority `[ ]` item with a one-line "what
shipping this unlocks" rationale.

## Step 5 — Opportunities NOT on the queue

Per the CLAUDE.md "look up from the queue" rule. Don't just report
what's on the queue — surface what's *missing* that would be high-
leverage at the current stage.

Pick 2-3 candidates by category. Pre-revenue solo signals to weigh:
- SEO surfaces still missing (free tools, schema, vertical pages)
- Conversion-rate work (pricing anchors, CTA copy, A/B ideas)
- Content + lead-magnet ideas (blog topics, screencasts, calculators)
- Customer-development opportunities (interview prospects who didn't reply)
- Competitor teardowns (objection-handling ammo)
- Onboarding-flow audits (first paying customer doesn't churn silently)

Format: one-line item + one-line rationale + "(can ship: me/you/both)"

If you can't think of any: that's a signal you're stuck in queue-execution
mode. Read the wiki at [docs/reviewhub-wiki.md](docs/reviewhub-wiki.md)
for stage context, then try again.

## Step 6 — Recommended top action

Pick ONE thing to ship today, considering BOTH the queue's top item
AND the opportunities surfaced in Step 5. Decision order:
1. Production fires beat everything else
2. `[wait:user]` items beat new work (don't pile up blockers)
3. CUSTOMER section beats CODE section (revenue closer to the surface)
4. A non-queue opportunity beats a queue item if its ROI is clearly
   higher AND the founder would likely pick it if they saw both side-by-side
5. Tie? Pick whatever's smallest blast radius.

End with: `**Top action:** <one sentence>. Reply "go" to ship.`
