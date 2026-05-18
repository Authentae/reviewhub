# Page-flow + customer-flow audit — 2026-05-19

**Scope:** 50 routes across acquisition, auth, app, transparency, legal,
and operator surfaces. Pre-revenue context (0 customers, 1.5k visitors/30d).

**Format:** customer journeys → critical pages with the requested
field set → structural critique → keep/delete/merge/split decisions.

---

## PART 1 — Customer journeys mapped

### Journey A: Cold prospect via outreach (the primary path right now)

```
[Wave 5 email] → /audit-preview/:token → [3 outcomes]
                                       ├→ Stripe Checkout → /register?from=stripe → /dashboard
                                       ├→ LINE/email button → conversation w/ founder (async)
                                       └→ bounce
```

**What's working:** the audit page is the only surface optimized for
this journey (just got conversion ships A+B+C today). Above-fold CTA,
founder card, two-review fold, expander.

**What's NOT working:** 0/7 conversion over 36 audits. The page-level
conversion experiment just shipped; data won't tell us anything for
~5-7 days.

### Journey B: Organic visitor via SEO (the secondary path)

```
[Google search] → / (Landing)            ──┐
                  /for-{vertical}        ──┼→ /pricing → Stripe → /register → /dashboard
                  /blog/{post}           ──┤
                  /tools/{tool}          ──┘
```

**What's working:** 1.5k monthly visitors arriving organically. Landing
has CardStack with concrete review-draft samples. Blog has 25+ posts.

**What's NOT working:** funnel is opaque (Plausible events just shipped
today). The bridge from /tools/* (free utility) back to product is weak
or absent. The bridge from /for-{vertical} → conversion isn't measured.

### Journey C: Free-tool user (the brand-awareness path)

```
[Google search for "review reply generator"] → /tools/review-reply-generator
                                               → uses tool, gets value
                                               → ???
```

**The "???" is critical.** Tools serve people once, then they leave.
There's no clear "OK, you got value — here's how this becomes
ongoing" handoff. If 1.5k visitors include several hundred tool
users, that's possibly 30%+ of traffic with no obvious next step.

### Journey D: Authed user (the unrealised customer path)

```
/register → /dashboard → /settings (connect Google + LINE/Telegram) → daily loop:
                                                                    notification → tap-copy → paste in Google
```

**Untested** because nobody has done it. The /settings → first-success
flow has never been validated by a real customer. The strategic audit
called this "no automated activation flow once someone says yes."

### Journey E: Operator (founder)

```
/login → /outbound-audits (create audit URL for prospect)
       → /admin/brief (overview)
       → /owner (legacy operator surface, unclear purpose now)
```

**Working** — Earth uses /outbound-audits daily. /admin/brief shows
useful metrics. /owner is unclear (more on this below).

---

## PART 2 — Page-by-page critique

Only covering pages that materially affect conversion, trust, or
operator workflow. Skipping legal/auth/utility pages (they exist for
compliance + don't move the needle).

### / (Landing)

- **Who it's for:** Cold organic SEO visitors + audit-page bouncers
  who want to see the broader product
- **What it's for:** Convert visitor → /pricing click or /register click
- **What it should accomplish:** Convince a 4-7 second skim that the
  product is real, specific, in their language, and worth $14/mo
- **What should happen next:** Click CTA → /pricing OR /register
- **What should NOT be on it:** Pro/Business tier details (those live
  on /pricing); deep technical claims; aspirational metrics that
  aren't proven
- **What's weak:** No founder face on landing. CardStack is great but
  it's HERO-side decoration — many users miss it. "From your phone"
  abstract claim was kept; the concrete samples below the fold may
  not be seen at all. No proof element ("X businesses use this") —
  honestly because there ARE no businesses, but the absence is felt.

### /pricing

- **Who it's for:** Visitors evaluating cost; visitors who landed
  here from CTA clicks
- **What it's for:** Show price ladder + remove "is this worth it"
  objection
- **What it should accomplish:** Click on Starter Stripe link OR
  waitlist signup for Pro/Business
- **What should happen next:** Stripe Payment Link → /register?from=stripe
- **What should NOT be on it:** FAQs duplicated from Support; long
  marketing copy (it's a transactional page)
- **What's weak:** The "$14/mo vs alternatives" comparison row now has
  ChatGPT + clipboard included (shipped today). Pro/Business waitlist
  shipped today. Still missing: a "what 100 businesses paid us for
  matters more than what's listed" social proof line (can't ship until
  there's even 1).

### /audit-preview/:token (THE most important page)

- **Who it's for:** Cold prospect who clicked a link in a founder's
  outreach email
- **What it's for:** Convert intent (saw drafts → like them) into
  signup (click CTA)
- **What it should accomplish:** Stripe checkout click within 90 sec
  of arrival, OR LINE/email engagement, OR an "open audit 14x and
  walk away" pattern that tells us pitch is wrong
- **What should happen next:** Stripe checkout OR async conversation
  with founder
- **What should NOT be on it:** Generic feature lists (the value is
  the personalised drafts themselves); 5-card review wall (just
  collapsed to 2 today); aspirational tier mentions
- **What's weak (the biggest single weakness on the project):**
  zero/seven conversion historical. Just shipped 3 fixes; need data.
  Page still doesn't address the #1 unspoken objection: "is this AI
  going to embarrass me when I paste a draft in Google?" — there's
  no "edit the draft / make it sharper" affordance on the page.

### /guide

- **Who it's for:** Logged-in new customer trying to complete setup;
  also organic visitors curious how it works
- **What it's for:** Walk through the connect → notify → copy → paste
  loop with screenshots
- **What it should accomplish:** Reduce first-week churn by making
  setup completion obvious
- **What should happen next:** Customer goes back to /settings to
  finish connecting OR uses the product
- **What should NOT be on it:** Marketing copy (this is a how-to);
  fictional examples (uses real screenshots or honest mockups)
- **What's weak:** Was wrong until 2 days ago — said "Connect LINE" but
  Settings didn't have a LINE section. Fixed in 2026-05-17 commit. Still
  has a gap: doesn't acknowledge that auto-post doesn't exist yet, so
  customers think they'll just click "post" and be done.

### /for-{vertical} × 8 (restaurants, dentists, hotels, spas, cafes, bars, fitness, pharmacies)

- **Who it's for:** Vertical-specific SEO visitors searching for
  "google review reply for [vertical]"
- **What it's for:** Capture long-tail SEO traffic + speak in
  vertical-specific language to feel "for me"
- **What it should accomplish:** Click CTA → /pricing
- **What should NOT be on it:** Fake testimonials (already stripped),
  features the product doesn't actually deliver for that vertical
- **What's weak:** 8 pages exist before there's 1 customer in ANY
  vertical. Each page is decent in isolation but the existence of
  all 8 dilutes focus. Per the strategic audit's "narrow to 1 vertical
  until proven" recommendation — currently violated.

### /tools/{tool} × 4 (review-reply-generator, reply-roaster, review-impact, one-star-playbook)

- **Who it's for:** SEO traffic searching for tactical review-reply help
- **What it's for:** Free utility that gives value, builds trust,
  catches contact info or pulls into product
- **What it should accomplish:** Convert tool-user → /register
  (any tier) OR newsletter signup
- **What should happen next:** Currently nothing. Tool user finishes,
  leaves. No follow-up.
- **What's weak:** The "build trust via free tools" play only works if
  there's a bridge to the product. Currently the bridge is implicit
  ("look at the brand," click around). Worth adding: at end of tool
  use, "want this happening automatically when new reviews land?" CTA
  with a one-tap waitlist or signup.

### /vs/{competitor} × 5 (birdeye, podium, reviewtrackers, chatgpt, agency)

- **Who it's for:** Comparison-shoppers Googling "X alternative" or "X vs Y"
- **What it's for:** Capture decision-stage search traffic
- **What it should accomplish:** Click CTA → /pricing
- **What's weak:** Same as verticals — 5 comparison pages exist before
  1 customer has organically said "I was comparing X to you." Pure SEO
  bet without conversion data. The /vs/chatgpt page is the most
  defensible (ChatGPT IS the silent competitor); the rest are SEO
  inventory plays.

### /blog (BlogIndex + 25+ posts)

- **Who it's for:** SEO long-tail traffic on review-reply topics
- **What it's for:** Build domain authority + capture top-of-funnel
- **What it should accomplish:** Reader stays on site, clicks
  internal link, eventually lands on /pricing or /audit-preview
- **What's weak:** Bridge from "I read a blog post" → "I'm going to
  sign up" is weak. Each post ends with a soft CTA (look around).
  No newsletter signup form. No in-post "try this with your own
  reviews →" tool-bridge link.

### /dashboard (authed)

- **Who it's for:** Paying customer (or active free user)
- **What it's for:** Show new reviews + drafts; daily-use product surface
- **What it should accomplish:** Daily habit — open dashboard, see
  what's new, tap-copy a reply
- **What's weak:** Untested by a real paying customer. The strategic
  audit flagged this — every assumption about the dashboard is
  guesswork until 1 person uses it for 30 days.

### /settings (authed)

- **Who it's for:** New customer in setup mode + existing customers
  changing preferences
- **What it's for:** Connect Google location, connect LINE/Telegram,
  set notification prefs, manage subscription
- **What it should accomplish:** Get a new customer from registered
  → fully wired up to receive their first notification
- **What's weak:** Big page with lots of sections. New customer
  doesn't know which to do first. No checklist / first-time progress
  indicator. Per strategic audit: this is the post-Stripe void —
  customer pays, lands here, has no idea what step 1 is.

### /outbound-audits (operator only)

- **Who it's for:** Earth
- **What it's for:** Create per-prospect audit URLs for cold outreach
- **What it should accomplish:** 3-min audit creation per prospect
- **What's weak:** Manual paste-reviews flow. Tonight we automated
  this via Chrome MCP API calls but the in-app flow still requires
  paste. Fine because only operator uses it.

### /admin/brief (operator only)

- **Who it's for:** Earth
- **What it's for:** Single-screen "what's happening" with the
  business — visitor counts, audit views, signups, errors
- **What it should accomplish:** 10-second daily check-in
- **What's weak:** Not yet hooked to the new Plausible funnel events.
  Doesn't surface waitlist signups (shipped today).

### /owner (operator only — UNCLEAR PURPOSE)

- **Who it's for:** ???
- **What it's for:** ???
- **What it should accomplish:** ???
- **What's weak:** Likely vestigial. Earth — do you know what this
  page is for? If not, kill it.

### /api-docs

- **Who it's for:** Developers integrating with ReviewHub API
- **What it's for:** Document the API
- **What it should accomplish:** Developer reads docs, decides to
  integrate
- **What's weak:** **The API doesn't exist yet.** This page documents
  a future product. Credibility risk: prospect lands on /api-docs from
  an SEO search, realises the API isn't actually shippable, walks
  away assuming the rest of the site overstates similarly.

### /roadmap, /changelog, /status

- **Who it's for:** Existing customers + curious prospects
- **What it's for:** Trust + transparency
- **What it should accomplish:** Reduce "is this product alive?"
  anxiety
- **What's weak:** /roadmap signals incompleteness more than it
  reassures (the visible "next: multi-location" item to a 1-user
  product reads "we're not even fully built yet"). /changelog is
  good. /status is overkill for a pre-revenue solo SaaS.

### Auth pages (login, register, forgot, reset, mfa, magic, google-done, email-change, verify-email, unsubscribed, confirm-erasure)

- **Working overall.** Standard auth surfaces. /register has the
  post-Stripe banner shipped earlier; new paid-checkout welcome
  email fires from here.
- **One weakness:** /register doesn't differentiate "you came from
  audit" vs "you came from organic" vs "you came from Stripe" in the
  UI. The data is captured (signupSource), but the first-screen
  experience is identical for all three paths.

### /about, /support, /refund-policy, /terms, /privacy, /acceptable-use, /legal/th-summary

- **Compliance surfaces.** Working. Don't touch.

### /line, /shared/:token, /year-review/:year

- **/line** — single-purpose landing for LINE prospects. Reasonable.
- **/shared/:token** — shared dashboard view. Unclear who uses it.
- **/year-review/:year** — annual summary. Premature; no customers
  have completed a year.

---

## PART 3 — Structural problems

### Trust gaps

1. **No real customer proof anywhere.** The closest is the audit-page
   founder card (shipped today). Honest "first 30 prospects" framing
   helps; doesn't replace a real testimonial.
2. **/api-docs documents a non-existent API.** Biggest credibility
   risk on the site.
3. **8 vertical pages + 5 comparison pages signal "we're a real
   company"** when actually it's one solo founder with 0 customers.
   The marketing surface is ~3× what the product warrants.
4. **/roadmap shows in-progress, signals incompleteness.** Mixed signal.
5. **/status is overkill** for a pre-revenue solo product. Implies
   enterprise-grade SLA when there's no SLA.

### Friction points

1. **/audit-preview → Stripe → /register → /dashboard**: 4 hops for
   a cold prospect to become a customer. Each hop loses people.
2. **/register has no contextual variation by source.** Stripe-paid
   user sees the same form as organic free-signup.
3. **/settings is unstructured for new customers.** First-time
   experience has no "do this first" guidance.
4. **/dashboard has no "your first reply" celebration moment.** If
   a customer ever gets there, the first time they tap-copy should
   feel like a win — currently it's silent.
5. **No way to evaluate the product without buying.** Free tier exists
   but requires registration. The audit-preview is the only no-signup
   sample, and it only exists for prospects Earth manually invites.

### Missing pages

1. **A "what makes us different in one screen" page** — neither
   landing nor pricing nor about does this concisely. Closest is /vs/chatgpt.
2. **A live demo page** — "see ReviewHub on a fake business right
   now, no signup." The audit-preview is per-prospect; there's no
   public demo URL.
3. **A first-day welcome page** — what should the very first thing
   the customer sees on /dashboard be? Currently empty state if no
   reviews synced yet.
4. **A migration/import page for prospects already using a competitor.**
   "Coming from Birdeye? Here's the 3-step move." Doesn't exist.

### Unnecessary pages

1. **/api-docs** — documents non-existent API
2. **/year-review/:year** — premature
3. **/status** — premature
4. **/roadmap** — mixed signal
5. **/owner** — unclear purpose
6. **5/8 vertical pages** — pick 1 vertical until validated
7. **3/5 comparison pages** — keep ChatGPT + maybe Birdeye; rest are SEO inventory
8. **/shared/:token** — unclear use case

### Disconnected pages

1. **/tools/{tool} → product.** Free tools are end-of-journey, not
   bridges. Need a "want this automatic?" CTA in every tool result.
2. **/blog/{post} → product.** Same. Blog ends with soft CTA "learn
   more" rather than "want this happening for your business?"
3. **/for-{vertical} → /pricing → ???** — vertical pages drop to
   pricing without vertical-specific framing on /pricing itself.
4. **/audit-preview → /pricing.** Currently you go straight to Stripe.
   Missing alternative: "want to compare what you'd get?" link to
   /pricing for prospects who aren't ready to pay yet.

---

## PART 4 — Refinement decisions

### KEEP (high-value, working)

- /
- /pricing
- /audit-preview/:token
- /guide
- /dashboard
- /settings
- /outbound-audits (operator)
- /admin/brief (operator)
- /login + auth surfaces
- /support
- /terms, /privacy, /acceptable-use, /refund-policy, /legal/th-summary
- /vs/chatgpt
- /blog (the most defensible SEO surface)
- /tools (the most defensible inbound surface)
- /changelog (real, useful)
- /about (founder transparency)

### DELETE (no current ROI)

- **/api-docs** — non-existent product, credibility risk
- **/year-review/:year** — premature
- **/status** — premature
- **/owner** — vestigial
- **/shared/:token** — unclear use case
- **/vs/reviewtrackers, /vs/agency, /vs/podium** — keep just chatgpt + birdeye
- **6 of 8 vertical pages** — pick the vertical Wave 5 validates
  (or hospitality if no signal); keep 1; delete the rest

### MERGE

- **/roadmap + /changelog → just /changelog.** Past tense ships; remove
  forward-looking roadmap that signals incompleteness.
- **/line → into Landing.** It's a single-purpose duplication.
- **/about + /support → one "about us" page** with contact info.

### SPLIT

- **/settings should split into onboarding wizard vs ongoing settings.**
  First-time experience should be a step-by-step "connect Google →
  connect LINE → done" wizard. Subsequent visits should be the flat
  settings page. Currently it's one flat page with no first-time UX.

### BUILD FIRST (the actual roadmap, ranked)

1. **/settings onboarding wizard mode** (~3-4 hr) — first-customer
   activation gap. The single biggest "we have a paying customer
   and they immediately churn because they don't know what to do"
   risk.
2. **Tool → product bridge** (~1 hr per tool) — every /tools/{tool}
   result screen gets a "want this happening automatically?" CTA.
   Converts the free-tool funnel into actual leads.
3. **Public demo audit URL** (~1 hr) — one persistent /audit-preview-demo
   route showing a fake-business audit with named drafts. Prospects
   who land on /pricing without an audit URL can click "see what
   you'd get" → demo audit.
4. **Dashboard empty state + "your first reply" celebration**
   (~1-2 hr) — if a customer ever signs up + has no reviews yet,
   show an honest empty state ("we'll start polling within an hour;
   here's a sample of what to expect"). When their first real reply
   gets sent, show a tiny win celebration.
5. **/register variation by source** (~1 hr) — Stripe-paid users see
   "your payment landed, finish setup" copy; audit-traffic users see
   "save these drafts to your dashboard"; organic gets the existing
   free-tier framing.

### DON'T BUILD YET

- More verticals (already 8; pick 1, kill 7)
- More comparison pages (already 5; kill 3)
- Multi-location (no customer has asked)
- API (delete /api-docs first; build when 5+ customers ask)
- Mobile app (web works fine on phones; this is feature bloat)
- Team/multi-user (no customer at any tier needs this)
- Year-review feature (no customer has 1 year yet)
- /status uptime page (vanity)
- Pro/Business features (waitlist instrument now in place; build
  based on demand signal)
- More languages beyond Thai/English (ICP isn't validated yet)

---

## Closing read

**The single most important structural fix:** the surface area is ~3×
what a pre-revenue solo SaaS should have. Deleting half the pages
would make the product feel more focused, not less capable.

**The single most important addition:** the onboarding wizard mode of
/settings. When the first paying customer arrives (1 of 14 Wave 5
prospects buys? someone signs up organically tomorrow?), the
post-Stripe → /register → /dashboard handoff is the moment they
decide to stay or churn. Currently that handoff drops them into a
flat settings page with no first-step guidance. Fix this BEFORE
the first customer arrives.

**The honest summary:** product execution is ahead of customer execution.
Marketing surface is ahead of customer reality. The audit page is
the closest thing to a working sales funnel. Everything downstream
of "they click sign up" is untested. The fix isn't more pages — it's
deleting the unnecessary ones, fixing the onboarding handoff, and
adding tool → product bridges.

— agent, 2026-05-19
