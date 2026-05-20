# Free tools + strategy survey

Comprehensive ranked list of $0 tools and channels available to ReviewHub
at our current stage (pre-revenue, solo founder, Bangkok-based with global
product). Ranked by ROI for **this stage** — what helps highest in the
next 30-60 days, not what's "best in class" generically.

Built: 2026-05-20 morning. Companion to `docs/free-tools-setup.md`
(install walkthrough for Tier 1).

---

## Tier 1 — install this week, $0, takes minutes (highest signal)

The data we don't currently have. All free, all use your existing
Google / Microsoft accounts.

| Tool | What it does | Time to set up |
|---|---|---|
| **Google Search Console** ✅ | Actual queries you rank for + impressions/clicks | already done |
| **Microsoft Clarity** | Free unlimited session replays + heatmaps | 5 min |
| **Bing Webmaster Tools** | Bing equivalent of GSC (cite: ChatGPT uses Bing's index) | 10 min |
| **Ahrefs Webmaster Tools** | Free backlink + site audit for verified own-site | 10 min |
| **Google Alerts** | Email pings for brand + competitor + topic mentions | 3 min |
| **Plausible** ✅ | Privacy-friendly page-view analytics | already done |
| **Mail-tester.com** | Per-send deliverability score (no signup) | 1 min per send |

Walkthrough: `docs/free-tools-setup.md`.

---

## Tier 2 — keyword + topic research ($0, use on demand)

For validating pillar keywords, finding cluster post topics, discovering
adjacent search intents we don't already cover.

| Tool | Free tier limit | Best for |
|---|---|---|
| **Google Keyword Planner** | Unlimited (free Google Ads account, no spend required) | Real monthly volume estimates from Google itself |
| **Google Trends** | Unlimited | Seasonal patterns, rising terms, geographic interest |
| **Google autocomplete** | Unlimited | Real query suggestions as users type |
| **People Also Ask** (in any SERP) | Unlimited | Adjacent question discovery |
| **Answer The Public** | 1 free search/day | Question-format keyword cloud visualization |
| **Ubersuggest** | 3 free searches/day | Volume + difficulty + content ideas |
| **Keywords Everywhere** | Free Chrome extension | Inline volume + CPC on every SERP |
| **AlsoAsked** | Limited free | PAA tree visualization (deeper than Google PAA) |
| **KeywordTool.io** | Free (limited data, no volume) | Multi-platform autocomplete (YouTube, Amazon, Bing) |
| **Exploding Topics** | Free tier | Rising trends 6-12 months before peak |
| **Glimpse** | Free for Google Trends extension | Adds volume numbers to Google Trends data |
| **Soovle** | Free | Aggregates autocomplete from Google/Bing/YouTube/Amazon/Wikipedia |

---

## Tier 3 — LLM SEO / AEO / GEO (the new game — most competitors ignoring it)

LLM Search = ChatGPT/Claude/Perplexity/Gemini being asked questions and
citing sources. Different optimization vectors than traditional SEO. Most
competitors aren't optimizing for this yet → first-mover advantage window
is ~12-18 months.

| Move | Status | Notes |
|---|---|---|
| **llm.txt at site root** | ✅ shipped 2026-05-20 | llmstxt.org convention; ChatGPT/Claude/Perplexity crawlers prefer sites that have it |
| **Schema.org JSON-LD** (Organization, WebSite, FAQPage, SoftwareApplication) | ✅ shipped 2026-05-20 | Inert until crawled but compounds; FAQ schema directly fuels LLM answers |
| **Direct-answer content format** | Partial | Question heading → 1-paragraph answer → details. Easy for LLMs to extract. Some blog posts already follow this pattern. |
| **Ask ChatGPT/Claude/Perplexity your head terms, log who they cite** | TODO | Free, ~30 min. Tells you which competitors are getting cited so you can target the same gap |
| **Get cited on Wikipedia (any topic page about reviews/SaaS/etc)** | TODO | Hard but high LLM-citation weight |
| **Get cited on Reddit / HackerNews / StackOverflow** | TODO | LLMs heavily weight these sources |
| **Profound / Otterly / AthenaHQ** | Paid (Phase 2+) | LLM-citation tracking platforms |
| **Authority signals** (sameAs links to X / GitHub / LinkedIn) | ✅ shipped 2026-05-20 | Helps LLMs disambiguate the brand entity |

---

## Tier 4 — Startup directories (free submissions, do after first paying customer)

Ranked by traffic + LLM-citation weight. Most are 5-15 min submissions.
Don't do these BEFORE having a real customer testimonial — submission with
no social proof = lukewarm result.

1. **Product Hunt** — full launch needs 50+ pre-supporters lined up; Phase 3
2. **Indie Hackers** — submit + post your journey (build-in-public format)
3. **BetaList** — for pre-launch (we're past this stage)
4. **There's An AI For That (theresanaiforthat.com)** — heavy traffic in 2025-26 for AI-tool searches
5. **AlternativeTo** — list ReviewHub as alternative to Birdeye / Podium / ChatGPT for replies
6. **G2** — free listing; ask first 3-5 customers for G2 reviews
7. **Capterra** — same
8. **GetApp** — Capterra-owned, separate listing helps
9. **SaaSHub** — niche but indexed by Google
10. **TrustPilot** — review collection (mostly defensive)
11. **Tech in Asia** — geographic angle for Bangkok-based companies
12. **StartupBase / Launching Next / Side Projectors** — long tail directories
13. **Land-book** — design-first directory; only submit if our visual is strong
14. **SaaSLand / SaaS Genius / SaaS Directory** — long tail
15. **Awesome lists on GitHub** — `awesome-saas`, `awesome-reviews`, etc. (PR-based)
16. **HackerNews "Show HN"** — one shot, save for a real milestone (first paying customer, big feature ship)
17. **Reddit** — `r/SideProject` welcomes launches; others have rules (read first)

---

## Tier 5 — Backlink discovery + competitive intel ($0)

Used quarterly, not daily. Map competitor backlinks → outreach to same
sites for our content.

| Tool | Free tier | Use |
|---|---|---|
| **Moz Link Explorer** | 10 free queries/month | Top backlinks per domain, domain authority |
| **Ahrefs Backlink Checker** | Limited | Top 100 backlinks per domain |
| **OpenLinkProfiler** | Totally free | Less data but unlimited |
| **BuiltWith** (Chrome ext) | Free | What tech stack competitors run on |
| **Wappalyzer** | Free | Same |
| **SimilarWeb** | Free tier | Competitor traffic estimates, top channels, audience overlap |
| **SpyFu** | 5 free queries/day | Competitor paid + organic keywords |
| **iSpionage** | Limited free | Competitor ad copy |

---

## Tier 6 — Content distribution (free amplification)

Cross-post existing blog content. Set the canonical to the original URL
on reviewhub.review so we don't dilute SEO.

| Platform | Audience fit | Effort |
|---|---|---|
| **Medium** | General SaaS / business readers | Low (republish with canonical) |
| **Dev.to** | Technical posts (Anthropic API, schema, performance) | Low |
| **Hashnode** | Technical, often higher-quality engagement than Dev.to | Low |
| **LinkedIn articles** | Owner-audience reads this | Medium (LinkedIn-specific format helps) |
| **Substack** | Own your newsletter list (export-friendly) | High (separate publication) |
| **Reddit** — `r/smallbusiness`, `r/restaurantowners`, `r/dentistry`, `r/SaaS` | Direct ICP overlap | Medium (read rules, no spam) |
| **HackerNews "Show HN"** | Technical builders, one-shot | High (save for milestone) |
| **IndieHackers posts** | Solo founder community, build-in-public | Medium (transparency posts work best) |
| **X/Twitter build-in-public** | Founder network, occasional viral | Daily-ish |
| **Mastodon** | Smaller but engaged tech audience | Low |

---

## Tier 7 — Forms + chat + email tools (free tiers)

For customer-dev interviews, support, and lightweight outreach.

| Tool | Free tier | Best for |
|---|---|---|
| **Tally.so** | Unlimited free forms | Customer-dev interviews (better UX than Google Forms) |
| **Typeform** | Free tier (10 responses/month/form) | Polished single-form moments |
| **Tawk.to** | Totally free | Live chat widget (no limits) |
| **Crisp.chat** | Free tier (2 seats, basic) | Live chat + simple CRM |
| **Hunter.io** | 25 free email searches/month | Find email addresses from a domain |
| **Apollo.io** | 50 free emails/month | Same + outreach sequences |
| **Snov.io** | Free tier | Similar to Hunter |
| **Buttondown** | Free under 100 subscribers | Lightweight newsletter sending |
| **MailerLite** | Free under 1000 subscribers | Heavier newsletter platform |

---

## Tier 8 — Site audit tools (run before any redesign)

Catch issues that hurt rankings + conversions before they compound.

| Tool | Use |
|---|---|
| **Google PageSpeed Insights** | Core Web Vitals (Google ranking factor) |
| **Lighthouse** (Chrome DevTools) | Same, deeper detail |
| **GTmetrix** | Load-time waterfall, third-party impact |
| **Schema Markup Validator** (validator.schema.org) | Verify JSON-LD we shipped 2026-05-20 |
| **Google Rich Results Test** | Will Google show rich snippets? |
| **Mobile-Friendly Test** | Google's mobile UX check |
| **Screaming Frog** | Free up to 500 URLs — full site crawl, broken links, meta issues |
| **Sitebulb** | Paid but free trial — visual site audit |
| **Bing URL Inspection** | Cousin of GSC's URL Inspection |

---

## What this list answers vs. doesn't

**Does answer:** what free tools exist + where each fits ReviewHub's stage.

**Doesn't answer:** which of these we should activate FIRST. Recommendation:

1. **This week** — Tier 1 (Search Console already done; Clarity + Bing + Ahrefs + Google Alerts).
2. **Validate pillars** — run Tier 2 against the 5 head terms in
   `docs/seo-pillar-cluster-map.md` before approving the restructure.
3. **First customer ships** — Tier 4 (directories) with their testimonial.
4. **Ongoing** — Tier 3 (LLM SEO moves), Tier 6 (distribution).
5. **Phase 2+** — Tier 5 / 7 / 8 used quarterly or on demand.

---

## Companion docs

- `docs/free-tools-setup.md` — step-by-step install walkthrough for Tier 1
- `docs/seo-pillar-cluster-map.md` — 5 proposed SEO pillars (needs validation
  from Tier 1 + Tier 2 data before approval)
- `docs/strategy-conversation-2026-05-20.md` — the broader $0 phased plan
  this fits into
