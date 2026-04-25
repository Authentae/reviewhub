# Launch assets

Screenshot-ready HTML mockups from the Claude Design session. Each file
renders at the final output dimensions — open in a browser, maximize the
window, and screenshot directly. No build step.

## Files

| File | Dimensions | Usage |
|---|---|---|
| `web-store-hero.html` | 1400×560 | Chrome Web Store marquee promo tile. Open in browser, use DevTools device toolbar set to 1400×560, screenshot. |
| `tweet-cards.html` | 1200×675 each (5 stacked) | Product Hunt launch day + Twitter thread graphics. Screenshot each card individually at 1200×675. |
| `logo-sheet.html` | Variable | Reference — 5 logo concepts side-by-side at multiple sizes. Concept A (Star + Spark) was chosen and shipped to production via `client/src/components/Logo.jsx`. |
| `asset-index.html` | — | Dashboard linking all the above. Designed as the cover page for a handoff doc. |
| `logo-concepts.jsx` | — | Source of the 5 logo concept SVGs. Useful reference if we ever re-brand. |
| `product-hunt.md` | — | Pre-existing Product Hunt launch playbook — taglines, screenshots brief, day-of timeline. |

## What shipped to the app (not just docs)

- **Logo Concept A** → `client/src/components/Logo.jsx` + `client/public/logo.svg` + `client/public/favicon.svg`. Used in Navbar, Landing footer, and all 4 auth pages.
- **Extension popup redesign** → `extension/popup.{html,css,js}` (done in prior session).
- **Emails** → `server/src/lib/email.js` (redesigned per prototype).
- **Onboarding flow** → `extension/welcome.html` + `background.js` install listener.

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
