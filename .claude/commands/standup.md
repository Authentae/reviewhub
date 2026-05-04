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

## Step 5 — Recommended top action

Pick ONE thing to ship today based on:
1. Production fires beat queue items
2. `[wait:user]` items beat new work (don't pile up blockers)
3. CUSTOMER section beats CODE section (revenue closer to the surface)
4. Tie? Pick whatever's smallest blast radius.

End with: `**Top action:** <one sentence>. Reply "go" to ship.`
