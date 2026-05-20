# Compounding Infrastructure Research

**Date:** 2026-05-21
**Trigger:** Earth asked "are there any more tools or things like this that could help us in every way or every aspect? research on those without skipping."
**Honesty note:** This document only exists because Earth asked. The agent (Claude) has been shipping marketing surfaces and customer-facing features without ever pausing to ask "what foundation is missing?" — that's a real collaboration failure logged in CLAUDE.md's "look up from the queue" rule. This research pass operationalises that rule for the first time.

---

## Framing: what counts as compounding?

A piece of work is **compounding** if it pays back on every future event of some kind (every deploy, every commit, every prospect, every blog post, every customer). Marketing surfaces are *not* compounding — each one is a one-shot artifact. Infrastructure is compounding when each future ship gets *easier*, *safer*, or *more measurable* because the infra exists.

Filter for current stage (pre-revenue, solo founder, $0 budget, ~1k LOC churn/week):
- **Compounds**: Yes — repeats on every future event
- **Sub-day to ship**: ≤ 8 hours of work (skip multi-week migrations)
- **Free or near-free**: No paid SaaS (or under $50/mo)
- **Reversible**: Can be ripped out without rewriting product code

---

## Inventory: what's already in the repo

| Category | What exists | Gap |
|---|---|---|
| **Tests** | 1087+ server (node:test), 7+ client suites (vitest) | No E2E, no visual, no a11y, no perf |
| **Pre-commit hooks** | check-banned-phrases, validate-blog-seo, check-blog-sync, check-stale-positioning, validate-outreach | No link-check, no a11y, no schema validate, no perf budget |
| **CI** | server tests, client tests + vite build, docker build-only | No Lighthouse, no visual diff, no broken-link, no deploy gating |
| **Ops scripts** | mission-control, prod-smoke, weekly-deploys, regen-og-images | No synthetic uptime, no funnel diagnostic |
| **Observability** | Sentry (errors), Microsoft Clarity (session replay), `/api/health` | No RUM, no synthetic monitoring, no funnel dashboard, no SLO tracking |
| **SEO** | sitemap.xml, llm.txt, Schema.org JSON-LD, GSC + Bing + Ahrefs verified | No internal-link audit, no hreflang validator, no schema validator in CI, no LLM-citation tracker |
| **Email** | Resend on 2587, paid-welcome, weekly-impact, founder-alert | No SPF/DKIM/DMARC health check, no render-test, no bounce-rate dashboard |
| **Customer ops** | LemonSqueezy webhook, Frill, audit funnel | No funnel analytics, no A/B test infra, no NPS, no cohort analysis |
| **Dev health** | dependency-audit.yml, find-orphans.js, content-stats.js | No bundle-size budget, no test-coverage tracking, no DORA metrics |

---

## Tier 1 — Ship this week (compounding, sub-day, no paid services)

### 1. Visual regression (Puppeteer + pixelmatch) — 1-2 hours
**Why:** Every UI ship currently has zero coverage on what it does to non-edited pages. CSS changes in shared components silently break /pricing, /audit, /for-spas. Today's "visual sweep" depends on Earth eyeballing.
**How:** `scripts/visual-snapshot.mjs <surface>` writes baseline PNGs to `tmp/visual/baseline/`. `scripts/visual-diff.mjs` runs current capture against baseline, fails if pixel-diff exceeds threshold (e.g. 0.5%). Run pre-deploy.
**Compound benefit:** Every future ship gets a 30-sec sanity check that no surface visually broke.

### 2. Lighthouse CI nightly — 2 hours
**Why:** 33 blog posts + 10 marketing surfaces, never measured on Core Web Vitals beyond ad-hoc PageSpeed Insights. SEO ranking factor we're flying blind on.
**How:** `scripts/lighthouse-batch.mjs` runs lighthouse-cli against a URL list, outputs CSV + Markdown summary, alerts if Performance/SEO/A11y/Best-Practices drops below threshold.
**Compound benefit:** Catch perf regressions before Google ranks us lower. Track LCP/CLS/INP over time.

### 3. Broken-link crawler — 1 hour
**Why:** Sitemap has 60+ URLs (33 blog + verticals + tools + marketing). Internal-link rot has happened before (cycle 31 found 3 dead links).
**How:** `scripts/check-broken-links.mjs` reads sitemap.xml, follows every `<a href>` on every page, reports non-200. Wire into pre-commit (incremental — only changed files) and nightly (full crawl).
**Compound benefit:** Dead links never reach Google's crawl budget.

### 4. Accessibility audit via axe-core — 1 hour
**Why:** A11y matters for SEO (Lighthouse weight), for legal (ADA exposure once we have US customers), and because we ship UI fast and break things. Zero current coverage.
**How:** `scripts/a11y-audit.mjs` runs axe-core via Puppeteer across 10 surfaces, outputs violations grouped by severity. Threshold-fail for serious+critical.
**Compound benefit:** Every UI change gets vetted; we don't accumulate a11y debt.

### 5. Schema.org + hreflang + canonical CI validator — 1 hour
**Why:** We ship JSON-LD (SoftwareApplication, Organization, WebSite, FAQPage) and EN/TH hreflang pairs. One typo silently breaks Google's structured-data parsing. Currently only validated manually via Rich Results Test.
**How:** `scripts/validate-seo-metadata.mjs` parses each HTML in `client/public/blog/` + dynamic React pages (via Puppeteer rendering), validates JSON-LD shape, checks hreflang reciprocity, asserts canonical present. Pre-commit hook.
**Compound benefit:** Catch SEO meta drift the same day as the commit that caused it.

### 6. Dynamic OG image per blog post — 3 hours
**Why:** 33 blog posts share **one** generic OG card. Social CTR (X, LinkedIn, FB) suffers — every share looks identical. Competitors with per-post cards get more clicks.
**How:** Template SVG with `{TITLE}` and `{DATE}` placeholders → Puppeteer renders to 1200×630 PNG per blog post → save to `client/public/og/<slug>.png` → reference in each post's `<meta property="og:image">`. Regenerate when title changes.
**Compound benefit:** Every social share of any post gets a unique card. Compounds across 33 posts × every share.

---

## Tier 2 — Ship when we have customer signal (2-8 hours each)

### 7. Outreach-prep automation
**Trigger:** When Wave 6 outreach starts (i.e. once we know which segment from Wave 5 data worked).
**Why:** Per-prospect prep currently ~10 min (Maps search, screenshot, audit-preview URL generation, email draft). Puppeteer cuts to ~30 sec.
**How:** `scripts/outreach-prep.mjs <maps-url>` → scrape biz name, address, review count, latest reviews → generate audit-preview token → produce ready-to-send Gmail draft.
**Caveat:** Maps has bot-detection; needs user-agent rotation + pacing. Don't ship until segment validated.

### 8. Funnel diagnostic page in /admin
**Why:** Today we have no idea how many `/audit` views → `/register` starts → completions → `/pricing` views → checkouts. Conversion-rate optimization is blind without it.
**How:** Server-side: SQL query joining audit_views → users created → page views (from Clarity export) → checkouts. Render as a Sankey or 5-column funnel in `/admin/funnel`. Filter by date range + traffic source.
**Compound benefit:** Every CRO experiment becomes measurable.

### 9. LLM citation tracker
**Why:** We've manually checked Perplexity once (we're invisible). Need to track over time — when do Claude/Gemini/Perplexity/ChatGPT start citing us, on which queries?
**How:** Weekly Puppeteer hits the public Perplexity UI with 10 target queries ("best review reply tool for small business", "AI Google review responder", etc.) — extracts citation domains. Log to CSV. Alert when reviewhub.review appears.
**Caveat:** Perplexity may rate-limit / require login. ChatGPT free tier doesn't surface citations. Maybe start with Perplexity-only.

### 10. Synthetic uptime monitoring
**Why:** `/api/health` only tests the server is up. Doesn't test: can a user actually log in? Can the audit flow complete? If checkout breaks at 3am, we'd find out when a customer emails (vs. now, when there's no customer).
**How:** Puppeteer script: load /, click "Free audit", fill mock URL, click submit, verify preview renders. Run from a GitHub Actions cron every 15 min. Alert via Telegram on failure.
**Compound benefit:** Detect product-breaking deploys within 15 min instead of when a user reports it.

### 11. Bundle-size budget enforcement
**Why:** Vite emits stats but nothing enforces a ceiling. We've shipped to 380 KB main bundle once already (heavy in Bangkok mobile, where Wave 5 prospects open emails). One more careless `import` could blow it.
**How:** Add `npm run build` post-step: parse `dist/assets/index-*.js` size, fail if > target. Track over time.
**Compound benefit:** Performance regression prevented at commit time, not Lighthouse cron time.

### 12. A/B test harness (homegrown, not GrowthBook)
**Why:** Pricing copy variants, CTA wording, hero variants — all currently changed-and-prayed. No measurement.
**How:** localStorage-based experiment assignment (no server state), record exposure + conversion in `analytics` table, dashboard in /admin. Bare-bones — 50 lines of React. Postpone GrowthBook self-host until we have ≥3 active tests.
**Risk:** Premature. Need ≥100 daily visitors to get power; we're probably at <50.

---

## Tier 3 — Post-revenue (skip for now)

| Item | Why deferred |
|---|---|
| Customer-interview transcription pipeline | Need customers first |
| In-app NPS survey | Same |
| Drip campaigns based on user activity | Free tier has near-zero retention loop; need data first |
| Multi-region Railway | Single Bangkok region is fine for <1k MAU |
| Self-hosted analytics (Plausible/Umami) | Clarity covers session replay; GA4 not needed yet |
| TypeScript migration | 1087 server tests + 7 client suites — weeks of work for marginal benefit at this stage |
| GraphQL layer | REST is fine |
| API rate limiting beyond what Express has | We're not under attack |
| Redis cache layer | SQLite + Node memory handles current load fine |
| WebSocket subscriptions | LINE/Telegram polling is enough |

---

## Tier 4 — Already-installed plugins/skills we're underusing

Surveyed the available skills/MCP servers. Free leverage we haven't tapped:

### `searchfit-seo:*` skills
- `seo-audit` — full site audit, deeper than ad-hoc PSI
- `keyword-clustering` — group 50+ candidate keywords into pages
- `internal-linking` — find under-linked pages
- `schema-markup` — generate missing JSON-LD per page
- `ai-visibility` — LLM citation diagnostics
- `broken-links` — yes, this exists; consider before rolling our own
- `content-translation` — beyond EN/TH pairs

**Action:** Run `searchfit-seo:seo-audit` first; may obviate need for our DIY Tier-1 #5.

### `brightdata-plugin:*`
- `scrape` — actually built for Maps + similar bot-defended sites
- `seo-audit`, `competitive-intel`

**Action:** When we get to outreach automation (Tier 2 #7), use this instead of raw Puppeteer for Maps scraping.

### `nimble:*` skills
- `local-places` — Google Maps + local biz data via API
- `competitor-intel` — automated competitor research
- `seo-intel`

**Action:** Replace Wave-N prospect-research manual steps.

### `postiz:postiz`
- Social-media scheduling (X, LinkedIn, FB, Threads)

**Action:** When build-in-public posts get scheduled, use this instead of manual.

### `searchfit-seo:content-strategy`, `marketing:content-creation`
- Structured blog-post planning + drafting

**Action:** Use for Pillar 5+ planning instead of ad-hoc.

### `engineering:code-review`, `engineering:testing-strategy`
- Pre-merge automated review

**Action:** Run on major feature PRs going forward.

### `data:build-dashboard`, `data:create-viz`
- Quick analytics dashboards from SQLite

**Action:** Use for funnel diagnostic (Tier 2 #8) instead of building React charts from scratch.

### `bio-research:*` / `lseg:*` / `daloopa:*` / `bigdata-com:*`
- All domain-specific (biotech / finance). Not relevant.

---

## Tier 5 — Free external tools we should be using

| Tool | Status | Purpose |
|---|---|---|
| **Google Search Console** | ✅ Verified | SERP impressions, queries, CTR — but never analysed beyond ad-hoc. Schedule weekly review. |
| **Bing Webmaster Tools** | ✅ Verified | Same for Bing (~3% search share but free signal) |
| **Ahrefs Webmaster Tools** | ✅ Verified | Backlinks, broken pages, organic keywords — free for verified site |
| **Google Alerts** | ✅ Active (7 alerts) | Brand mentions; rarely checked — pipe to inbox label |
| **Cloudflare Analytics** | ⚠️ Unused | Free, server-side, no privacy concerns. We have CF in front of us — turn it on. |
| **Mail-tester** | ⚠️ One-off | Email deliverability score. Should rerun monthly. |
| **GTmetrix / WebPageTest** | ❌ Not used | More detail than PSI. Lighthouse CI covers this if we ship Tier 1 #2. |
| **Schema.org Validator (validator.schema.org)** | ⚠️ Ad-hoc | CI hook would catch every regression (Tier 1 #5). |
| **Google Rich Results Test** | ⚠️ Ad-hoc | Same — automated check beats manual. |
| **Hreflang Tags Testing Tool** | ❌ Not used | EN/TH pairs deserve automated validation. |
| **PageSpeed Insights API** | ❌ Not scripted | Same data as Lighthouse CI but Google's hardware. Worth a separate runner for "what Google sees." |
| **Wave (a11y)** | ❌ Not used | axe-core (Tier 1 #4) covers most. |
| **Postman/Insomnia for API regression** | ❌ Not used | Server tests cover. Skip. |
| **GitHub Dependabot** | ⚠️ Probably partial | Check if enabled; if not, on. |
| **GitHub CodeQL** | ❌ Not used | Free for public repos; we're private. Skip. |
| **Sentry** | ✅ Active | Add RUM + transaction monitoring beyond just errors. |

---

## Tier 6 — One-shot diagnostic runs (do once, learn, decide)

These aren't infra — they're audits. Should run once each, log findings to wiki.

1. **Full Lighthouse pass on all 60 sitemap URLs** — establish baseline before Tier 1 #2 ships
2. **axe-core pass on top 10 surfaces** — same, before Tier 1 #4
3. **Bundle-size analysis** — `npx vite-bundle-visualizer` — find heavy imports
4. **Test coverage measurement** — `c8 npm test` server, `vitest --coverage` client — surface gaps
5. **Find unused npm dependencies** — `npx depcheck` — shed weight
6. **DNS health check** — SPF/DKIM/DMARC for reviewhub.review (impacts Resend deliverability)
7. **External-link audit** — every outbound link in blog posts, are any 404 / dead now?
8. **Robots.txt + meta robots audit** — accidental `noindex` on a key page would be catastrophic
9. **Internal-link analysis** — pages with 0 internal links (orphan pages) hurt SEO
10. **Image weight audit** — find PNGs >200 KB, candidates for compression

---

## Recommended ship order (next 7 days)

**Day 1 (today):**
- Ship Tier 1 #1 Visual regression
- Ship Tier 1 #3 Broken-link crawler (smallest, fastest)
- Ship Tier 1 #4 Accessibility audit
- Run Tier 6 #1-3 to establish baselines

**Day 2:**
- Ship Tier 1 #2 Lighthouse CI (with baselines from Day 1)
- Ship Tier 1 #5 Schema/hreflang validator
- Run Tier 6 #4-7

**Day 3:**
- Ship Tier 1 #6 Dynamic OG per blog post
- Run remaining Tier 6 audits
- Survey what Tier 5 free external tools haven't been activated

**Day 4-7:**
- Re-prioritise based on findings. Surface Tier 2 candidates to Earth.

---

## What this is NOT

- Not a queue (operating-queue.md is). This is the *menu* of compounding leverage; the queue is what gets done.
- Not exhaustive — only categories with apparent leverage at current stage. Skipped multi-week migrations.
- Not a commitment — Earth decides what ships. Items marked Tier 1 are recommendations, not done deals.

---

## Maintenance

Update this doc when:
- A Tier 1 item ships → mark `[shipped YYYY-MM-DD, commit <sha>]`
- A new compounding-infra idea emerges → add under appropriate tier
- Customer signal changes the stage → re-tier Tier 2 → Tier 1
- A tool stops being free/relevant → strike through

---
