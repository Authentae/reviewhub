// Wave 4 prep — for each of 8 qualifying prospects:
// 1. Search Google Places API for the prospect (text query)
// 2. Pick the top match
// 3. Fetch up to 10 most recent reviews via legacy Places Details API
// 4. Output JSON: { prospect: { placeId, name, address, totalRatings, reviews } }
//
// One-shot prep so the next step (POST to /api/audit-previews via authed
// Chrome) can use the canonical review data per prospect.
//
// Outputs to stdout (and writes to docs/wave-postmortems/wave-4-reviews.json).

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('GOOGLE_MAPS_API_KEY env var required'); process.exit(1); }

// Wave 4 qualifying prospects (per docs/wave-postmortems/wave-4-drafts.md;
// #6 Baan 2459, #11 Bangkok Voyage, #12 Baan Vajra DQ'd at <200 reviews;
// #10 IR-ON DQ'd at 88% reply rate).
const PROSPECTS = [
  { id: 1, name: 'Methavalai Residence Hotel Bangkok' },
  { id: 2, name: 'Lilit Bang Lamphu Hotel Bangkok' },
  { id: 3, name: 'The Raweekanlaya Bangkok Wellness' },
  { id: 4, name: 'Lamphu Tree House Bangkok' },
  { id: 5, name: 'Lamphu House Bangkok Khao San' },
  { id: 7, name: 'Nouvo City Hotel Bangkok' },
  { id: 8, name: 'Public House Hotel Sukhumvit Bangkok' },
  { id: 9, name: 'Volve Hotel Bangkok' },
];

async function searchPlace(query) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery: query, pageSize: 3 }),
  });
  if (!r.ok) throw new Error(`searchText ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.places || [])[0] || null;
}

async function fetchReviews(placeId) {
  // Legacy Places API — returns up to 5 reviews
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&key=${API_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.status !== 'OK') throw new Error(`Place Details ${j.status}: ${j.error_message || ''}`);
  return j.result;
}

(async () => {
  const out = {};
  for (const p of PROSPECTS) {
    process.stderr.write(`[${p.id}] ${p.name} ... `);
    try {
      const place = await searchPlace(p.name);
      if (!place) { process.stderr.write('NO MATCH\n'); continue; }
      const details = await fetchReviews(place.id);
      const reviews = (details.reviews || []).map(r => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.relative_time_description,
        timestamp: r.time,
      }));
      out[p.id] = {
        prospect_id: p.id,
        prospect_search_name: p.name,
        place_id: place.id,
        google_name: place.displayName?.text,
        address: place.formattedAddress,
        total_ratings: details.user_ratings_total,
        rating: details.rating,
        reviews_returned: reviews.length,
        reviews,
      };
      process.stderr.write(`OK (${reviews.length} reviews, ${details.user_ratings_total} total)\n`);
      // Be polite to the API
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      process.stderr.write(`FAIL: ${e.message}\n`);
      out[p.id] = { prospect_id: p.id, prospect_search_name: p.name, error: e.message };
    }
  }
  const outFile = path.join(__dirname, '../../docs/wave-postmortems/wave-4-reviews.json');
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  process.stderr.write(`\nWrote ${outFile}\n`);
  console.log(JSON.stringify(out, null, 2));
})();
