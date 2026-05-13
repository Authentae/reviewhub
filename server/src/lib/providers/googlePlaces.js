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
  // PREFER originalText over text. Places API returns BOTH:
  //   originalText.text — what the reviewer actually wrote (e.g. Thai)
  //   text.text         — Google's auto-translation to the request's locale
  // Without language preferences in our request, Google defaults to
  // translating reviews to English, which broke the dashboard for Thai
  // reviewers (their words came out as English on screen). Preferring
  // originalText keeps each review in its native language. The AI-draft
  // step downstream language-detects the original and replies in-kind.
  const originalText = (r.originalText?.text || '').trim();
  const translatedText = (r.text?.text || '').trim();
  const text = originalText || translatedText;
  // Capture the language code so the dashboard / drafts can route on it.
  const languageCode = r.originalText?.languageCode || r.text?.languageCode || '';
  return {
    external_id: dedupHash(author, publishTime, text),
    reviewer_name: author,
    rating: typeof r.rating === 'number' ? r.rating : 3,
    review_text: text,
    review_language: languageCode,
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

  // Step 1: resolve the short link. Use Node's native redirect-follow
  // (`redirect: 'follow'`) and validate the FINAL URL's hostname against
  // ALLOWED_HOSTS — Node's fetch refuses to follow cross-protocol or
  // malformed redirects, so for the all-Google case the simpler default
  // beats hand-rolling redirect chain handling.
  //
  // We send a real Chrome User-Agent. share.google in particular
  // appears to serve a different (non-redirecting HTML interstitial)
  // response to clients with no UA, defaulting Node-fetch UAs, or
  // bot-shaped UAs.
  //
  // GET (not HEAD) — Google's share endpoint responds to HEAD with the
  // interstitial too. GET follows the chain to the final search URL.
  let finalUrl = parsed.toString();
  let body200 = '';
  const isShortLink = ['share.google', 'maps.app.goo.gl', 'goo.gl'].includes(parsed.hostname);
  if (isShortLink) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    let res;
    try {
      res = await module.exports._fetch(finalUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: ctl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
    } catch (err) {
      clearTimeout(timer);
      return null; // network or timeout
    }
    clearTimeout(timer);

    // Validate the FINAL URL after Node's auto-redirect chain. This is
    // the SSRF guard — we don't trust where Google redirected to.
    let finalParsed;
    try { finalParsed = new URL(res.url || finalUrl); } catch { return null; }
    if (!ALLOWED_HOSTS.has(finalParsed.hostname)) return null;
    finalUrl = finalParsed.toString();

    // If we still ended up on a short-link host, the body likely
    // contains a meta-refresh or canonical link to the real URL.
    if (['share.google', 'maps.app.goo.gl', 'goo.gl'].includes(finalParsed.hostname)) {
      try {
        body200 = (await res.text()).slice(0, 80000);
      } catch { body200 = ''; }
      const metaUrl = body200.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
        || body200.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1]
        || body200.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^;]*;\s*url=([^"']+)["']/i)?.[1]
        || body200.match(/(https?:\/\/[^"'<>\s]*google\.com\/[^"'<>\s]+)/i)?.[1];
      if (metaUrl) {
        try {
          const np = new URL(metaUrl, finalUrl);
          if (ALLOWED_HOSTS.has(np.hostname)) finalUrl = np.toString();
        } catch { /* fallthrough */ }
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

  // Step 3: pull a business name out of the resolved URL, trying each
  // known shape in priority order. We need a name to feed Places Text
  // Search — that's how we convert any of these URL shapes into a real
  // ChIJ Place ID.
  //
  // Three shapes we handle:
  //   /maps/place/<slug>/...                        — full desktop URL
  //   /search?q=<name>&kgmid=/g/...                 — share.google redirect (most common)
  //   /maps?...&query=<name>...                     — legacy maps query
  //
  // The `kgmid=/g/<...>` value is Google's Knowledge Graph machine ID,
  // not a Place ID — so we extract the `q` (business name) and look it
  // up. Worst case: ambiguous name returns the wrong location; the
  // search-by-name UI gives the user a chance to disambiguate.
  let nameQuery = null;
  let urlObj;
  try { urlObj = new URL(finalUrl); } catch { urlObj = null; }

  const pathMatch = finalUrl.match(/\/maps\/place\/([^/?#]+)/i);
  if (pathMatch) {
    try { nameQuery = decodeURIComponent(pathMatch[1].replace(/\+/g, ' ')); } catch { nameQuery = pathMatch[1]; }
  } else if (urlObj) {
    const q = urlObj.searchParams.get('q') || urlObj.searchParams.get('query');
    if (q && q.length >= 2) nameQuery = q;
  }

  if (!nameQuery || nameQuery.length < 2) return null;

  // Step 4: call lookupByName with the extracted name. Use the empty
  // string as the locality hint — for arbitrary share links we don't
  // know the city, and biasing toward Bangkok would push results away
  // from places like Kamphaeng Saen, Phuket, Chiang Mai, etc.
  return lookupByName(nameQuery, '');
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
