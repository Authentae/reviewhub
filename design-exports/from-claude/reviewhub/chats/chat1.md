# Suit recommendation

_Started 2026-04-24 09:22 UTC_

---

## User



## Assistant

I'll wait for your specific design request. The context above sets up ReviewHub — what would you like me to design? For example:

- The Chrome extension popup UI
- The web dashboard (inbox, analytics, settings)
- The marketing landing page
- The free review-reply generator tool
- Onboarding flow
- Pricing page
- Chrome Web Store listing assets

Let me know which surface to tackle and I'll ask a few focused questions before diving in.

## User

just give me what suit it

## Assistant

I'll design the Chrome extension popup — it's the core product moment where the 10-second promise actually happens. Let me explore the design system first and ask a couple quick questions.

_[tool: list_files]_

The design system folder is empty, so I'll work from the brand tokens you documented in the context (blue-600, indigo gradient, system sans, Tailwind radii, ✨ for AI actions).

Let me design the **Chrome extension popup** as the hero surface — this is where the core "10 seconds" promise lives. I'll make it a fully interactive prototype showing the reply-generation flow across multiple platforms, with Tweaks to explore variations.

_[tool: update_todos]_

_[tool: copy_starter_component]_

_[tool: copy_starter_component]_

_[tool: read_file]_

_[tool: read_file]_

Now let me design the Chrome extension popup. I'll build a realistic interactive prototype where the user is looking at a Google Maps review page and the ReviewHub extension popup is open over it, showing AI-generated reply drafting.

_[tool: write_file]_

_[tool: snip]_

Now the background page (mock Google Maps with the extension popup floating over it) and the main HTML file:

_[tool: write_file]_

_[tool: write_file]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

**Chrome extension popup** — the 10-second product moment, over a live Google review.

- **Platform switcher:** Google, Yelp, Facebook, Tripadvisor, Trustpilot, Amazon, Etsy — each with its own review, URL, tab title, and tinted page header
- **Claude draft flow:** ✨ button → spinner with elapsed seconds → typewriter reveal → copy-paste handoff with toast confirmation
- **Tone + language:** 4 tones (auto-picks Apologetic for 1–2★, Friendly for 4–5★) and all 10 languages with live-translated sample replies (Thai, Spanish, French included)
- **Footer:** "2 of 3 free drafts today · Upgrade to Solo $14/mo" — reinforces the free-tier + price positioning
- **Tweaks:** toggle browser frame, swap platforms, cycle AI accent gradient (indigo-violet, brand blue, sky, sunset)

Try hitting "Draft reply with AI," then switch platforms from the pill at the top of the popup to see how tone auto-adapts to rating.

## User

Specific prompts for common design tasks
After pasting the briefing, here are useful follow-ups for the assets you'll likely need:

Logo / wordmark concepts
Generate 5 logo concept options for ReviewHub as SVG. Each should:

Work at 16×16 (favicon) and 128×128 (Chrome Web Store) sizes
Use the brand blue + indigo-violet gradient
Incorporate either a sparkle, a chat bubble, or a star/review element
Be clean enough to render in monochrome too
Show each as a rendered SVG artifact I can copy.

Chrome Web Store hero banner (1400×560)
Design a Chrome Web Store marquee promo tile (1400×560 PNG-style mock as
HTML/CSS). It should show a faux Yelp page with the ✨ AI Draft button
visible next to a review, plus a tagline. Use the brand gradient as the
backdrop area. Render as an Artifact so I can screenshot it.

Marketing tweet graphics
Generate 5 tweet-card concepts (1200×675) for ReviewHub. Each card has
one of these messages:

"Yelp. Facebook. Google. One AI reply button."
"Reply in 10 seconds. Not 10 minutes."
"Free forever — no credit card."
"Made for solo founders. Priced like one."
"[testimonial quote — leave placeholder]"
Use the brand gradient + clean typography. Render each as an HTML/CSS
artifact at the correct aspect ratio.
Email template designs
Design HTML email templates for: (1) verification, (2) weekly digest,
(3) review request to a customer, (4) follow-up reminder. Use ReviewHub's
brand. Inline CSS only (most email clients strip <style>). 600px max width.

Onboarding flow mockups
Mock up a 3-screen onboarding flow for the ReviewHub Chrome extension as
HTML/CSS Artifacts. Screen 1: install confirmation. Screen 2: paste
token. Screen 3: visit any review platform to see the magic. Each screen
600px wide, mobile-friendly.

## Assistant

_[tool: snip]_

I'll build these as a set. Let me start with the logo concepts and Web Store hero (tightly related), then tweet cards, then emails, then onboarding. I'll use a design_canvas so everything compares side-by-side.

_[tool: update_todos]_

_[tool: copy_starter_component]_

_[tool: read_file]_

_[tool: snip]_

Let me build all the assets now. I'll structure them as separate HTML files referenced from a canvas.

_[tool: write_file]_

_[tool: write_file]_

_[tool: snip]_

_[tool: write_file]_

Now the tweet cards:

_[tool: write_file]_

_[tool: snip]_

_[tool: write_file]_

_[tool: snip]_

_[tool: write_file]_

_[tool: snip]_

Now a simple index page that links everything together:

_[tool: write_file]_

_[tool: register_assets]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

All six assets shipped, indexed from `assets/Index.html`:

- **01 · Logos** — 5 SVG concepts (Star+Spark, Bubble+Star, Sparkle, RH Monogram, Reply Arc). Each shown at 128/48/32/16px + monochrome.
- **02 · Web Store hero** — 1400×560 marquee with faux Yelp page, ✨ AI Draft button, brand-gradient backdrop, "Thai support" callout.
- **03 · Tweet cards** — 5 at 1200×675 covering platforms, 10-seconds-not-10-minutes, free forever, solo-founder pricing ($14 vs Podium $399), and a testimonial template with a visible placeholder tag.
- **04 · Emails** — verification, Monday digest (with stat row + critical/highlight callouts), review request, and a 4-day follow-up. Table layout, inline CSS, 600px max.
- **05 · Onboarding** — 3 screens at 600px: install confirmation with "pin to toolbar" pointer, paste-token with security note, and "go try it" platform launcher.

All screenshot-ready — just open any file and grab the frame. Index: `assets/Index.html`.

