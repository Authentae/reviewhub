# Overnight status — 2026-05-20

While you slept (~14 hours), the cron at `7,27,47 * * * *` ground through
the 14-item finite queue in `docs/overnight-queue-2026-05-20.md`. All 14
shipped cleanly. **0 blockers, 0 STOP triggers fired, CI green throughout.**

Cron is now idle — on the next :07/:27/:47 fire it will detect no `[ ]`
items remaining and exit without rescheduling.

---

## What to look at first (in this order)

### 1. `docs/strategy-conversation-2026-05-20.md` — 5-min briefing
The morning summary capturing every framing decision from tonight:
- The "active wave ≠ product scope" meta-rule (and why I kept failing it)
- The product is **global** by design, Bangkok is the current OUTREACH segment
- The $0 phased plan (Phase 0 free data → Phase 4 $5k MRR) with triggers
- The 5-D segment grid (geography × vertical × volume × channel × pricing)
- What we deliberately are NOT doing yet
- 5 open decisions for you to make

### 2. `docs/seo-pillar-cluster-map.md` — needs your sign-off
Proposes 5 segment-agnostic pillars for restructuring the existing 33
blog posts: reply mechanics / negative reviews / acquisition+tracking /
AI replies / multilingual+multi-platform. Approve the pillar choice
before any actual restructure happens. The doc also lists 14 gap-cluster
posts to write later, ranked by impact.

### 3. Free data tools (~25 min, requires your Google account)
The single most-important Phase-0 action: install **Google Search Console**
+ **Microsoft Clarity**. Both free. Search Console reveals what queries
we're already ranking for (data we never had); Clarity captures session
replays so we stop shipping conversion experiments blind. Step-by-step in
the strategy doc.

---

## What shipped (14 items, 14 commits + queue-marker commits)

| # | Item | Commit | What |
|---|------|--------|------|
| 1 | `/trust` page | [eda4436](https://github.com/Authentae/reviewhub/commit/eda4436) | Pre-OAuth data-access transparency — closes the #1 customer-flow friction (audit page lists what we access via Google OAuth + 6 sub-processors). Linked from footer Company. |
| 2 | `/integrations` page | [9e591e1](https://github.com/Authentae/reviewhub/commit/9e591e1) | What we connect to — Google BP API + Places fallback, CSV import, email-forward, LINE/Telegram/WhatsApp-roadmap, Anthropic Claude. Honesty-lint caught "60+ platforms" first push; rephrased to be honest about Google-only auto-polling. |
| 3 | `llm.txt` at site root | [356f222](https://github.com/Authentae/reviewhub/commit/356f222) | Markdown site summary per llmstxt.org for AI crawlers (ChatGPT/Claude/Perplexity/Gemini). 12-month early-mover edge. `LLM-content:` pointer added in `robots.txt`. |
| 4 | SEO pillar+cluster map | [85cbdc8](https://github.com/Authentae/reviewhub/commit/85cbdc8) | Proposal doc — 5 segment-agnostic pillars, all 17 existing topics mapped, 14 gap posts proposed, internal-linking plan. **Needs your sign-off.** Caught a Bangkok-narrowing draft of Pillar 5 in re-read and reframed before commit. |
| 5 | Strategy conversation summary | [6100bda](https://github.com/Authentae/reviewhub/commit/6100bda) | 5-min morning briefing. **Read this first.** |
| 6 | Wiki strategic decisions | [ceab803](https://github.com/Authentae/reviewhub/commit/ceab803) | New section at the top of `reviewhub-wiki.md` (right after Canonical handles) locking in tonight's framing. Future sessions read this before anything else. |
| 7 | `/why-us` page | [ccdafed](https://github.com/Authentae/reviewhub/commit/ccdafed) | 5 beliefs that shaped the tool (ChatGPT-paste doesn't scale, voice consistency, privacy as feature, ambient triggers, small is right). No founder names per your preference. |
| 8 | Newsletter signup widget + backend | [db46f7d](https://github.com/Authentae/reviewhub/commit/db46f7d) | New `newsletter_signups` table, `POST /api/newsletter` with honeypot + rate-limit + **9 server tests**, `NewsletterSignup` React component (panel + inline variants), wired into Landing (above footer) + BlogIndex (above footer). SQLite-only; export to ConvertKit/Loops when the list grows. |
| 9 | MarketingFooter refresh | [0df41df](https://github.com/Authentae/reviewhub/commit/0df41df) | All 4 groups now exactly 8 links. Product: dropped redundant Home, added /audit-demo (highest-leverage conversion surface, previously buried). Resources: dropped Bangkok-narrowed featured link. Company: added /about alongside /why-us. |
| 10 | Schema.org Organization + WebSite | [ccf1542](https://github.com/Authentae/reviewhub/commit/ccf1542) | Enhanced Organization (sameAs to X + GitHub, description, founding location, 2 contactPoints). New WebSite entity declaring 10 locales. **SearchAction deliberately skipped** — no `/search` endpoint, fake URL would get rejected by Google. |
| 11 | `security.txt` enhanced | [5feb5bb](https://github.com/Authentae/reviewhub/commit/5feb5bb) | Added Canonical URL, Policy pointing at `/trust`, Encryption placeholder (commented — uncomment when you generate a PGP key), Preferred-Languages now en+th, Expires refreshed to 2027-05-20. |
| 12 | OG meta audit | [657962d](https://github.com/Authentae/reviewhub/commit/657962d) | `useSocialMeta` added to 6 pages that lacked it: Pricing, AuditLanding (uses `/og-image-audit.png`), Guide, Changelog, Support, About. Landing intentionally skipped — index.html defaults already optimized for it. |
| 13 | `/api/admin/waitlist-stats` tests | [1656ffb](https://github.com/Authentae/reviewhub/commit/1656ffb) | 8 tests including a **PII exclusion canary** (recent rows must NEVER include email — guards against future SELECT * regression). Queue's premise about `/api/health` was wrong; solid coverage already exists in `health.test.js`. |
| 14 | This status report | _(this commit)_ | The doc you're reading. |

---

## Blockers + judgement calls

**Zero hard blockers.** The session ran end-to-end without ambiguity needing
your call. Four soft decisions made unilaterally that you should sanity-check:

1. **Item 2** — honesty-lint caught "60+ platforms" on first push. Rephrased
   the /integrations page to be honest about Google-only auto-polling +
   ~20 confirmed CSV platforms. Marketing was too generous.

2. **Item 4** — caught a Bangkok-narrowing draft of Pillar 5 in re-read.
   Reframed to "multilingual & multi-platform" before commit. Same class
   of error the `feedback_active_wave_is_not_product_scope.md` meta-rule
   warns about — recurring even with the warning in place.

3. **Item 8** — newsletter widget shipped to Landing + BlogIndex, but NOT
   to the 33 static blog HTML files. Per-file HTML edits would have taken
   a full cycle on their own and the value-per-edit was marginal. Revisit
   later via a script if the widget converts well.

4. **Item 10** — Schema.org SearchAction deliberately omitted. We have no
   `/search` endpoint, and Google rejects schema with fake URLs. Add the
   SearchAction the day a real search endpoint ships.

---

## What this session DIDN'T touch

Per your locked-surfaces list, none of these were modified:
- Gmail, billing, JWT_SECRET, DB migrations, audit-preview copy
- Wave 5 outreach state / outreach-queue.md / per-prospect data
- No emails sent, no Stripe / LemonSqueezy state changed
- No paid third-party tools installed or signed up for
- No directory submissions (they need your accounts)
- No external API calls beyond build/test/git

**$0 spent. 0 third-party signups. 14 deep ships.**

---

## Open decisions parked for you

From the strategy doc, restated:

1. **Pillar choice** (`docs/seo-pillar-cluster-map.md`) — sign off on the 5
   pillars or tell me to merge/split.

2. **Google Search Console + Microsoft Clarity** — install when you have
   25 minutes. Step-by-step in the strategy doc.

3. **Wave 5 monitoring rhythm** — daily check on `/admin/brief`. If you
   want push alerts on every audit-view, ~30 min to wire up.

4. **Pre-Wave-5-result branch prep** — want me to set up Branch-A
   (case-study template, directory submission list) and Branch-B
   (customer-dev interview-question polish) IN ADVANCE so we react
   faster Sunday?

5. **Deferred dependency upgrades** (`docs/deferred-dependency-upgrades.md`)
   — Anthropic SDK 0.79→0.96 and vite 5→8 both still parked. Revisit at
   Phase 1 or 2.

---

## Cron will stop itself

When this status report is committed and pushed, the next cron fire will
find no `[ ]` items in the queue and exit per the queue rules (`If none
(all [done] or [blocked]): stop. Do not reschedule.`). No action needed
from you to stop it — it just goes idle.

If for some reason you want to kill the cron explicitly: cron job ID is
`59127c65`; say "kill cron 59127c65" and I'll CronDelete it.

Sleep well slept.
