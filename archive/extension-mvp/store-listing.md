# Chrome Web Store Listing — ReviewHub

Copy-paste-ready text for the Chrome Web Store developer console.

## Name
`ReviewHub — AI Review Replies`

## Summary (132 chars max)
`Draft professional review replies in 10 seconds — on Yelp, Facebook, TripAdvisor, Trustpilot & more. Free plan included.`

## Category
`Productivity`

## Language
`English (and 10+ via the ReviewHub web app)`

## Description (long)

```
Reply to every Yelp, Facebook, TripAdvisor, Trustpilot, Amazon, and Etsy
review in under 10 seconds — right inside the page you're already on.
Google reviews sync automatically through the ReviewHub web dashboard.

WHAT IT DOES

• Detects reviews on Yelp, Facebook, TripAdvisor, Trustpilot, Amazon, and
  Etsy review pages
• One click drafts a professional reply using AI (powered by Claude)
• Copy and paste into the platform's native reply field — done in seconds
• Works in 10 languages — Thai, English, Spanish, French, German, Portuguese,
  Italian, Japanese, Chinese, Korean

WHO IT'S FOR

• Restaurant, café, and salon owners
• Solo professionals (dentists, salons, repair shops, boutique hotels)
• Small marketing agencies managing multiple clients
• Anyone tired of typing "Thank you for your review!" over and over

WHY IT'S DIFFERENT

• Works across six review platforms in-page, with Google sync via the web app
• Permanent free plan (3 AI drafts per month)
• Unlimited AI drafts on the paid plan (just $14/month — or ฿490 in Thailand)
• No trial pressure, no sales calls
• Your drafts adapt to review sentiment automatically — thank positive
  reviewers warmly, address negative ones constructively
• Replies in the language the review was written in (English reviews get
  English replies, Thai reviews get Thai replies)

HOW IT WORKS

1. Install the extension
2. Sign up free at reviewhub.review (no credit card)
3. Generate an extension token in Settings → Browser Extension
4. Paste it into the extension popup
5. Visit any review page → click the ✨ button next to any review

PRIVACY

• Review text is sent to ReviewHub's servers only when you click the draft
  button — never before, never passively
• We don't store reviews — only the drafts you request
• Your extension token lives only in Chrome's encrypted local storage
• Full privacy policy: reviewhub.review/privacy

SUPPORTED PLATFORMS

In-page injection: Yelp, Facebook, TripAdvisor, Trustpilot, Amazon, Etsy
Via web dashboard: Google Business Profile (OAuth sync), plus 60+ more
platforms including Wongnai, Tabelog, Naver Place, Dianping, TheFork,
HolidayCheck, Reclame Aqui via CSV import.
Coming soon (in-page): Booking.com, Airbnb, Google Play, App Store

Full multi-platform review dashboard + analytics + weekly digest + bulk
review request campaigns available at reviewhub.review.

---

Questions? Feedback? hello@reviewhub.review
Full product: https://reviewhub.review
```

## Tagline variants (A/B test these)

1. "Reply to reviews in 10 seconds, on any platform"
2. "The AI reply button for Yelp, Facebook, TripAdvisor & more"
3. "Stop retyping 'Thanks for the review' — AI does it for you"
4. "One extension. Every review platform. AI drafts in seconds."

## Screenshots needed (1280×800 PNG, 5 slots)

1. **Hero** — extension popup showing "Connected" state next to a Yelp review page with an ✨ button visible
2. **In-context** — TripAdvisor page with a review + the ✨ button highlighted
3. **Dialog** — the AI draft modal showing a drafted reply with the "Copy" button
4. **Multi-platform** — collage of the extension working on Yelp, Facebook, TripAdvisor
5. **Multi-language** — same review with English draft + Thai draft side-by-side

## Promo tile (440×280 PNG)

Brand gradient background (#1e4d5e → #2c7889), center text: "Reply to every review in 10 seconds", ReviewHub logo bottom-right.

## Small promo tile (920×680 PNG)

Same aesthetic as promo tile, larger with platform logos at bottom (Yelp, Facebook, TripAdvisor, Trustpilot).

## Marquee promo tile (1400×560 PNG)

Hero shot of a laptop showing Yelp with the extension button visible. Tagline: "The AI reply button for every review platform."

## Privacy disclosures required

Single Purpose:
`Drafting review replies with AI by reading review content on the active tab and sending it to the user's ReviewHub account for processing.`

Permissions Justification:
- `storage` — to save the user's extension token between sessions
- `activeTab` — to read review content from the page the user is viewing when they click the button
- `scripting` — to inject the draft-button UI into review pages
- `host_permissions` (Yelp/Facebook/TripAdvisor/Trustpilot/Amazon/Etsy) — to inject content scripts on supported review platforms

Data usage declaration (Chrome Web Store form):
- ✅ Personally identifiable information: no (reviewer names are handled but not stored long-term)
- ✅ User activity: yes (review content the user asks to draft for)
- Is data transferred to a third party: yes (Anthropic, for AI generation — disclosed in privacy policy)
- Is data sold: no
- Is data used for purposes unrelated to the single stated purpose: no
