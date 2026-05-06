# Launch assets

Screenshot-ready HTML mockups from the Claude Design session. Each file
renders at the final output dimensions — open in a browser, maximize the
window, and screenshot directly. No build step.

> **Status note (2026-05-07):** The Chrome extension was dropped from
> scope. The current product is web-only (dashboard at reviewhub.review).
> Some assets in this folder were authored when the extension was the
> hero feature — those are flagged below as `[HISTORICAL — extension-era]`
> and should not be used as positioning references for current marketing.

## Files

| File | Dimensions | Status | Usage |
|---|---|---|---|
| `tweet-cards.html` | 1200×675 each (5 stacked) | **Current** (refreshed 2026-05-07) | Twitter thread graphics. Screenshot each card individually at 1200×675. Card 5 still needs a real customer quote. |
| `logo-sheet.html` | Variable | **Current** | Reference — 5 logo concepts at multiple sizes. Concept A (Star + Spark) was chosen and shipped to production via `client/src/components/Logo.jsx`. |
| `logo-concepts.jsx` | — | **Current** | Source of the 5 logo concept SVGs. Useful reference if we ever re-brand. |
| `product-hunt.md` | — | **Current** (refreshed 2026-05-07) | Product Hunt launch playbook — taglines, description, maker's comment, gallery shotlist. Web-only product. |
| `asset-index.html` | — | **Current** | Dashboard linking the above. Designed as the cover page for a handoff doc. |
| `web-store-hero.html` | 1400×560 | `[HISTORICAL — extension-era]` | Chrome Web Store marquee. We aren't shipping the extension; this asset is unused. Kept for reference if the extension is ever revived. |

## What shipped to the app (not just docs)

- **Logo Concept A** → `client/src/components/Logo.jsx` + `client/public/logo.svg` + `client/public/favicon.svg`. Used in Navbar, Landing footer, and all 4 auth pages.
- **Emails** → `server/src/lib/email.js` (redesigned per prototype).
- **og-image.png** (rendered from `og-image.svg` via sharp) — used as the social-card image on every reviewhub.review URL.

> Removed from "shipped" list (2026-05-07): Extension popup, extension
> welcome flow, extension background.js. The `extension/` folder may
> still exist as legacy code; treat as un-shipped until we revisit.

## How to screenshot the tweet cards

1. Open `tweet-cards.html` in Chrome
2. Open DevTools → toggle device toolbar (`Ctrl+Shift+M`)
3. Set viewport to 1200×675 for each card
4. Scroll to the card you want
5. DevTools → "Capture node screenshot" on the card's wrapper div

## How to screenshot the Web Store hero

1. Open `web-store-hero.html`
2. DevTools device toolbar → 1400×560
3. Full-page screenshot

Each card is designed to fit exactly in its target frame; no cropping needed if viewport is correct.
