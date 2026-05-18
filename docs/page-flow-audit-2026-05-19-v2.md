# Page-flow + customer-flow audit v2 — 2026-05-19

**Context:** ~12 hours after the v1 audit (`docs/page-flow-audit-2026-05-19.md`).
Since then 11 pages were deleted, 5 conversion experiments shipped,
onboarding wizard built, Pro/Business waitlist replaced dead buttons.
Route count: **50 → 41**. This v2 is a fresh look at the current
state, not a re-print of v1.

**Format:** customer journeys → critical pages with the requested
field set → structural critique → keep/delete/merge/split decisions.
What's already been shipped since v1 is called out so we don't
re-recommend it.

---

## PART 0 — What changed since v1 (so we don't repeat)

**Deleted (11 pages):**
- `/api-docs` (vaporware) ✅
- `/year-review/:year` (premature) ✅
- `/status` (vanity) ✅
- `/roadmap` (signal-of-incompleteness) ✅
- `/line` (pivot announcement, content rolled into /) ✅
- `/vs/reviewtrackers`, `/vs/agency`, `/vs/podium` (SEO inventory) ✅
- `/for-restaurants`, `/for-hotels`, `/for-cafes`, `/for-bars`, `/for-fitness`, `/for-pharmacies` ✅

**Built:**
- `/settings` onboarding checklist (the v1 #1 ship) ✅
- Plausible funnel tracking on Landing CTAs, Pricing CTA, Tool CTAs, Register submit ✅
- Audit-preview: above-fold CTA + founder card + 2-review fold + expander ✅
- `/pricing`: ChatGPT comparison row + Pro/Business waitlist replacing dead "Coming soon" buttons ✅
- `/register`: source-aware copy (stripe / audit / organic) ✅
- Dashboard: first-reply celebration toast + Plausible activation event ✅
- Stripe-paid welcome email + founder alert ✅

**Still on the v1 build-first list, not done:**
- Public demo audit URL (one persistent /audit-preview-demo so prospects who land on /pricing can see a sample without an outreach link)

---

## PART 1 — Customer journeys (current state)

### Journey A: Cold prospect via outreach (still the primary path)

```
[Wave 5 email] → /audit-preview/:token → [3 outcomes]
                                       ├→ Stripe Checkout → /register?from=stripe → /dashboard
                                       │                                          → /settings (onboarding wizard auto-renders)
                                       ├→ LINE / email button → async chat with founder
                                       └→ bounce
```

**Materially better than v1.** The audit page now has above-fold CTA,
founder card, collapsed review wall. Stripe → /register → /dashboard
now drops the customer into a real onboarding wizard instead of a flat
settings page. Source-aware /register copy makes paid customers feel
acknowledged.

**Still weak:** the conversion data won't tell us anything for ~5-7
days. Until Wave 5 lands and Plausible aggregates a signal, this
journey is "instrumented but unproven."

### Journey B: Organic visitor via SEO (still the secondary path)

```
[Google search] → / (Landing)            ──┐
                  /for-spas / dentists   ──┼→ /pricing → Stripe → /register → /dashboard
                  /blog/{post}           ──┤                  ↘
                  /tools/{tool}          ──┘                   Pro/Business → waitlist signup
```

**Materially better than v1.** Vertical surface shrank from 8 → 2.
/pricing now has ChatGPT comparison row directly answering "why pay
$14." Pro/Business no longer dead-button — they're real demand-signal
instruments. /tools CTAs have Plausible tracking.

**Still weak:** the bridge from /blog → product is still implicit.
Each blog post ends with a soft CTA ("learn more") not a "try this
with your own reviews" hook. Tools have bridges but ratios are
untested.

### Journey C: Free-tool user (the brand-awareness path)

```
[Google search for "review reply generator"] → /tools/review-reply-generator
                                               → uses tool, gets value
                                               → CTA to /register or /pricing (now tracked in Plausible)
                                               → ???
```

**Same shape as v1.** Bridges exist but unproven. Now at least
measurable — Plausible will show GeneratorRegisterClick, GeneratorPricingClick
counts. If counts stay near zero, the tools are a brand surface only,
not a funnel.

### Journey D: New paying customer (the activation path)

```
Stripe checkout success → /register?from=stripe → /dashboard
                                                 → "📭 connect a platform" empty state
                                                 → /settings → OnboardingChecklist (1: Google, 2: LINE/Telegram)
                                                 → connect both → wizard hides
                                                 → first review polls in → notification fires
                                                 → tap-save first reply → 🎉 celebration toast + Plausible FirstReplySent
```

**Newly built and instrumented.** Untested by a real customer because
none have signed up. The activation funnel is now READABLE
(stripe_signup → register → first_platform_connected → first_chat_channel_connected
→ first_reply_sent) — but with 0 paying customers, no readout yet.

### Journey E: Operator (founder)

```
/login → /outbound-audits (create per-prospect audit URLs)
       → /admin/brief (overview)
       → /owner (business-claim flow)
       → /settings (manage own dashboard + LINE/Telegram)
```

**Unchanged from v1.** Working. Earth uses /outbound-audits daily
during outreach waves.

---

## PART 2 — Page-by-page critique

Only covering pages that materially affect conversion, retention, or
operator workflow. Skipping legal/auth/utility pages.

### / (Landing)

- **Who it's for:** Cold organic SEO visitors + audit-page bouncers wanting the broader product
- **What it's for:** Convince a 4-7 second skim that the product is real, specific, in their language, and worth $14/mo
- **What it should accomplish:** Click CTA → /pricing OR /register
- **What should happen next:** Stripe Payment Link OR free registration
- **What should NOT be on it:** Pro/Business tier marketing (lives on /pricing); deep technical claims; aspirational metrics
- **What's WEAK (still, post-v1):**
  - No founder face on the landing hero. CardStack with real review-draft samples is good but feels decorative — prospect might miss it
  - Hero metric "10 langs · 3 channels · 10s" is honest but reads abstract; should be paired with a single screenshot of the LINE flow above the fold
  - No "tap-to-try-with-your-business" inline tool on the hero (would route to /tools/review-reply-generator)

### /pricing

- **Who it's for:** Visitors evaluating cost; bottom-funnel CTAs from /landing or /audit-preview
- **What it's for:** Show price ladder + remove "is this worth it" objection + capture demand signal for gated tiers
- **What it should accomplish:** Stripe checkout for Starter OR waitlist signup for Pro/Business
- **What should happen next:** Stripe Payment Link → /register?from=stripe → wizard
- **What should NOT be on it:** Duplicate FAQs from /support; long marketing copy
- **What's WEAK:**
  - "What 100 businesses paid us for matters more than what's listed" — can't ship until at least 1 customer exists; honest absence
  - The comparison row is great (ChatGPT, VA, Agency, DIY, ReviewHub) but it's BELOW the plan cards — pricing-evaluators skim cards, see $14, leave. The comparison should appear FIRST or as a sticky right-rail

### /audit-preview/:token (still the most important page)

- **Who it's for:** Cold prospect who clicked a link in a founder's outreach email
- **What it's for:** Convert "saw drafts → like them" into Stripe checkout OR async conversation
- **What it should accomplish:** Stripe click within 90 sec of arrival, OR LINE/email engagement, OR a "saw it 14× walked away" pattern that tells us the pitch is wrong
- **What should NOT be on it:** Generic feature lists; review wall (collapsed to 2 ✅); aspirational tier mentions
- **What's WEAK (post-v1 ships):**
  - **The #1 unspoken objection still isn't addressed:** "is this AI going to embarrass me when I paste it into Google?" There's no "edit the draft inline" or "switch tone" affordance on the page. Adding a tone switcher (Warm / Concise / Formal) with live re-generation would let the prospect feel the agency they'll have as a customer
  - Founder card uses initial "E" in a circle — needs a real photo to feel like a human, not a placeholder
  - No "save these drafts to your dashboard for later" lightweight conversion path between "click Stripe" (high commitment) and "leave"

### /guide

- **Who it's for:** Logged-in new customer trying to complete setup; organic visitors curious how it works
- **What it's for:** Walk through the connect → notify → copy → paste loop with screenshots
- **What it should accomplish:** Reduce first-week churn by making setup completion obvious
- **What should NOT be on it:** Marketing copy; fictional examples
- **What's WEAK:**
  - Now superseded by the new onboarding wizard on /settings. /guide and the wizard cover overlapping ground
  - Decision: keep /guide for organic SEO ("how does ReviewHub work") but DON'T link to it from inside the app — the wizard owns the in-app journey

### /for-spas, /for-dentists (the 2 remaining verticals)

- **Who it's for:** Vertical-specific SEO visitors
- **What it's for:** Capture long-tail SEO + speak in vertical-specific language
- **What it should accomplish:** Click CTA → /pricing
- **What's WEAK:**
  - 2 verticals still exist before any vertical has earned a customer. Per the v1 audit's recommendation, the ROI is unclear until Wave 5 data
  - Going to monitor: if Wave 5 ends up converting from one vertical and not the other, delete the underperformer
  - If neither converts, both die

### /tools/{tool} × 4 (review-reply-generator, reply-roaster, review-impact, one-star-playbook)

- **Who it's for:** SEO traffic searching for tactical review-reply help
- **What it's for:** Free utility → trust → bridge to product
- **What it should accomplish:** Convert tool-user → /register (free tier) OR /pricing checkout OR /audit lead capture
- **What's WEAK:**
  - Tools work, bridges exist, tracking shipped — but the question "do tools convert" is still unanswered. Wait for Plausible data
  - The tools index page (/tools) is a list of 4 utilities with no narrative. Doesn't tell visitors WHICH tool fits their problem
  - Tools are isolated — none link to each other. After using one, the user doesn't know other tools exist

### /vs/chatgpt, /vs/birdeye (the 2 remaining comparison pages)

- **Who it's for:** Comparison-shoppers Googling "X alternative" or "X vs Y"
- **What it's for:** Capture decision-stage search traffic
- **What it should accomplish:** Click CTA → /pricing or /audit
- **What's WEAK:**
  - Same as verticals — kept because they're defensible (ChatGPT is the real silent competitor, Birdeye is the funded incumbent prospects mention) but unproven for conversion
  - Will monitor Plausible for `/vs/chatgpt` → /pricing click-through rates over 30 days

### /blog (BlogIndex + 25+ posts)

- **Who it's for:** SEO long-tail traffic
- **What it's for:** Build domain authority + capture top-of-funnel
- **What's WEAK (unchanged from v1):**
  - Blog → product bridge is still weak. No in-post "try this with your own reviews → /audit" sidebar
  - No newsletter signup form (would convert read-once visitors into ongoing reach)
  - Posts don't link to each other much (internal SEO link graph is sparse)

### /dashboard (authed)

- **Who it's for:** Paying customer (or active free user)
- **What it's for:** Show new reviews + drafts; daily-use product surface
- **What's NEW since v1:** First-reply celebration toast + Plausible activation event
- **What's WEAK:**
  - Still untested by a real customer
  - The "empty state" 📭 emoji CTA is good but the post-first-connect transition isn't celebrated either (only the first REPLY is). Should add a "Google connected ✓ — first reviews appearing in 1-2 minutes" moment

### /settings (authed) — newly polished

- **Who it's for:** New customer in setup mode + existing customers changing preferences
- **What it's for:** Connect Google, connect LINE/Telegram, manage subscription
- **What's NEW since v1:** OnboardingChecklist component at top, shown until 2 setup steps complete
- **What's WEAK:**
  - Checklist has only 2 steps (Google + chat) but a real customer needs a 3rd: "set your reply tone" (currently default tone, no UI to customize)
  - When the checklist hides, the page reverts to its full-flat-section layout. A "you're set up, here's what to do next" follow-up state would help

### /outbound-audits (operator only)

- **Who it's for:** Earth
- **What it's for:** Create per-prospect audit URLs
- **What's WEAK:**
  - Manual paste-reviews flow still required. Automation exists via Chrome MCP (the agent uses it) but not in-app
  - No bulk-import for batch outreach prep

### /admin/brief (operator only)

- **What's WEAK:**
  - Not yet showing new Plausible funnel events
  - Not yet showing waitlist signups (Pro/Business)
  - These are quick to add but currently the admin must check /api/admin/outreach-stats and Plausible separately

### /owner (operator only) — REVISITED from v1

- v1 wanted to kill this. Verified it's a real feature surface (business-claim flow). **Keep.**

### Auth pages — unchanged from v1

Auth surfaces work. /register now has source-aware copy (stripe/audit/organic). The rest is standard.

---

## PART 3 — Structural problems remaining

### Trust gaps still present

1. **No real customer proof anywhere.** Same as v1. Closest is the founder card on /audit-preview. Can't fix until 1 customer exists.
2. **Founder card uses initial "E" not a real photo.** Placeholder reads as "they didn't bother" to some prospects.
3. **8 vertical pages → 2** (✅ shipped per v1). Still feels overweight for 0 customers. Watch Wave 5 signal.

### Friction points still present

1. **Audit page lacks tone-switcher.** The "is this AI going to embarrass me" objection isn't addressed inline.
2. **Tools → product bridge is opt-in.** User has to click. A passive "save this draft to your dashboard for later" would catch hand-raisers who aren't ready to commit.
3. **Dashboard pre-empty experience.** The window between "I connected Google" and "first reviews appear" is silent. Customer might think it's broken.
4. **Settings post-onboarding state has no celebration.** Wizard hides → flat page → no signal of "you're ready, now wait for first review."

### Missing pages (still)

1. **Public demo audit URL.** v1 recommended it; not built. Single biggest unfilled gap. Prospect lands on /pricing without an outreach link → currently no way to see a sample.
2. **A "before/after" gallery page.** "See actual review → AI draft → result" pairs from anonymized real-world data. Powerful for SEO + conversion.
3. **A migration-from-Birdeye page** — `/from-birdeye` walking through how to switch.

### Unnecessary pages (the remaining ones)

- **/vs/birdeye + /vs/chatgpt** — kept because defensible but unproven. Re-evaluate at 30 days. If no Plausible signal, kill both.
- **/for-spas + /for-dentists** — same. Verticals on probation pending Wave 5 data.
- **/about** — useful but generic. Consider folding into / (Landing) hero with founder photo + 1-paragraph story instead.

### Disconnected pages

1. **/blog/{post} → product.** Still soft. Need in-post "try this →" widget linking to /audit or /tools/{tool}.
2. **/tools/{tool} → other tools.** Each tool stands alone. Cross-promotion ("if this was useful, try the Reply Roaster") would compound traffic.
3. **/audit-preview → /pricing.** Goes straight to Stripe via the CTA. Missing: a "see all plans first" link for browsers who aren't ready to pay yet.

---

## PART 4 — Refinement decisions (v2)

### KEEP (high-value, working)

- / (Landing)
- /pricing
- /audit-preview/:token
- /guide
- /dashboard
- /settings
- /outbound-audits (operator)
- /admin/brief (operator)
- /owner (operator — real feature)
- /login + all auth surfaces
- /support
- /terms, /privacy, /acceptable-use, /refund-policy, /legal/th-summary
- /blog + 25+ blog posts (defensible SEO surface)
- /tools + 4 tools (defensible inbound surface)
- /changelog (real, useful, no signal-of-incompleteness anymore since /roadmap died)
- /about (founder transparency)
- /vs/chatgpt + /vs/birdeye (on 30-day probation)
- /for-spas + /for-dentists (on Wave-5 probation)
- /shared/:token (real feature, just unused yet)

### DELETE — nothing today

The aggressive deletion already happened in v1's batch. Nothing else screaming kill-me. Two probation watches (above).

### MERGE

- **/guide and /settings OnboardingChecklist:** these overlap. Decision — keep both but un-link /guide from in-app contexts. /guide is for organic SEO; the wizard is for in-app.

### SPLIT — none today.

### BUILD FIRST (the actual v2 roadmap, ranked)

1. **Public demo audit URL** (~1 hr) — `/audit-preview-demo` persistent, for prospects landing on /pricing without an outreach link. v1's #3 build-first; still not done. **Easy win.**

2. **Tone switcher on audit-preview drafts** (~2-3 hr) — Warm / Concise / Formal toggle that regenerates drafts inline. Addresses the unspoken "will the AI embarrass me?" objection. Highest conversion-leverage of any remaining ship.

3. **Real founder photo on /audit-preview and /landing hero** (~30 min after you upload a photo) — replaces the "E" initial avatar. Trust signal.

4. **/admin/brief surfaces Plausible events + waitlist signups** (~1-2 hr) — so you can read funnel data without bouncing between dashboards.

5. **Dashboard "Google connected ✓ — first reviews in 1-2 min" transition state** (~1 hr) — fills the silent window between connect and first review.

6. **Blog → product widget** (~1-2 hr) — a small inline "try this with your own reviews" link on every post that goes to /audit or /tools/{matching-tool}.

### DON'T BUILD YET

- More verticals (2 kept on probation; don't expand until 1 earns)
- More comparison pages (same)
- Multi-location features (no customer asked)
- API + /api-docs (just killed in v1; don't resurrect)
- Mobile app (web works fine on phones)
- Team/multi-user features
- /year-review, /status (just killed)
- Pro/Business features (waitlist instrument now in place; build only based on demand signal)
- More languages beyond Thai/English (ICP unproven)

---

## Closing read

**v2 punchlines:**

1. **The site is now ~3.3× a pre-revenue solo SaaS rather than 5×** (50 routes → 41 routes; meaningful but not enough yet). Two verticals + two comparison pages are on probation; will delete if Wave 5 produces no signal.

2. **The single biggest remaining conversion lever is the audit-preview tone switcher.** Every other page has been instrumented or improved this week. The audit page's "will this AI embarrass me?" objection is the one we haven't touched.

3. **First-customer activation is now READABLE.** The funnel from Stripe-paid → registered → connected → first-reply-sent is fully instrumented. We'll know within ~2 weeks of any customer signing up whether the activation path works.

4. **Public demo audit URL is the cheapest big win.** v1 recommended it 12 hours ago; still unbuilt. ~1 hr to ship. Closes the gap for prospects who land on /pricing without an outreach context.

5. **The site no longer overpromises.** /api-docs (vaporware) is gone. /status (vanity) is gone. /roadmap (signal-of-incompleteness) is gone. 6 vertical pages claiming "we serve restaurants/hotels/cafes/bars/fitness/pharmacies" without a single customer in any are gone. What remains is closer to honest.

— agent, 2026-05-19 (v2)
