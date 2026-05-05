# How to use your Claude Code setup

Everything that was just installed, what it does, when to use it, and how it
works under the hood. Read this once. Bookmark it.

---

## 1. `CLAUDE.md` (project root)

**File:** [CLAUDE.md](CLAUDE.md)

**What it is:** A "house rules" file Claude Code auto-loads into context every time
you open this project. Contains stack, commands, conventions, brand tokens, what's
already shipped, and gotchas.

**When it runs:** Every session. Automatic. You don't do anything.

**When to update it:** When you change a convention. Examples:
- You switch from Railway to Fly.io → update the deploy commands
- You add a new keyword that should mean "keep going" → add to the keywords list
- You ship a new auth method → add to "What's already shipped"

**Why it matters:** Without this, every session I have to re-derive things like
"how do I deploy" by reading commits or asking you. With it, I just know.

---

## 2. Statusline

**File:** `~/.claude/statusline/reviewhub.sh`
**Config:** `~/.claude/settings.json`

**What it is:** A one-line status bar at the bottom of every Claude Code prompt
showing: current git branch, time of last commit, queue depth (todo vs blocked),
free disk space.

**Sample output:**
```
🌿 main · 3 hours ago · 📋 7 todo · 4 blocked · 💾 15G free
```

**When it runs:** Before every prompt. Cached for ~1s by Claude.

**When to look at it:** Constantly. It's the cheapest way to know:
- "Am I about to commit on the wrong branch?"
- "Is the disk full again?"
- "Do I actually have queue items left or am I done?"

**To customize:** Edit `~/.claude/statusline/reviewhub.sh`. Keep it under 200ms or
prompts feel laggy.

---

## 3. `/standup` slash command

**File:** [.claude/commands/standup.md](.claude/commands/standup.md)

**What it does:** Runs your morning brief in 5 steps:
1. Production health check (`/api/health`)
2. Overnight signups + activity from Railway logs
3. Errors in last 24h (filtered to ignore bot scanners)
4. Operating queue snapshot per section
5. Recommended top action for today

**How to use:** Type `/standup` in Claude Code. That's it.

**When to use:** Once per day, usually first thing. Replaces "what's left to do"
+ "any prod issues" + "what should I work on" with one command.

**Sample output you'll see:**
```
## Production health
| Component | Status |
|---|---|
| API | OK (uptime 4h 12m) |
| Auto-post | enabled:google |

## Overnight activity
| Event | Count |
|---|---|
| Signups | 0 |
| Logins | 3 |
| Replies posted | 2 |

## Errors
None new (5 wp-admin scanner hits, ignored).

## Queue
| Section | Todo | Blocked | Done |
|---|---|---|---|
| CODE | 3 | 1 | 12 |
| CUSTOMER | 2 | 0 | 1 |
| ...
Top item: "Refill outreach queue" — unlocks first paying customer.

**Top action:** Refill outreach queue with 7 verified prospects. Reply "go" to ship.
```

---

## 4. `/ship` slash command

**File:** [.claude/commands/ship.md](.claude/commands/ship.md)

**What it does:** Queue-driven autopilot. Picks the highest-priority `[ ]` item
from the operating queue, ships it end-to-end (code → tests → build → commit →
push → deploy), marks it `[done]`, picks the next, repeats.

**Stops only when:**
- Every section is blocked or done
- An item needs YOU (paste a real ID, approve a destructive thing, sign a contract)
- A real production error blocks progress

**How to use:** Type `/ship` in Claude Code. Walk away. Come back to a list of
`[done]` items + a handoff note.

**When to use:**
- Going to bed and want stuff to ship overnight
- Stepping away for a meeting
- You don't know what to do next and want me to just go

**Versus saying "go":** `/ship` is the formal command that loads the autopilot
ruleset. Saying "go" works too (your memory has this codified) but `/ship` is
explicit and harder to misinterpret.

---

## 5. Pre-commit hook

**File:** `.git/hooks/pre-commit`

**What it does:** Before every `git commit`, runs:
- Server tests if any `server/` files changed
- Client build if any `client/` files changed
- Skips if only docs changed (no `.js/.jsx/.css/.json`)

**If it fails:** Commit is rejected. Error printed. Fix and re-commit.

**To bypass (rare):** `git commit --no-verify -m "WIP"`. Only use if you know
what you're doing — e.g., committing a half-done branch you're not pushing yet.

**Why it matters:** Prevents the "I broke prod with a typo" class of bugs.
Catches it locally in 30s instead of waiting for Railway to fail in 90s.

---

## How they work together

A typical day with this setup:

```
🌿 main · 8 hours ago · 📋 7 todo · 4 blocked · 💾 14G free
> /standup

[Claude shows the brief, recommends top action]

> go
[Claude ships the top item — code, test, build, commit, push, deploy]
[Pre-commit hook silently runs build before commit]
[Item marked [done] in operating queue]
[Statusline updates: 📋 6 todo · 4 blocked]

> /ship
[Claude loops through the next 5-10 items autonomously]
[Stops when blocked or done]

> [you go to lunch / sleep / whatever]
[Comes back to a list of shipped items + handoff]
```

---

## Where things live

| File | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | House rules (auto-loaded) |
| [docs/operating-queue.md](docs/operating-queue.md) | Cross-domain work source-of-truth |
| `.claude/commands/*.md` | Slash commands (project-scoped) |
| `~/.claude/settings.json` | Global Claude Code settings |
| `~/.claude/statusline/reviewhub.sh` | Statusline script |
| `~/.claude/projects/.../memory/` | Long-term memory across sessions |
| `.git/hooks/pre-commit` | Local git safety net |

---

## 6. Mission Control HTML dashboard

**File:** `scripts/mission-control.sh`

**What it is:** A static HTML dashboard showing your project at a glance —
queue counts per section (todo/blocked/done), last 10 commits, production
health, free disk, memory file index. No server, no always-on machine.
Open it whenever you want a snapshot.

**How to use:**
```bash
bash scripts/mission-control.sh > /tmp/mc.html
start /tmp/mc.html        # Windows
# or: open /tmp/mc.html   # Mac
# or: xdg-open /tmp/mc.html  # Linux
```

**When to use:** Sunday morning, after a deploy, or any time you want
"where is the project right now" in one screen. Re-run the script for
fresh data (it reads files + hits production each time).

**Why not a live always-on dashboard?** That would need a dedicated
machine you don't have. Static snapshot covers 95% of the value. If
you eventually run a 24/7 setup, this script is the seed for a
proper dashboard.

## 7. Business wiki

**File:** [docs/reviewhub-wiki.md](docs/reviewhub-wiki.md)

**What it is:** Single source of truth for *non-code* facts about the
business — customers, outreach signals, lessons learned, what's making
money, decisions deferred. Karpathy LLM-wiki style. Claude reads this
every session before proposing strategic changes.

**How to use:** Update it when something material happens. Examples:
- First paying customer → add to "Customers" with name, plan, channel
- Real reply to an outreach email → add to "Active outreach signals"
- Pricing change → update "Pricing"
- Painful debugging session → add the lesson to "Lessons learned"

**Why this matters:** Without it, every session I have to ask "what's
working, what's blocked, who's a customer." With it, I just know.

## What's NOT installed (and why)

- **Telegram/Discord bot** — needs an always-on machine. You don't have one. Ping
  me if/when you get a $5/mo VPS or a spare Mac and I'll wire one up.
- **Mission Control dashboard** — pretty but solves nothing you can't get from
  `git log` + Railway UI + the statusline.
- **Multi-agent crew** — you can already spawn Agents when needed via the `Agent`
  tool. Formalizing it adds ceremony for solo work.
- **Auto-deploy notifications** — Railway already emails you on deploy fail.
  Adding a Telegram ping requires the always-on machine again.

When ReviewHub has its first paying customer + you have a reason to be more
leveraged, revisit those.
