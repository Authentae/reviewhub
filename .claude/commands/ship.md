---
description: Queue-driven autopilot — ship the top operating-queue item, repeat until blocked
---

Run **queue-driven autopilot** for ReviewHub. The user is asleep, AFK, or just trusts
you. Don't ask questions, don't pause to summarize, don't propose stopping points.

## Loop

1. **Read** [docs/operating-queue.md](docs/operating-queue.md).
2. **Pick** the highest-priority `[ ]` item across all sections, ranked by:
   - CUSTOMER beats BUSINESS beats CODE beats WEB beats OPS (revenue closer first)
   - Within a section, top-listed item wins
3. **Ship it** end-to-end:
   - Code change → tests → build → commit → `git push` → `railway up --detach` if applicable
   - Doc change → write → commit → push
   - Decision → write the decision into the queue + a memory file
4. **Mark it `[done]`** in the queue with a one-line "what shipped" note.
5. **Loop back to step 1.**

## When to stop

Only stop when ONE of these is true:

- Every section has `[ ]` count = 0 (all blocked or done) — write a one-paragraph
  status report and exit
- A ship requires the user (e.g., paste a real LemonSqueezy variant ID, approve a
  destructive migration, sign a contract) — mark item `[wait:user: <what's needed>]`
  and pick the next one
- You hit a real production error you can't fix without more info — mark item
  `[wait:signal: <what to watch>]` and pick the next one

## Hard rules

- **Never ask "which option?"** for low-risk reversible work. Pick.
- **Never write end-of-turn summaries** between items. Just ship and move on.
- **Always run `npm run build`** after client changes before commit.
- **Always run `npm test`** in any package you touched before commit.
- **Always tail `railway logs`** for ~30s after deploy to catch crashes.
- **One commit per item.** No mega-commits.

## Token budget awareness

If you're getting deep into the conversation and feel context pressure, prefer
finishing the current item cleanly over starting a new one. Leave a clear handoff
note in the queue about exactly where to resume.
