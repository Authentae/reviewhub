# Strategy conversation — 2026-05-20 (5-min read)

Captures the thinking from a long discussion between Earth and the agent on
the night of 2026-05-19 → morning of 2026-05-20. Written as a morning
briefing so you can read it cold and pick up where the conversation left off.

---

## The lesson that kept costing us hours

**Active outbound wave ≠ product scope.** Wave 5 (14 Bangkok hospitality
prospects, fired Tue/Wed) is one hypothesis test. The product is global by
design — 10 language packs, Telegram + WhatsApp on the roadmap alongside
LINE, CSV import for ~20 confirmed non-Thai platforms. Every time I wrote a
strategic plan tonight, I kept collapsing the product's identity to match
Wave 5's segment. After the third or fourth correction, I wrote a meta-rule
memory file (`feedback_active_wave_is_not_product_scope.md`) with a
3-step procedural check to run BEFORE writing any positioning copy:

1. What's the active outbound test? (today: Bangkok hospitality 50-500 reviews)
2. What's the product's scope? (global SMB worldwide with Google reviews + chat)
3. Are step 1 and step 2 the same? If yes, I'm narrowing.

The mistake recurs because Wave 5 is the loudest concrete fact in context.
Concrete crowds out abstract. The fix is procedural, not knowledge-based.

---

## The product, properly framed

- **Who it's for:** any local business worldwide that has a Google Business
  Profile, gets reviews regularly, and whose owner is the one replying.
- **Sweet spot:** 5-50 reviews per month (fewer = ChatGPT is enough; more =
  team workflow we don't have yet).
- **Verticals that fit:** hospitality, dental, medical, café, restaurant,
  spa, fitness, salon, hotel, clinic, co-working, anything review-heavy.
- **Geographies:** anywhere — 10 language packs ship today, more on demand.
- **Why customers need us:** four real-need segments stand out — high
  volume (10+/wk), voice-consistency obsessives, regulated industries (PHI
  guardrails), and forgetful owners (ambient-trigger pings). For everyone
  else, we're a nice-to-have upgrade from ChatGPT-paste.

---

## The $0 phased plan

Each phase has a trigger. Don't skip ahead.

### Phase 0 — now until Sun 2026-05-24

Wave 5 results land by Sunday. Don't disrupt. Use the week to install free
data tools that help regardless of outcome:
- Google Search Console (the data we never had)
- Microsoft Clarity (session replays; we've been shipping conversion
  experiments without watching a single user)
- Google Alerts ("ReviewHub" + competitor mentions)
- Bing Webmaster Tools
- Ahrefs Webmaster Tools (free for own site)
- Soft testimonial ask to 2-3 most engaged Wave 1-4 prospects

Cost: $0. Time: ~3 hours of Earth's attention spread across the week.

### Phase 1 — read result Sunday morning, branch by outcome

**Branch A — Wave 5 converts 1+ paying customer.** One validated combo
(Bangkok × hospitality × outbound × $14). Don't assume it's the only one
or the best. Convert customer → testimonial → case study → submit to 10
global directories (Product Hunt, Indie Hackers, BetaList, AlternativeTo,
There's An AI For That, G2, Capterra, SaaSHub, TrustPilot, Tech in Asia)
WITH the case study. Wave 6 same segment. Parallel: one inbound SEO test
(via the pillar+cluster restructure).

**Branch B — Wave 5 converts 0 paying customers.** Tells us NOTHING about
other segments yet. Send the 6 customer-dev interview drafts (already
written in `docs/outreach/`) to most engaged prospects. Diagnose which
dimension failed: pitch, audit, price, segment, channel, timing. Then
choose Test 2 based on the data, not on assumption. Don't default to
"Bangkok dental next."

### Phase 2 — first $100 MRR (from any source)

Reinvest 50% of monthly revenue into ONE tool/channel at a time. Order
depends on what worked. Free always-on additions: newsletter widget on
Landing + blog, Crisp chat widget, G2/Capterra/TrustPilot listings.

### Phase 3 — $1k MRR

Product Hunt full launch (with 50+ pre-supporters lined up).
First VA / part-time hire ($300-1000/mo).
Paid Google Ads experiment ($300-500/mo trial) — only if Landing converts
above 3% per Clarity data.
First international segment test (we ship 10 languages already).

### Phase 4 — $5k MRR (early PMF signal)

Most of the previously-explored 30-item tool list now applies:
AppSumo lifetime deal, customer-success platform, SOC 2 prep, paid
newsletter sponsorships, conference presence, etc.

---

## The 5-dimensional segment grid

Wave 5 is testing one cell. The product can serve many.

| Axis | Current test | Other cells worth testing |
|---|---|---|
| **Geography** | Bangkok | SEA / USA / UK / EU (GDPR as feature) / Japan / Korea |
| **Vertical** | Hospitality | Dental / medical / café / spa / fitness / hotel chain / co-working |
| **Volume** | 50-500 reviews | 5-50/wk (workflow tax) / 50-200/wk / 200+/wk |
| **Channel** | Outbound email | SEO inbound / X build-in-public / agency partnerships / Product Hunt / paid ads |
| **Pricing** | $14 Starter | Higher-touch concierge / lifetime deal / free-with-quota |

Wave 5 = Bangkok × Hospitality × 50-500 × Outbound × $14. **One cell.**
After Wave 5 lands, the right move is usually to flex ONE axis at a time
and test again.

---

## What we deliberately are NOT doing at this stage

- ❌ Paid Google/Meta ads — no LTV signal yet
- ❌ AppSumo lifetime deals — unit-economics risk before PMF
- ❌ More verticals or geo pages — current ones (`/for-spas`,
  `/for-dentists`) aren't validated yet
- ❌ Building Pro/Business features — waitlist signal first
- ❌ Multi-location feature — no customers asking
- ❌ Native mobile apps — PWA covers it
- ❌ Customer-facing API — wait for explicit demand
- ❌ Languages beyond the 10 we already ship
- ❌ A full Product Hunt launch — needs 50+ pre-supporters lined up; Phase 3
- ❌ Conference presence / travel budget — Phase 3
- ❌ Paid SaaS tools (Ahrefs, ProfitWell paid, Rewardful) — Phase 2 at earliest

The rule: any spend or tool that doesn't help us learn whether the
current hypothesis is right is noise.

---

## What's running tonight

While Earth sleeps, the cron at `7,27,47 * * * *` is grinding through
`docs/overnight-queue-2026-05-20.md` — 14 finite items, all $0, all solo,
all segment-agnostic. Each one fires every 20 minutes, ships one ship,
marks done, ends turn. When the queue empties, the cron writes a final
status report (item 14) and stops.

You'll wake to:
- 10-15 commits on `main`
- One file to read first: `docs/overnight-status-2026-05-20.md` (the
  final status report from item 14)
- One file needing your sign-off: `docs/seo-pillar-cluster-map.md`
  (pillar choice for the future blog restructure)
- Live: `/trust` and `/integrations` pages
- New: `/llm.txt` at the site root for AI crawlers

---

## Open decisions for Earth tomorrow

1. **Pillar choice** in `docs/seo-pillar-cluster-map.md` — do the 5
   pillars look right? Specifically: Pillar 4 (AI replies) is light on
   existing content. Push or merge?

2. **Google Search Console + Microsoft Clarity install** — both free,
   both require your Google account. ~25 min combined. The most important
   data we don't have. Recommend doing this morning, before reading Wave 5
   results, so the data starts collecting before Sunday.

3. **Wave 5 monitoring rhythm** — daily check on `/admin/brief` for
   audit-views; let me know if you want me to wire up a Telegram or
   email push on each view (we have founder-alert infra; would take ~30
   min).

4. **Pre-Wave-5-result branch prep** — anything you want me to set up
   IN ADVANCE for Branch A (case-study template, directory submission
   list with credentials) vs Branch B (interview-question polish,
   diagnostic framework)? Doing the prep ahead = faster reaction Sunday.

5. **The dependency upgrades doc** — `docs/deferred-dependency-upgrades.md`
   from yesterday lists Anthropic SDK 0.79→0.96 and vite 5→8. Both still
   parked. Worth deciding when they get unblocked (Phase 1 or Phase 2?).

---

## TL;DR for if you only read this far

- Product is global; current outbound is Bangkok. Don't confuse them.
- Wave 5 result Sunday. Branch by outcome. Don't preempt.
- Phase 0 = install free data; ~3 hours of your time this week.
- $0 budget until Phase 2 ($100 MRR triggers first reinvestment).
- Tonight: 14-item finite queue grinding through, autonomous.
- Tomorrow morning: read the overnight status doc + sign off on
  pillar choice.
