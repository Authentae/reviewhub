# Frill setup

Frill is the feedback / public roadmap widget that shows up as a floating
button in the corner of every page. Users click it to suggest features,
upvote ideas, and see what's planned/shipped.

The integration is **inert until you set `VITE_FRILL_KEY`**. No widget
appears on production until that env var lands and you redeploy.

## One-time setup

1. Sign up at https://frill.co (free plan available).
2. Create a new project — name it "ReviewHub".
3. Go to the **Widget** tab in your Frill dashboard.
4. Copy the widget key (looks like `8a3c…`, ~32 chars).
5. In Railway → Variables on the **client** service, add:
   ```
   VITE_FRILL_KEY=8a3c…
   ```
6. Trigger a redeploy (Railway will rebuild the client bundle with the
   key embedded — Vite env vars are inlined at build time).

The widget appears within ~30 seconds of deploy completion.

## Verifying it's live

```bash
curl https://reviewhub.review/api/health | jq '.components.frill'
# expected: "configured"
```

Then load the production site — the floating Frill button should appear
in the bottom-right corner.

## CSP

The CSP allowlist already covers Frill:

- `script-src` includes `https://widget.frill.co` (loads the widget JS)
- `connect-src` includes `https://api.frill.co` (XHR for suggestions)
- `img-src` includes `https://*.frill.co` and `https://*.frillcdn.com`
  (avatars, suggestion images)

If Frill ever changes CDN domains, watch the browser console for CSP
violations and update `server/src/app.js`.

## Disabling

Unset `VITE_FRILL_KEY` and redeploy. The component is a no-op when the
key is empty — no script tag is appended, no globals are set.
