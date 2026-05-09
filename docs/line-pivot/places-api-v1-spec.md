# Places API v1 — read-only review fetching (no Google Business Profile API approval needed)

**Status:** Spec only. Ships when Earth signals go.

**Why this exists:** Google Business Profile API requires approval (3-42 days). Until approved, ReviewHub can't fetch or post reviews via the canonical path. Places API (Google Maps Platform) is a different API — NOT gated, just needs an API key — that can READ up to 5 most recent reviews per place. This unblocks v1 of the LINE pivot without waiting on Google's approval queue.

**The trade-off:** Places API can read only. To post replies we still need Business Profile API approval. v1 ships with manual copy-paste; v2 swaps to one-tap auto-post when approval lands.

---

## What's already in place

- `businesses.google_place_id` column in DB schema (currently NULL for all rows)
- `PUT /api/businesses/:id` endpoint accepts `google_place_id` field
- `LINE OA scaffold` (webhook + messenger + flex builder) shipped today

## What's missing

- Google Maps Platform API key + env var (`GOOGLE_MAPS_API_KEY`)
- Code to call Places API
- Cron job to poll for new reviews
- Settings UI to enter / lookup Place ID
- Honest landing copy update (manual paste, not auto-post)

---

## Scope

### 1. New module: `server/src/lib/providers/googlePlaces.js`

```js
// API key auth (vs OAuth). Single key works for all customers.
function isConfigured() {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}

// Search Places API by text query, return best match's Place ID.
// Used to auto-suggest Place ID from a business name.
async function lookupByName(businessName, hint = 'Bangkok') {
  // GET https://places.googleapis.com/v1/places:searchText
  // returns top match { placeId, displayName, formattedAddress }
}

// Fetch up to 5 most recent reviews for a place.
async function fetchReviews(placeId) {
  // GET https://places.googleapis.com/v1/places/{placeId}?fields=reviews
  // returns reviews: [{ name, rating, text, publishTime, authorAttribution }]
  // dedup key per review: hash(author + publishTime + first 50 chars of text)
}
```

Cost analysis at pre-revenue scale:
- $200/mo Google Maps Platform free credit
- Place Details (with `reviews` field): $17 per 1k requests
- Polling 5 customers every 30 min = 7,200 calls/month → free tier covers it
- Polling 10 customers every 30 min = 14,400 calls/month → ~$78/mo
- Polling every hour halves cost → 10 customers = ~$39/mo

### 2. Cron extension

Add to existing `server/src/jobs/scheduledReplyPoster.js` (or new `placesPoller.js`):

```js
async function pollPlacesReviews() {
  // For each business with google_place_id NOT NULL:
  //   - Fetch reviews via Places API
  //   - For each review: compute dedup hash, check if in DB
  //   - If new: insert into reviews table with external_id = hash
  //   - Generate AI draft via existing aiDrafts module
  //   - If user has line_oa_link: pushFlex(buildReviewNotificationFlex(...))
  //   - approveUrl points to /dashboard/reviews/:id (manual copy-paste flow,
  //     NOT one-tap auto-post until Business Profile API approved)
}
```

Frequency: every 30 min (matches existing scheduler cadence).

### 3. Settings UI

New section in `client/src/pages/Settings.jsx`:

```
Google Business Profile
  Business name on Google Maps: [text input]  [Look up Place ID]
  Place ID: [Place ID, auto-filled from lookup OR pasted manually]
  Status: ✓ Reviews syncing every 30 min · last check: 2 min ago
```

Lookup button calls `POST /api/businesses/:id/lookup-place-id` which uses `googlePlaces.lookupByName()` and returns top 3 matches for confirmation.

### 4. Flex message tweak

The existing `buildReviewNotificationFlex` has an "Approve & post" button that sends to `approveUrl`. For v1 (manual paste), this URL goes to a dashboard page where the customer can:
- Copy the draft to clipboard (one-tap)
- See a "Open Google reviews" button that deep-links to their Google Business Profile review page

For v2 (when Business Profile API approves), same `approveUrl` instead hits `/api/reviews/:id/approve-from-line` which auto-posts. Same Flex code, different backend behavior.

### 5. Landing copy honesty update

Current copy on `/line` and Landing.jsx says:
> "Connect Google once. New reviews land — ReviewHub drafts a reply. You approve from LINE OA; we post it."

For v1 (manual paste), update to:
> "Connect Google Place ID once. New reviews land — ReviewHub drafts a reply. We send it to your LINE. Tap to copy, paste in Google. (One-tap auto-post launches Q3 2026 when Google's API approval lands.)"

Less magic but honest. Brand integrity over hype.

---

## Build estimate

| Step | Time |
|---|---|
| Module: `googlePlaces.js` (lookup + fetch) | 3 hours |
| Tests for `googlePlaces.js` (stub fetch, dedup hash) | 1 hour |
| Cron poller integration | 3 hours |
| Tests for poller (new-review detection, dedup, LINE push) | 2 hours |
| Settings UI: business-name lookup + Place ID save | 4 hours |
| Honest landing copy update | 1 hour |
| End-to-end manual test with Earth's connected business | 1 hour |
| **Total** | **~15 hours = 2 working days** |

Add 1 day buffer for Place ID lookup edge cases (multiple matches, no match, ambiguous Thai names) → 3 days realistic.

## Env var setup (Earth — 5 min)

1. https://console.cloud.google.com → APIs & Services → Library
2. Enable **Places API (New)**
3. Credentials → Create credentials → API key
4. Restrict the key to "Places API (New)" only (security best practice)
5. Set on Railway: `GOOGLE_MAPS_API_KEY=<value>`

## v1 → v2 migration when Business Profile API is approved

Three changes:
1. Replace `googlePlaces.fetchReviews()` cron with `googleBizProfile.fetchReviews()` (gets full history, not just 5)
2. Wire `/api/reviews/:id/approve-from-line` to auto-post (existing `scheduledReplyPoster.js` code)
3. Update landing copy back to "one-tap approve, we post it"

Code changes: ~2 hours. Customers seamlessly upgrade from manual-paste to auto-post.

---

## Pre-build decisions Earth needs to make

1. **Build it now (in parallel with Google API application) or wait?** I recommend now — gets v1 in market while we wait for approval.
2. **Frequency: every 30 min vs every hour vs realtime push?** Recommend 30 min (free tier covers it, fast enough for owners).
3. **Lookup by business name in Settings, or paste Place ID directly?** Recommend BOTH — auto-suggest by name with manual paste fallback for owners who already know their Place ID.
4. **Manual paste UX detail: clipboard copy + deep-link to Google, or text-to-share via LINE?** Recommend clipboard + deep-link.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Places API only returns 5 most recent → busy hotels miss reviews | Low (most SMBs <1 review/day) | Hourly polling caps miss-rate; Business Profile v2 fixes |
| Manual paste friction kills conversion | Medium | Wave 5 outreach measures this; if paying customers hate it, accelerate Business Profile API approval pressure |
| Google rotates API surface (Places API New vs old) | Low | Code calls only stable endpoints |
| Free tier exhausted at scale | Low pre-revenue | At 50+ customers we have revenue to cover ~$50/mo cost |
| Place ID lookup returns wrong place for Thai-named businesses | Medium | Manual paste fallback; show 3 suggestions and let customer pick |
