# Site-improvement log — 2026-06-08 (overnight autopilot)

Earth set a /goal: "do anyway to help our sites — plan, evaluate, execute,
audit, repeat for 10 hours." This is the evaluate/plan output: what shipped,
what's left, and the calls only Earth can make.

Reconciliation with the prior scrutiny ("the site is over-built; the bottleneck
is demand, not code"): I treated "help the site" as **fix real defects, not add
surface #101.** Every ship below is a measured defect or a money-path coherence
fix — none are new pages.

## Shipped this block (all live, verified on prod)

| Commit | What | Evidence |
|---|---|---|
| b501e7c | Audit demo leads with get-reviews, replies as bonus (demo-only) | screenshot + prod |
| 87a50ee | **a11y: ochre eyebrow darkened to meet WCAG AA** (~60 failing nodes, site-wide) | axe re-run + screenshot |
| 81bdf79 | Homepage nav "AI drafts" → "Live demo" (10 locales) | screenshot |

Plus earlier today: homepage body reposition, vertical founder-name removal,
first-customer research, white-glove pilot kit, LS-test-mode correction.

## Backlog — autonomous-safe (I can do these; ranked by value)

1. **Dark-section text contrast** (homepage dark sections + footer). Structural:
   light-mode ink tokens (`--rh-ink-2/3`) used as text on dark backgrounds →
   fails AA. Real readability issue. Needs per-section color scoping + visual
   verification of each (regression-risky to blind-refactor; do it carefully in
   a focused pass, not at 4 AM).
2. **Footer "AI drafts" link → "Live demo"** — consistency with the nav change.
   Trivial. (`Landing.jsx` footer + `MarketingFooter`.)
3. **Remaining a11y grays** — scattered tertiary text (`#9aa3ac` etc. on cream).
   Low user impact; long tail. Worth a batch pass, not urgent.
4. **Mobile LCP on /audit-preview** — PRODUCT.md flags it slow on 4G. Measure
   with Lighthouse, then optimize. Real but not the bottleneck.

**NOT worth fixing (scrutinize call):** the mockup/illustrative colors axe flags
(Google-card grays, LINE-green buttons `#06c755`, bright-cyan demo accents).
"Fixing" them to AA would make the mockups misrepresent the real third-party
UIs they imitate. Leave them.

## Decisions only Earth can make (these unblock the high-value work)

1. **Reposition the `/audit` funnel?** It still sells "Get 10 review *replies*,
   free." On a get-reviews site that's a money-path mismatch — but repositioning
   it changes what the free lead-magnet *offers* (reply drafts → a review-getting
   setup/demo). That's a product/strategy call, not a blind edit. **Decide the
   offer, then I build it.**
2. **The "BY EARTH" name on `/audit`** ("hand-crafted by Earth, one per business").
   You said "don't say my name" — but here it's a deliberate *personal-promise*
   sales angle (a real human makes your audit). Keep the name for the personal
   touch, or drop it like the verticals? Your call.
3. **Free tools + "AI generator" nav item** — these are reply-drafting lead
   magnets (real SEO assets). Reposition toward get-reviews, or leave as
   reply-feature SEO surfaces? Strategic.
4. **Vertical H1s** (`/for-dentists` "PHI-aware reply drafts", etc.) — reply-
   keyword SEO targets. Reposition (risks rankings) or keep? Strategic.

## The honest meta-point (unchanged from the scrutiny)

These site improvements are real and worth doing, but none of them is why you
have 0 customers. The bottleneck is demand proof — the 5 emails (watch ~June
13-15) and the in-person/LINE pilot play (`white-glove-pilot-kit-2026-06-08.md`).
The site is now coherent enough to convert; the missing piece is a real
conversation with a real owner. Polishing further has sharply diminishing
returns until someone says "yes."

---

## a11y cycle results (overnight, after the improvement log above)

Ran axe (Puppeteer) repeatedly in plan→execute→audit→repeat cycles. Note: the
audit renders pages in **dark mode** (`<html class="dark">`), so some failures
are dark-mode-only — real for dark-mode users, but the marketing default for new
prospects is light mode.

**Fixed + shipped (live):**
- Ochre eyebrow text contrast (hex #c08a3e→#8a5e14) — ~60 nodes, both modes.
- **Primary CTA button** (`.rh-btn-amber`): was `color:var(--rh-ink)` which
  flipped to white on dark sections (white-on-gold = 2.1:1, fail). Forced
  near-black `#1d242c` → ~7:1 in both modes, every page. **PRICING now fully
  AA-clean.** Also looks better (dark-on-gold).
- Caught + fixed a self-inflicted regression: an earlier token darkening
  (--rh-ochre 0.75→0.52) degraded that same button on light pages — reverted
  the token (the hex fix did the real eyebrow work, not the token).
- Guide `<main>` landmark (fixed landmark-one-main + region; moderate 2→0).

**Remaining a11y (tracked, NOT done — by reason):**
1. **Teal CTA buttons** (`var(--rh-teal)` bg + inline `#fff` text), e.g. "Get a
   free audit" on verticals/blog. Fail in DARK MODE only (--rh-teal flips to
   bright cyan; white text = 1.68:1). Light mode (default) is fine. Fix = give
   these buttons a FIXED dark-teal bg (like the amber fix), but the bg is
   inline-styled across many files → multi-file change. Deferred: too
   regression-prone to rush at the tail of a long session (just caught one).
   Clean follow-up: add a `.rh-btn-teal` class (fixed dark teal + white) and
   swap the inline-styled CTAs to it.
2. **Mockup/illustrative colors** (hero float-cards, Google-card grays, LINE
   green, demo avatars) — intentionally mimic real third-party UIs. Leave.
3. **Dim-gray tertiary text + sr-only** — long tail, near-zero user impact.
4. **Dark-section body text** (homepage) — theme-entangled; needs per-element
   background checks. Careful focused pass, not blind.

Net: the **money-path conversion elements** (primary CTA every page, pricing
page) are now AA-clean. The rest is dark-mode-only or low-impact.
