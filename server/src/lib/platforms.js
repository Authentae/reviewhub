// Single source of truth for review platform identifiers.
//
// Historically each route file defined its own VALID_PLATFORMS list, and
// they drifted: reviews.js had wongnai but reviewRequests.js didn't,
// syncReviews.js had 'mock' but autoRules.js didn't, etc. That meant a
// review created with platform='wongnai' could be intercepted by an
// auto-rule but the outreach Settings UI couldn't list it. Consolidate
// here so adding a locale-specific platform is a one-file change.
//
// Platforms split into three buckets:
//
//   GLOBAL    — multi-region review platforms (Google, Yelp, etc.)
//   LOCAL     — single-locale platforms users may want to track manually
//               even though we can't auto-sync them (most have closed APIs
//               or partner-only access). Listing them lets a Wongnai or
//               Tabelog review be ingested via the public API or webhook
//               and routed through templates / outreach / responses.
//   INTERNAL  — non-user-facing markers (mock for tests, manual for
//               human-typed entries with no source platform).
//
// PLATFORM_META carries the locale and display name. The client uses these
// for the platform <select> in the review entry form so each market sees
// the platforms they actually use.

const GLOBAL = [
  // Multi-region, listed first so they're the default options across all locales.
  'google',
  'yelp',
  'facebook',
  'tripadvisor',
  'trustpilot',
];

const LOCAL = [
  // Thailand
  'wongnai',
  // Japan — Tabelog is the dominant restaurant review site; Retty is the
  // social-graph competitor; Hot Pepper is recruiter-owned; Gurunavi is
  // the legacy player still common in Tokyo office-district lunch trade.
  'tabelog',
  'retty',
  'hotpepper',
  'gurunavi',
  // Korea — Naver Place is the de facto Yelp; Kakao Map is the bundled
  // alternative most younger users check first.
  'naver',
  'kakaomap',
  'mangoplate',
  // Greater China — Dianping (大众点评) is the foundational restaurant
  // review platform; Meituan owns the food-delivery review surface;
  // Xiaohongshu (Little Red Book / RED) is the Instagram-meets-Yelp app
  // dominating Gen-Z tier-1 city reviews.
  'dianping',
  'meituan',
  'xiaohongshu',
  // Spain / LatAm
  'thefork',          // also FR/IT — TripAdvisor-owned restaurant booking
  'mercadolibre',     // marketplace ratings (PT/ES regional)
  // France
  'pagesjaunes',
  'avisverifies',
  // Germany / DACH
  'holidaycheck',     // tourism — hotels, resorts
  'ekomi',
  'kununu',           // employer reviews — adjacent to brand health
  // Brazil / Portugal
  'reclameaqui',      // *the* Brazilian complaint surface — answering here is reputation work
  // Italy
  'paginegialle',
];

const INTERNAL = [
  'mock',     // test fixtures + dev seeding
  'manual',   // human-entered review with no original source platform
];

const VALID_PLATFORMS = [...GLOBAL, ...LOCAL, ...INTERNAL];

// Display + locale metadata. Locale strings match the i18n locale codes used
// by the client (i18n/translations.js). Used by the platform <select> on the
// client to filter options to the user's current locale.
const PLATFORM_META = {
  google:        { label: 'Google',           locale: '*' },
  yelp:          { label: 'Yelp',             locale: '*' },
  facebook:      { label: 'Facebook',         locale: '*' },
  tripadvisor:   { label: 'TripAdvisor',      locale: '*' },
  trustpilot:    { label: 'Trustpilot',       locale: '*' },
  wongnai:       { label: 'Wongnai',          locale: 'th' },
  tabelog:       { label: 'Tabelog (食べログ)', locale: 'ja' },
  retty:         { label: 'Retty',            locale: 'ja' },
  hotpepper:     { label: 'Hot Pepper',       locale: 'ja' },
  gurunavi:      { label: 'Gurunavi (ぐるなび)', locale: 'ja' },
  naver:         { label: 'Naver Place',      locale: 'ko' },
  kakaomap:      { label: 'Kakao Map',        locale: 'ko' },
  mangoplate:    { label: 'MangoPlate',       locale: 'ko' },
  dianping:      { label: 'Dianping (大众点评)', locale: 'zh' },
  meituan:       { label: 'Meituan (美团)',    locale: 'zh' },
  xiaohongshu:   { label: 'Xiaohongshu (小红书)', locale: 'zh' },
  thefork:       { label: 'TheFork',          locale: 'fr' }, // also es/it but display once
  mercadolibre:  { label: 'Mercado Libre',    locale: 'es' },
  pagesjaunes:   { label: 'Pages Jaunes',     locale: 'fr' },
  avisverifies:  { label: 'Avis Vérifiés',    locale: 'fr' },
  holidaycheck:  { label: 'HolidayCheck',     locale: 'de' },
  ekomi:         { label: 'eKomi',            locale: 'de' },
  kununu:        { label: 'kununu',           locale: 'de' },
  reclameaqui:   { label: 'Reclame Aqui',     locale: 'pt' },
  paginegialle:  { label: 'Pagine Gialle',    locale: 'it' },
  mock:          { label: 'Mock',             locale: '_internal' },
  manual:        { label: 'Manual entry',     locale: '*' },
};

function isValidPlatform(p) {
  return typeof p === 'string' && VALID_PLATFORMS.includes(p);
}

module.exports = {
  VALID_PLATFORMS,
  GLOBAL,
  LOCAL,
  INTERNAL,
  PLATFORM_META,
  isValidPlatform,
};
