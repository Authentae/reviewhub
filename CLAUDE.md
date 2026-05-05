# ReviewHub — house rules for Claude Code

You're working on **ReviewHub** — Bangkok-based AI review-reply SaaS. Solo founder
(earth / Singharash). Pre-revenue. Production at https://reviewhub.review.

This file is loaded into your context every session. Keep it updated when conventions change.

---

## Stack

- **Server:** Node + Express + SQLite (better-sqlite3) at [server/src](server/src)
- **Client:** React + Vite + Tailwind at [client/src](client/src)
- **Hosting:** Railway, project `rare-passion`, service `reviewhub`
- **Domain:** reviewhub.review (Cloudflare-fronted)
- **Tests:** 186+ green; client uses Vitest, server uses node:test
- **Email:** Resend (port 2587 — Railway blocks 587)
- **Billing:** LemonSqueezy
- **Auth:** Email/password + Google OAuth + magic link (all shipped)

## Commands you'll run constantly

```bash
# Build client
cd ~/Desktop/App/client && npm run build

# Run server tests
cd ~/Desktop/App/server && npm test

# Run client tests
cd ~/Desktop/App/client && npm test

# Deploy to Railway (push first, then up)
cd ~/Desktop/App && git push && railway up --detach

# Tail Railway logs
railway logs

# Check production health
curl -s https://reviewhub.review/api/health | jq
```

## Conventions you must follow

- **Build before claiming done.** Always run `npm run build` after client changes.
- **i18n placeholders are single-brace `{name}`, NOT `{{name}}`.** Codebase t() function
  uses single brace. Double brace silently breaks at runtime.
- **Brand tokens** in [client/src/styles/dashboard-system.css](client/src/styles/dashboard-system.css):
  - `--rh-paper` `#fbf8f1` (warm off-white)
  - `--rh-ink` `#1d242c` (near-black)
  - `--rh-teal` `#1e4d5e` (primary)
  - `--rh-rose` `#c2566c` (alerts)
  - `--rh-sage` `#6b8e7a` (positive)
  - Typography: Instrument Serif (headings), Inter (body), JetBrains Mono (eyebrows)
- **Don't add backwards-compat shims** when changing internal code — change the call site.
- **Don't ask "which option" for low-risk reversible changes.** Pick and ship. Options
  are reserved for irreversible blast-radius (DB drops, force-pushes, billing changes).

## Keywords that mean "keep going, don't summarize"

`ship`, `go`, `more`, `continue`, `keep going`, `work the queue`, `autopilot`

When the user says these, DO NOT pause to ask what's next. DO NOT write end-of-turn
summaries. Pick the next obvious thing and ship it.

## Operating queue

Single source of truth for cross-domain work: [docs/operating-queue.md](docs/operating-queue.md).
Sections: CODE / WEB / BUSINESS / CUSTOMER / OPS. Status flags `[ ]` `[wait:user]`
`[wait:signal]` `[wait:deploy]` `[done]` `[skip]`. Ship the top `[ ]` item, repeat
until every section is `[wait:*]`.

## Slash commands you can use

- `/standup` — daily brief: signups, errors, support, top queue item
- `/ship` — run queue-driven autopilot from anywhere

## What's already shipped (don't rebuild)

- Auth: email/password, Google OAuth, magic link, MFA, password reset
- Reviews: ingestion (Google real provider + 30 mocks), reply drafting (Anthropic Haiku),
  bulk actions, tags, pinning, flagging, presets, share tokens
- Billing: LemonSqueezy webhook + checkout for Starter/Pro/Business × monthly/annual
- Ops: backups (24h), Sentry forwarder, audit log retention, /api/health, /admin
- Marketing: Landing, Pricing, Roadmap, Status, Blog, Audit landing, API docs, Support

## Things that will trip you up

- **Gmail labels** — only one MCP available; not bulk-edit safe
- **`getDbSync()` does not exist** in [server/src/db/schema.js](server/src/db/schema.js).
  Use `get`, `insert`, `run`, `transaction` from `require('../db/schema')`.
- **`run()` doesn't return lastInsertRowid** — use `insert()` for INSERT.
- **Magic-link tokens are sha256-hashed in DB** — don't compare raw.
- **Production OAuth callback** sets a cookie AND must redirect to `/auth/google/done#token=...`
  so the client can persist the `rh_logged_in` localStorage marker. Without that the
  user bounces back to /login.
- **Railway deploy fingerprint:** `/api/health` returns `uptime_seconds`. Poll until
  it's <60 to confirm a fresh container.

## Memory location

`C:\Users\Computer\.claude\projects\C--Users-Computer-Desktop-App\memory\` — auto-loaded.
Update via `Write` to that directory + add to `MEMORY.md` index.

## Business wiki

[docs/reviewhub-wiki.md](docs/reviewhub-wiki.md) is the single source of truth
for non-code facts: customers, outreach signals, lessons learned, what's
working, what's not, decisions deferred. Read this before proposing any
strategic change. Update it when something material happens (first
customer, churn, pricing change, real signal from outreach).

## Look up from the queue — surface what's missing

The operating queue is a list of *things someone-already-named*. It is
NOT a complete list of everything that would move the business forward.
A good collaborator notices what's missing.

**When the queue empties or runs low** — and especially when about to
say "blocked on you" — pause and run an *opportunity-spotting pass*
against the project's current stage. Don't just stop. Propose 2-3
high-leverage items the queue is missing, ranked by stage-appropriate
ROI. Examples of what "high-leverage at pre-revenue" means:

- SEO surfaces (vertical pages, schema, internal linking, free tools)
- Conversion-rate work (pricing page anchors, funnel CTA copy, A/B candidates)
- Content + lead-magnet work (blog posts, screencasts, free tools)
- Customer-development work (interview existing prospects, NPS-style probes)
- Competitor teardowns (lets the founder answer objections in outreach)
- Onboarding email + first-week-experience audits (first paying customer doesn't churn silently)

**The rule:** before announcing "blocked on you" or "queue is empty,"
ask one question — *"if a sharp peer reviewed our roadmap right now,
what would they say is missing?"* — and surface those candidates.
Don't ship them silently; surface them and let the founder choose.

This rule exists because in May 2026 the agent shipped through 27
queue items and announced "blocked on you" while SEO — a high-impact
opportunity for a pre-revenue solo SaaS — was completely absent from
the queue and never surfaced. The founder had to name it themselves.
That's a collaboration failure. Don't repeat it.

## Be an obsessive note-taker

You are a collaborator, not an assistant. Log everything material you do
or learn. After shipping anything non-trivial:
1. Update [docs/operating-queue.md](docs/operating-queue.md) — mark item
   `[done]` in the same commit that ships it (not a follow-up commit)
2. If a *fact about the business* changed (customer, pricing, signal,
   lesson), append a dated line to [docs/reviewhub-wiki.md](docs/reviewhub-wiki.md)
3. If a *recurring pattern* emerged (a foot-gun, a convention, a tool
   discovery), add a memory file to `~/.claude/projects/.../memory/`
   and update `MEMORY.md`

Cost of a one-line note: 5 seconds. Cost of re-deriving the fact next
session: 5 minutes. The math is obvious.
