// Google Places API (NEW) read-only adapter.
//
// Why this exists alongside `google.js` (BaseProvider):
//   - `google.js` talks to Google **Business Profile** API which requires
//     allow-listing (3-42 day approval). Until allow-listed it returns 403.
//   - `googlePlaces.js` talks to Google **Maps Platform / Places API (NEW)**
//     which is NOT gated — just needs an API key. It can READ up to 5 most
//     recent reviews per place. It cannot post replies.
//
// The role of this module in v1: fetch reviews for businesses that haven't
// authenticated their Business Profile via OAuth yet, so we can ship the LINE
// notification + AI-drafted-reply demo end-to-end without waiting on Google's
// approval queue. Replies are posted manually by the owner via copy-paste
// until Business Profile API approval lands. See
// `docs/line-pivot/places-api-v1-spec.md`.
//
// Auth model (vs OAuth in google.js):
//   - Single `GOOGLE_MAPS_API_KEY` env var, used for ALL customers.
//   - No per-customer credential storage — Place ID alone identifies the
//     business.
//
// Fetch is exposed as `module.exports._fetch` so tests can stub it cleanly
// without globally patching `fetch`.

const crypto = require('crypto');

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACE_URL  = 'https://places.googleapis.com/v1/places';

// Field mask for review-fetch — keep it minimal to stay under the
// Place-Details-with-reviews tier ($17/1k). Adding extra fields can push us
// to a higher tier silently.
const REVIEW_FIELDS = 'reviews,displayName,formattedAddress';

function isConfigured() {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}

/**
 * Search Places API by free-text query, return top match metadata.
 *
 * @param {string} businessName  e.g. "Mirth Sathorn"
 * @param {string} hint          locality bias, default "Bangkok"
 * @returns {Promise<null | { placeId, displayName, formattedAddress, suggestions }>}
 *   `suggestions` is the top 3 (incl. the chosen one) so a UI can let the
 *   owner pick the right one when the query is ambiguous (Thai-name overlap,
 *   franchise locations, etc.).
 */
async function lookupByName(businessName, hint = 'Bangkok') {
  if (!isConfigured()) {
    throw new Error('Google Maps API key not configured (set GOOGLE_MAPS_API_KEY)');
  }
  if (typeof businessName !== 'string' || !businessName.trim()) {
    throw new Error('businessName is required');
  }
  const query = hint ? `${businessName} ${hint}` : businessName;
  const res = await module.exports._fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
      // Field mask must be set — Places API NEW errors out otherwise.
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery: query, pageSize: 3 }),
  });
  if (!res.ok) {
    const body = await safeText(res);
    const err = new Error(`Places searchText ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const places = Array.isArray(json.places) ? json.places : [];
  if (places.length === 0) return null;
  const top = places[0];
  return {
    placeId: top.id,
    displayName: top.displayName?.text || '',
    formattedAddress: top.formattedAddress || '',
    suggestions: places.slice(0, 3).map((p) => ({
      placeId: p.id,
      displayName: p.displayName?.text || '',
      formattedAddress: p.formattedAddress || '',
    })),
  };
}

/**
 * Fetch up to 5 most recent reviews for a place.
 *
 * Returns reviews in the same shape as `GoogleProvider._mapReview` produces,
 * so downstream code (sync, dedup, AI drafting) can treat them identically.
 * The `external_id` is a stable hash so re-fetches don't insert duplicates.
 *
 * @param {string} placeId
 * @returns {Promise<Array<{ external_id, reviewer_name, rating, review_text, created_at }>>}
 */
async function fetchReviews(placeId) {
  if (!isConfigured()) {
    throw new Error('Google Maps API key not configured (set GOOGLE_MAPS_API_KEY)');
  }
  if (typeof placeId !== 'string' || !placeId.trim()) {
    throw new Error('placeId is required');
  }
  const url = `${PLACE_URL}/${encodeURIComponent(placeId)}`;
  const res = await module.exports._fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': REVIEW_FIELDS,
    },
  });
  if (!res.ok) {
    const body = await safeText(res);
    const err = new Error(`Places details ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const raw = Array.isArray(json.reviews) ? json.reviews : [];
  return raw.map(mapReview);
}

/**
 * Translate a Places API review object into the canonical internal shape.
 *
 * Places returns reviews like:
 *   {
 *     name: "places/X/reviews/abc...",
 *     rating: 5,
 *     text: { text: "...", languageCode: "th" },
 *     publishTime: "2025-01-04T10:23:11Z",
 *     authorAttribution: { displayName: "Name", uri, photoUri }
 *   }
 *
 * We synthesize an `external_id` ourselves (hash of author + publishTime +
 * first 50 chars of text) because Places' `name` field is opaque AND because
 * the same review fetched on different days can come back under a different
 * `name` (it's a per-request synthetic ID, not a stable review ID — Places
 * docs are explicit about this). Hashing the *content* gives us a stable
 * dedup key across pollings.
 */
function mapReview(r) {
  const author = r.authorAttribution?.displayName || 'Anonymous';
  const publishTime = r.publishTime || '';
  const text = (r.text?.text || r.originalText?.text || '').trim();
  return {
    external_id: dedupHash(author, publishTime, text),
    reviewer_name: author,
    rating: typeof r.rating === 'number' ? r.rating : 3,
    review_text: text,
    created_at: publishTime || new Date().toISOString(),
  };
}

/**
 * Dedup hash for a Places review. Stable across re-fetches.
 *
 * Three components:
 *   1. author display name — anchors the review to the writer
 *   2. publishTime — anchors to the moment
 *   3. first 50 chars of text — disambiguates two reviews from the same
 *      author at almost-the-same-time (rare but possible)
 *
 * SHA-256 truncated to 16 hex chars (64 bits) — collision probability at
 * 5 reviews × 10k businesses = 50k entries is ~6.8e-11. More than enough.
 */
function dedupHash(author, publishTime, text) {
  const key = [author, publishTime, (text || '').slice(0, 50)].join('|');
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

/**
 * Resolve a Google share/short link or Maps URL into a Place ID.
 *
 * Why this exists: users routinely paste links like
 *   https://share.google/hMJZnDaUsyRTW6MPz       (new share-link format)
 *   https://maps.app.goo.gl/<short>              (mobile-share format)
 *   https://www.google.com/maps/place/<slug>/... (desktop maps URL)
 * into the Place ID field. None of these are a ChIJ-prefixed Place ID;
 * resolving requires (a) following the HTTP redirect for short links,
 * then (b) extracting the place-name slug from the final URL path, then
 * (c) using Places Text Search to convert the slug to a real Place ID.
 *
 * Returns the same shape as lookupByName so callers can use either path
 * interchangeably. Returns null when nothing useful can be extracted.
 *
 * SSRF guards:
 *  - Only fetch URLs whose hostname is in ALLOWED_HOSTS
 *  - After redirect, the final URL must also be in ALLOWED_HOSTS
 *  - 4-second timeout, redirect chain cap of 3
 *
 * @param {string} rawUrl
 * @returns {Promise<null | { placeId, displayName, formattedAddress, suggestions }>}
 */
const ALLOWED_HOSTS = new Set([
  'share.google',
  'maps.app.goo.gl',
  'goo.gl',
  'www.google.com',
  'google.com',
  'maps.google.com',
]);

async function resolveShareUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;

  let parsed;
  try { parsed = new URL(rawUrl.trim()); } catch { return null; }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;

  // Step 1: if it's a short-link host, follow the redirect to get the full
  // Maps URL. Cap chain at 3 hops; abort fetches taking >4s.
  let finalUrl = parsed.toString();
  const isShortLink = ['share.google', 'maps.app.goo.gl', 'goo.gl'].includes(parsed.hostname);
  if (isShortLink) {
    let next = finalUrl;
    for (let hop = 0; hop < 3; hop++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4000);
      let res;
      try {
        // `redirect: 'manual'` lets us inspect each Location header so we
        // can re-validate the hostname before following.
        res = await module.exports._fetch(next, { method: 'HEAD', redirect: 'manual', signal: ctl.signal });
      } catch (err) {
        clearTimeout(timer);
        return null; // network or timeout
      }
      clearTimeout(timer);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return null;
        let nextParsed;
        try { nextParsed = new URL(loc, next); } catch { return null; }
        if (!ALLOWED_HOSTS.has(nextParsed.hostname)) return null; // off-domain redirect — bail
        next = nextParsed.toString();
        finalUrl = next;
        // If we've landed on a non-short host, stop chasing.
        if (!['share.google', 'maps.app.goo.gl', 'goo.gl'].includes(nextParsed.hostname)) break;
      } else {
        // 200 or terminal error with no redirect — use the URL we have.
        break;
      }
    }
  }

  // Step 2: extract a ChIJ-prefix from the resolved URL if it's there
  // (some Google Maps URLs include it in a query param or the data segment).
  const chij = finalUrl.match(/ChIJ[A-Za-z0-9_-]{10,}/);
  if (chij) {
    return {
      placeId: chij[0],
      displayName: '',
      formattedAddress: '',
      suggestions: [{ placeId: chij[0], displayName: '', formattedAddress: '' }],
    };
  }

  // Step 3: pull the place-name slug from the path
  //   /maps/place/<slug>/...                 — full desktop URL
  //   /maps/place/<slug>/@lat,lng,17z/data=  — even more detailed
  // The slug is URL-encoded with + for spaces in the legacy form.
  let slug = null;
  const m = finalUrl.match(/\/maps\/place\/([^/?#]+)/i);
  if (m) {
    try { slug = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch { slug = m[1]; }
  }
  if (!slug || slug.length < 2) return null;

  // Step 4: call lookupByName with the slug. Same plumbing as the manual
  // search-by-name path, so failures behave the same way and the caller
  // can treat this as drop-in equivalent.
  return lookupByName(slug, '');
}

module.exports = {
  isConfigured,
  lookupByName,
  resolveShareUrl,
  fetchReviews,
  // exported for tests
  _fetch: (url, opts) => fetch(url, opts),
  _mapReview: mapReview,
  _dedupHash: dedupHash,
};
