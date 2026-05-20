# SEO + LLM diagnostic findings — 2026-05-20

**Context:** Tier-1 tools installed mid-morning (Bing/Ahrefs/Clarity/Alerts).
This doc captures what those tools (and the free ones from Tier 2/3/8) say
about ReviewHub's current SEO + AI-search position.

Run end of day 2026-05-20. Refresh in 30-60 days once Search Console / Bing
have collected real query data.

---

## 1. Schema.org / Rich Results — ✅ PASSING

**Source:** Google Rich Results Test (`search.google.com/test/rich-results`).

Status: **3 valid items detected**, all eligible for rich snippets.
- ✅ FAQ — 1 valid item (the FAQ JSON-LD with 6 Q&As)
- ✅ Organization — 1 valid item (sameAs, contactPoints, founding location)
- ✅ Software Apps — 1 valid item (SoftwareApplication entity)

Non-critical issues mentioned but no detail surfaced. Search Console will
populate specifics over time once Google fully indexes the structured data.

**Implication:** every search that triggers a rich result (Q&A snippet,
company knowledge panel, software-app card) is eligible to feature
ReviewHub. We're SET on structured data.

**Don't:** delete the SearchAction commentary — we deliberately skipped
adding a fake `/search` SearchAction. Schema would have failed otherwise.

---

## 2. Bing Webmaster — sitemap submitted

**Source:** `bing.com/webmasters/sitemaps?siteUrl=https://reviewhub.review/`

Submitted: `https://reviewhub.review/sitemap.xml`. Confirmed in the Sitemaps
list (post-reload). Bing crawl will pick up on schedule.

**Why this matters beyond Bing:** OpenAI's ChatGPT web search uses Bing's
index. Faster Bing indexing = faster ChatGPT-search visibility.

---

## 3. Keyword research on the 5 proposed SEO pillars

I ran each pillar's head term through Google SERP + People Also Ask. Format:
- **Head term**
- **Top results pattern** (who currently ranks)
- **PAA / intent signals**
- **Verdict** — is the pillar worth shipping?

### Pillar 1 — "how to reply to Google reviews"

**Top 10 ranking pages:**
- Google Business Profile Help (×2, official docs)
- Reddit thread
- Usersnap blog
- EmbedSocial blog
- YouTube video
- 4 listicle/example posts

**PAA:**
- "How do you reply to a Google review reply?" (meta)
- "How do I reply back to a good review?" (positive)
- "Why can't I reply to a review?" (problem-solving)
- "Can I reply to someone else's Google review?" (edge case)
- "How do you all handle responding to Google reviews?" (community)

**Verdict:** ✅ **SHIP.** Top results are help docs + blogs + listicles —
no SaaS-tool dominance. A great pillar page that combines:
- comprehensive how-to
- 15-20 example replies by review type
- Q&A from the PAA
- our AI-draft tool as an inline CTA

…has a real chance to crack top 10. Highest-volume pillar; broadest intent.

### Pillar 2 — "how to respond to a bad Google review"

**Top 8 ranking pages:**
- "How to Respond to a Bad Google Review (Examples Included)"
- "How to Handle & Respond to Negative Google Reviews"
- Google Business Profile Help (report inappropriate)
- "20 Google review response examples to steal" (×2)
- Powerful Examples post
- Reddit thread (`r/smallbusiness`)

**PAA:**
- "How to deal with negative Google reviews?" (Reddit)
- "How Do You Respond to a Bad Review on Google?"

**Verdict:** ✅ **SHIP.** Same pattern — listicles dominate. Our pillar can
beat them by being more specific (templates for: extortion / 1-star with no
text / fake review / vague complaint / staff-named complaint). Crisis-mode
searches convert way better than browse searches.

### Pillar 3 — "how to get more Google reviews"

**Top 8:**
- Reddit `r/smallbusiness` thread
- Google Business Profile Help
- Red Shark Digital
- Robiz Solutions blog
- "How to Get More 5-Star Google Reviews" blog
- Review Booster (a tool)
- 2 more listicles

**Verdict:** ⚠️ **MEDIUM.** More competitive (a paid tool ranks). Acquisition
pillar but downstream of the reply-mechanics value prop. Defer unless we
have a free acquisition tool (QR code generator, SMS template) to anchor it.

### Pillar 4 — "AI Google review reply tool" ⭐⭐⭐ THE BIG ONE

**Top 10:**
1. AI Review Reply Response Generator — Chrome Web Store
2. Google review reply AI Assistant — Chrome Web Store
3. "AI Google Review Reply Tool" (likely SEO-thin)
4. Reply to reviews with AI — REVIEWS.io
5. "Automated Google Review Responses?"
6. "*FREE* AI Google Review Response Generator"
7. "AI Generated Review Replies for Free"
8. "AI Review Responder & Answer Generator"
9. "AI Google Review Replies"

**Critical finding:** **ReviewHub does NOT appear in the top 10** for this
exact query — our most-direct keyword.

**Verdict:** ⭐ **HIGHEST PRIORITY.** This is our wedge keyword. Competition
is mostly:
- Chrome Web Store extensions (weak landing pages, no rich content)
- "FREE generator" thin pages
- One real competitor (Reviews.io)

With a proper pillar page (deep how-to + comparison + free tool + product
CTA), we can crack top 5 in 6-12 months. Currently INVISIBLE = nothing to
lose.

### Pillar 5 — "responding to reviews in multiple languages"

**Top 8:**
- "Respond to Google Reviews in Any Language (50+)" — likely Birdeye
- Reddit / Play Store discussions
- "How To Manage Google Reviews In Multiple Languages?"
- "Did You Know Multilingual Review Management Can Boost..."
- "How to Reply to Google Reviews Using an AI Agent"
- "Management Responses in English to reviews in other..."

**Verdict:** ✅ **SHIP** — but rebrand as "**AI review replies in 10
languages**" instead of generic "multilingual." Birdeye's title "Any Language
(50+)" is a flex; we can flank with depth on the 10 we actually translate
into (TH, JA, ZH, KO, ES, FR, DE, PT, IT, EN), with example replies in
each. That's something Birdeye's "50+" page can't match in specificity.

---

## 4. LLM citation check — ⚠️ WE ARE INVISIBLE

**Source:** Perplexity (free, no signup).

**Query:** "Best AI tools for responding to Google reviews"

**Perplexity's answer cites:**
1. **Birdeye** — "Strong all-in-one reputation management"
2. **Podium** — "review response workflows"
3. **Reviewflowz** — "monitoring and reply automation"
4. **Yext** — "broader listings and brand presence"
5. **Reviews.io** — "AI-assisted replies tied to review collection"

**ReviewHub: NOT CITED. ZERO presence in AI search for our most-direct intent.**

**What this means:**
- Birdeye and Podium own LLM-citation in our space (matches the SERP
  finding — they have the SEO authority that LLMs lean on for citations).
- Reviewflowz is a competitor name worth investigating (haven't heard
  of them in Earth's strategy discussions).
- The fact that we just shipped llm.txt + Schema.org doesn't auto-make
  us citable. LLMs cite domains they've been TRAINED on or that have
  high authority signals. New / low-authority sites are invisible until
  they build reputation.

**How LLMs become aware of us (paths to citation):**

1. **Get reposted on Reddit / HackerNews / IndieHackers** — LLMs scrape
   these heavily.
2. **Get cited on Wikipedia** — hardest, highest payoff.
3. **Get featured on listicle articles** — when someone writes "best AI
   review reply tools 2026", we want to be on that list. Pitch us to
   listicle bloggers proactively.
4. **Build the pillar pages** — clear factual content with direct-answer
   format. LLMs prefer this structure.
5. **Get on Product Hunt + There's An AI For That + AlternativeTo** —
   directory presence builds the citation signal over months.

---

## 5. Competitor list (refined from this pass)

Confirmed competitors based on SERP + LLM citation:

| Competitor | Strength | LLM citation | Their angle |
|---|---|---|---|
| Birdeye | High | Cited | All-in-one rep mgmt, multi-location |
| Podium | High | Cited | Customer messaging + review workflows |
| Reviews.io | Medium | Cited | Review collection + AI reply |
| Reviewflowz | Medium | Cited | Monitoring + automation (research this) |
| Yext | Medium | Cited | Listings + brand presence |
| REVIEWS.io | (same as Reviews.io) | Cited | |
| Chrome Web Store extensions (×2) | Low | Not cited | Free, no real product |
| Various blogs with "AI generator" landing pages | Low | Not cited | SEO-thin |

We already have `/vs/birdeye` and `/vs/chatgpt`. Worth adding:
- `/vs/podium`
- `/vs/reviews-io`
- `/vs/reviewflowz` (after research)
- `/vs/yext`

These are zero-volume right now but capture branded queries from buyer-stage
searches ("ReviewHub vs Podium" once we start getting any traffic).

---

## 6. What this means for the SEO pillar approval

The 5 pillars in `docs/seo-pillar-cluster-map.md` were intuition-based. After
real data:

**Confirmed worth shipping:**
- Pillar 1 (reply mechanics) — broadest, weak competition
- Pillar 2 (bad reviews) — crisis searches convert
- Pillar 4 (AI reply tool) — **highest leverage, we're currently invisible**
- Pillar 5 (multilingual) — refocus as "AI in 10 languages" specifically

**Deprioritize:**
- Pillar 3 (get more reviews) — competitive, downstream of value prop, defer

**Revised pillar order by ROI:**
1. **Pillar 4** (AI Google review reply tool) — write FIRST, this is our wedge
2. **Pillar 2** (responding to bad reviews) — crisis searches, high intent
3. **Pillar 1** (how to reply) — broadest base, foundational
4. **Pillar 5** (10-language AI replies) — defensible vs Birdeye's "50+"
5. **Pillar 3** (get more reviews) — defer 60-90 days

Earth — when you sign off the pillar restructure, suggest signing off only
1, 2, 4, 5 (skip 3 for now). Total work: ~16 hours instead of ~19.

---

## 7. Companion priorities (from the survey)

Tier 4 directory submissions to schedule for ~Sunday 5/24 (post-Wave-5
result, once we have any signal):

- **There's An AI For That** — heavy traffic, free submission
- **AlternativeTo** — list as alternative to Birdeye / Podium / ChatGPT
- **G2** — free listing (Earth: 5 min)
- **Capterra** — free listing
- **SaaSHub** — niche but indexed
- **AppSumo** — wait until Phase 2
- **Product Hunt** — wait until 50+ pre-supporters lined up (Phase 3)

---

## 8. Open questions for tomorrow

- **PageSpeed Insights** — was still loading when this doc was written.
  Re-run via `pagespeed.web.dev` and surface Core Web Vitals.
- **Reviewflowz** — research this competitor (size, pricing, positioning).
- **Search Console wiring** — reviewhub.review's GSC verification is under
  a different Google account (not theearth1659). Find out which account
  owns it; if lost, re-verify under the brand account.
- **Wayback Machine** — check how reviewhub.review looked when prospects
  opened audit URLs (sanity check against current state).

---

## Companion docs

- `docs/free-tools-survey.md` — full Tier 1-8 tool inventory
- `docs/seo-pillar-cluster-map.md` — original pillar proposal (pre-data)
- `docs/warm-followups-2026-05-20.md` — Wave 5 follow-up email pack
- `docs/audit-page-conversion-review-2026-05-20.md` — why 19 opened, 0 replied
