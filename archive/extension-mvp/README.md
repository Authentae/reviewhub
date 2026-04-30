# ReviewHub Browser Extension

One-click AI-drafted review replies on Yelp, Facebook, TripAdvisor, and Trustpilot.
Powered by the same ReviewHub account — no re-signup required.

## Install (development)

While the extension is pre-publication:

1. Clone this repo and `cd` into `extension/`
2. Open Chrome / Edge / Brave → `chrome://extensions`
3. Toggle **Developer mode** on (top right)
4. Click **Load unpacked** → select the `extension/` directory
5. The ReviewHub icon appears in your toolbar

## Configure

1. Click the extension icon
2. Go to [ReviewHub Settings → Browser Extension](https://reviewhub.review/settings)
3. Generate a token and paste it into the extension popup
4. Click **Connect**

## Usage

Visit any supported review page:

- **Yelp for Business** — `biz.yelp.com/...`
- **Facebook Pages / Meta Business Suite** — Page review tab
- **TripAdvisor** — owner or public pages
- **Trustpilot** — business or consumer pages

Next to each review, an ✨ **AI Draft Reply** button appears. Click it → a
drafted response appears → copy → paste into the platform's native reply UI.

The draft uses your business name + the review content to produce a
contextually appropriate response. Uses your plan's AI draft quota (Free:
3/mo, Solo: unlimited).

## File structure

```
extension/
├── manifest.json          # Chrome MV3 manifest
├── background.js          # Service worker: token + API proxy
├── popup.html / popup.js  # Extension icon popup (token setup)
├── popup.css
├── content/
│   ├── common.js          # Shared injection / dialog / toast helpers
│   ├── yelp.js
│   ├── facebook.js
│   ├── tripadvisor.js
│   └── trustpilot.js
├── styles/injected.css    # Styles injected into host pages
└── icons/                 # 16/48/128 PNG icons
```

## Packaging for Chrome Web Store

1. Icons live at `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`
   (already generated). Source SVG and regeneration steps in `icons/ICONS.md`.
   Brand: editorial teal gradient `#1e4d5e → #2c7889` with cream sparkle.
2. Zip the `extension/` folder contents (not the folder itself):

```bash
cd extension
zip -r ../reviewhub-extension.zip . -x "*.DS_Store"
```

3. Upload to <https://chrome.google.com/webstore/devconsole/> ($5 one-time
   developer fee for a Google account)
4. Fill in listing copy (see `store-listing.md`)
5. Submit for review (usually 1-3 business days)

## Adding a new platform

1. Add the origin to `manifest.json` → `host_permissions` and a
   `content_scripts` entry.
2. Create `content/<platform>.js` following the pattern in `yelp.js`:
   implement `findReviews()` and `parseReview(el)`.
3. Add the platform name to `ALLOWED_PLATFORMS` in `server/src/routes/extension.js`.
4. Test against real pages — DOM patterns drift.

## Known limitations

- **Facebook**: heavy markup obfuscation; detection is heuristic and may
  miss some cards. Rating is normalized to 1/5 from recommend/don't-recommend
  signals.
- **Yelp**: reply posting is manual (copy from dialog, paste into Yelp's
  Reply box in biz.yelp.com). Yelp's Fusion API is partner-gated.
- **Posting**: all four platforms require the user to copy-paste the draft
  into the platform's own reply field. We don't auto-post.
- Auto-detection uses CSS selectors that drift over time (~every 6 months).
  Update platform files as needed.
