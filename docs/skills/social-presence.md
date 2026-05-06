# Social presence — ReviewHub brand voice, criteria, assets

This is the skill I (the agent) consult BEFORE any social-presence
action: profile setup, avatar/header changes, individual posts,
DM replies, or new-platform launches. If I'm about to post or change
something and haven't read this first, I'm doing it wrong.

The skill exists because in 2026-05-07 I (the agent) jumped into
posting on X without first establishing criteria. I posted a tweet
that went out as just a URL (body text dropped due to JS exec
weirdness), the link card had no og:image (so it looked unprofessional),
and the profile had no avatar (default letter). All three failures
would have been caught if I'd consulted a skill first.

---

## 1. The brand on social — who ReviewHub IS

**Voice tone:** Calm, helpful, slightly opinionated. Same register
as the marketing site copy (Instrument Serif headlines, plain-prose
body, no corporate filler). Specifically:

- **DO:** be specific ("AI drafts replies in 10 seconds, you approve").
- **DO:** acknowledge nuance ("for 1-star reviews we write very
  differently than for 5-stars").
- **DO:** use Bangkok-grounded references when natural.
- **DO:** address SMB owners as peers, not buyers.

- **DON'T:** use corporate jargon ("synergize", "leverage", "best-
  in-class").
- **DON'T:** post generic motivation ("Mondays are for hustle 💪").
- **DON'T:** post "we're hiring" cosplay (we're solo, pre-revenue —
  faking growth is dishonest and gets caught).
- **DON'T:** address Earth in first-person ("our founder Earth..." —
  brand voice is brand-only; founder posts go on Earth's personal
  account if/when one exists).
- **DON'T:** reply to political / cultural-flame trends. Stay on-topic
  for review-management for SMBs.

**Account identity:** "ReviewHub" the brand speaks. Never "I" / "me".
The brand can have opinions. The brand can be specific. The brand
should NOT pretend to be a person.

---

## 2. Pre-post checklist (the "done = verified" gate)

Before any post is sent, every line below must be true:

```
[ ] Voice matches §1 (no jargon, no fake growth, no off-topic)
[ ] Body text actually contains the body (verify: read the rendered
    post text in the composer; check it's not just a URL)
[ ] If the post contains a link, the link unfurls correctly:
    [ ] og:image renders (not a generic icon placeholder)
    [ ] og:title is specific to ReviewHub (not "Vite + React")
    [ ] og:description is honest and concrete
[ ] If posting an image: alt-text is set
[ ] Spelling + Thai script (if Thai post): visually checked
[ ] Length: under 280 chars for X; 3000 for LinkedIn
[ ] No mentions of unverified product claims (e.g. don't say "5,000
    customers" — we have 0; don't say "loved by Bangkok's top hotels"
    — we have no customers)
```

If ANY line is false, fix it before sending. Don't ship-then-edit on
public social — every edit shows as edited and damages trust.

---

## 3. Profile assets — what each platform needs

### X / Twitter

| Asset | Spec | Status |
|---|---|---|
| Display name | "ReviewHub" | ✓ set |
| Handle | @reviewhubreview | ✓ set |
| Bio (160 char) | "AI-drafted review replies in your voice. Google + 60 platforms via CSV. 10 seconds per reply. Made in Bangkok. reviewhub.review" | **TO UPDATE** (current bio still mentions cafés/hotels/shops + Google-only — too narrow) |
| Location | "Bangkok" | ✓ set |
| Website | https://reviewhub.review | ✓ set |
| Avatar (400×400 PNG) | **Use the official `client/public/logo.svg` rendered at 400×400.** Just the sparkle tile — no wordmark (illegible at avatar size). The official brand mark, already shipped to production via `Logo.jsx`. | **TO UPLOAD** — render via sharp; do NOT use the earlier `x-avatar.png` I generated (had a redundant wordmark) |
| Header (1500×500 PNG) | Screenshot of one of the 5 cards in `docs/launch/tweet-cards.html` (Card 2 "10 seconds. Not 10 minutes." is the strongest standalone). Crop to 1500×500 for X. | **TO UPLOAD** |
| Pinned tweet | One strong post explaining what ReviewHub is | **PENDING** — see §5 Type A/B for templates |

### LinkedIn (when created)

Similar pattern. Logo (square), banner (wide), tagline, about-section
that mirrors the X bio but longer-form (LinkedIn allows ~2000 chars).

### Reddit / Indie Hackers (when created)

Lower-stakes profiles — username + small bio + link. Avatar can be
the same as X avatar. No banner needed for Reddit.

---

## 4. og:image — the link card image

When ANY URL on `reviewhub.review/*` is shared on social (X, LinkedIn,
iMessage, LINE, Slack, Discord), the platform crawler fetches the
URL and looks for an `og:image` meta tag to render the link preview
card. If the image doesn't render (SVG that crawler can't read,
404, wrong dimensions), the card looks like a broken/unprofessional
URL.

**Current state (2026-05-07 evening):** og:image set to
`og-image.svg`. SVG support on social crawlers is **inconsistent**:
- Facebook / LinkedIn: don't render SVG og:images. Card shows no image.
- X: variable; sometimes renders, often doesn't.
- iMessage / LINE / Slack: usually don't render SVG.

**The fix:** generate a PNG version (1200×630, the canonical
og:image size) and update meta tags. SVG can stay as fallback but
PNG should be the primary `og:image` value.

**Required visual:** brand-consistent. Options:
- Wordmark + tagline (most common, low-effort)
- Mock-up of the audit-preview page (shows the product immediately)
- Founder photo + quote (high-effort, lower priority for brand-only)

---

## 5. Posting criteria — what kinds of posts count as good

Five post types, ranked by frequency:

### Type A: Specific tip (most common)

A useful tactical observation about review management. ~50% of posts.

> *Example: "If you're a small business with under 100 Google
> reviews, asking on the receipt is the highest-leverage move.
> One line + QR pointing at your direct review form (NOT the
> listing page) cuts the path from 6 taps to 2."*

### Type B: Honest insight or counter-take

Something most owners get wrong, with the better answer. ~20%.

> *Example: "'Thank you for your feedback' to a 1-star review
> reads as dismissal. Specific acknowledgment of what went wrong
> reads as accountability. Same words you'd use in person."*

### Type C: Customer-shape story

A pattern observed in real review data. NOT a fake testimonial. ~15%.

> *Example: "Pattern from this week's audit URLs: hotel owners
> reply 3x more often to long detailed reviews than to short
> 5-stars — even though short 5-stars are the easier wins."*

### Type D: Tool / product mention

When something genuinely new ships, announce it. ~10%.

> *Example: "Shipped: free Reply Roaster — paste a draft, get an
> instant tone critique. No signup. reviewhub.review/tools/reply-roaster"*

### Type E: Question / observation

Open-ended, invites replies. ~5%.

> *Example: "Owners — when a 1-star lands at 11pm, what's your
> first move? Reply now, sleep on it, or block it from your phone?"*

**What we DON'T post:** generic motivation, hot-take political
opinions, "X just shipped Y" reaction commentary on other companies'
features, listicles ("10 ways to..." — feels generic).

---

## 6. Cadence

For an account with 0 followers (where we are 2026-05-07):

- **Daily** — 1 quality post (Type A or B preferred)
- **Weekly** — 1 product update if there's a real ship (Type D)
- **Quarterly** — review & evolve the playbook based on what worked

For an account with 100+ followers:

- **Daily** — 2-3 posts mixing types
- **Weekly** — at least one Type C (story/insight)
- **Monthly** — review which types drove most engagement

**Don't post for the sake of posting.** Empty posts are worse than
silence — they train followers to scroll past the brand.

---

## 7. Replies + DMs

When someone replies to a ReviewHub post:

- **If genuine question or interest:** reply within 4 hours during
  Bangkok day-time hours. Brief, helpful, brand-voice. Don't try to
  immediately convert — answer the question.
- **If trolling or off-topic:** ignore. Don't engage.
- **If competitor sniping:** ignore. Don't engage publicly. Note
  for awareness.
- **If bug report / complaint:** apologize + offer to take to email.

DMs follow same rules. Earth handles tone-judgment calls; agent
drafts and surfaces for approval per CLAUDE.md "explicit permission
for sending messages" rule.

---

## 8. The pre-action checklist for the agent

Before I (the agent) take ANY social-presence action, I run this:

```
[ ] Did I read this skill in the current session?
[ ] Did I check `docs/launch/` for existing brand assets BEFORE
    generating my own? (See §10. Generating duplicate assets when the
    designed ones already exist is a real failure mode.)
[ ] Does the action match the brand voice in §1?
[ ] Have I run the §2 pre-post checklist (if posting)?
[ ] If profile change: are the assets in §3 actually generated/loaded?
[ ] If link share: does the og:image work (§4)?
[ ] Did I surface the draft for Earth's approval before sending?
```

If any answer is "no," stop. Fix first.

## 10. Use existing brand assets — do NOT regenerate

Earth flagged on 2026-05-07 that I (the agent) was generating brand
assets (X avatar, X header) without first checking `docs/launch/`,
which already has a designed asset suite from a real brand session.

**The rule:** before generating any brand asset (logo, header, OG
image, tweet graphic, slide deck cover), I check `docs/launch/`
first. Specifically:

| Need | Use this | NOT this |
|---|---|---|
| Avatar / logo mark | `client/public/logo.svg` (rendered at target size via sharp). Just the sparkle — no wordmark. | A new sparkle SVG with a wordmark added. |
| X header / banner | A screenshot of one of the cards in `docs/launch/tweet-cards.html`, cropped to 1500×500. Card 2 ("10 seconds. Not 10 minutes.") works best standalone. | A new SVG header. |
| OG card | `client/public/og-image.png` (rendered from `og-image.svg` via sharp). | A new design from scratch. |
| Tweet graphic | One of the 5 cards in `tweet-cards.html`, screenshotted at 1200×675. | A new graphic. |
| Launch playbook | `docs/launch/product-hunt.md` (refreshed 2026-05-07 for web-only product). | New positioning copy. |

**Historical assets — do not use:** `docs/launch/web-store-hero.html`
was designed when the Chrome extension was the hero feature. Extension
dropped 2026-05; this asset is unused. The README and asset-index.html
flag it as `[HISTORICAL — extension-era]`.

**When generating IS legitimate:** when there's a real gap that the
launch deck doesn't cover (e.g. Reddit avatar that needs a different
crop, LinkedIn banner at a specific aspect ratio). Even then: render
from the SAME source SVGs in `client/public/logo.svg` or
`og-image.svg` for consistency, don't author a new design.

**If the source asset itself is wrong** (e.g. wordmark too big, color
slightly off), update the source `client/public/logo.svg` so the
change propagates everywhere. Do not fork into a parallel design.

---

## 9. Open items (2026-05-07)

Tracking what's still missing:

- [ ] PNG og:image (currently SVG, doesn't render on most crawlers)
- [ ] X avatar (currently default letter)
- [ ] X header image (currently empty)
- [ ] First proper pinned post on X
- [ ] LinkedIn page (not yet created)
- [ ] Reddit account (not yet created)
- [ ] Indie Hackers account (not yet created)
