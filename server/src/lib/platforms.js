// Single source of truth for review platform identifiers.
//
// Platforms split into four buckets:
//
//   GLOBAL    — multi-region, multi-industry (Google, Yelp, Facebook, TripAdvisor, Trustpilot)
//   INDUSTRY  — multi-region but vertical-specific (hotels, e-commerce, food delivery,
//               B2B SaaS, healthcare, home services, beauty)
//   LOCAL     — single-locale platforms (Wongnai for TH, Tabelog for JA, etc.)
//   INTERNAL  — non-user-facing markers (mock for tests, manual for human-typed entries)
//
// PLATFORM_META carries display name, locale, and industry. Locale strings match
// the i18n locale codes used by the client (i18n/translations.js). Industry
// is used to surface relevant platforms on the dropdown when the user has set
// their business type (hotel owner sees Booking/Agoda first; salon sees Fresha).

const GLOBAL = [
  // Multi-region, multi-industry — listed first across every locale + industry.
  'google',
  'yelp',
  'facebook',
  'tripadvisor',
  'trustpilot',
];

// Vertical-specific platforms that span regions. Hotel-bookers, food-delivery
// platforms, B2B SaaS-review sites, etc. Most have closed APIs (partner-only,
// hotel-side) so review intake works via email forwarding + CSV import; reply
// posting works via copy/paste or extension auto-fill.
const INDUSTRY = [
  // Hospitality / travel — huge in Asia
  'booking',         // Booking.com — global hotel
  'agoda',           // Booking-owned, dominant in SEA
  'traveloka',       // Indonesia-based, huge across SEA
  'airbnb',          // host-side reviews
  'expedia',         // global hotel + flight
  'hotels',          // Hotels.com (Expedia Group)
  'klook',           // Asia-Pacific tours / activities
  'tripcom',         // Trip.com / Ctrip — biggest Chinese OTA
  'hostelworld',     // budget travel reviews

  // Asian e-commerce — massive review surface
  'shopee',          // dominant in SEA
  'lazada',          // Alibaba's SEA arm
  'tokopedia',       // Indonesia
  'aliexpress',      // global reach
  'amazon',          // already in extension; canonical here
  'etsy',            // already in extension

  // Food delivery — review-relevant for restaurants
  'grabfood',        // GrabFood — biggest in SEA
  'foodpanda',       // SEA + Asia
  'lineman',         // Thailand (LINE MAN Wongnai)
  'robinhoodth',     // Thailand-only delivery (no commission)
  'doordash',        // US/CA
  'ubereats',        // global
  'deliveroo',       // UK + EU + APAC

  // B2B SaaS reviews
  'g2',              // G2 — biggest B2B software reviews
  'capterra',        // Gartner-owned, sister to GetApp
  'getapp',          // Gartner-owned
  'softwareadvice',  // Gartner-owned

  // Healthcare (US)
  'zocdoc',
  'healthgrades',
  'ratemds',

  // Home / professional services
  'houzz',           // home design + contractors
  'thumbtack',       // services marketplace
  'angi',            // formerly Angie's List

  // Beauty / wellness — common SMB segment
  'fresha',          // beauty/wellness booking
  'booksy',          // beauty/wellness booking
  'mindbody',        // fitness/yoga/spa booking
  'vagaro',          // beauty/fitness

  // Real estate
  'zillow',
  'realtor',         // realtor.com

  // Auto
  'cars',            // cars.com
  'autotrader',
  'dealerrater',
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

const VALID_PLATFORMS = [...GLOBAL, ...INDUSTRY, ...LOCAL, ...INTERNAL];

// Display, locale, and industry metadata.
//   locale:    i18n locale code, '*' for everywhere, '_internal' for hidden
//   industry:  optional vertical tag — 'hospitality' | 'ecommerce' |
//              'food_delivery' | 'saas' | 'healthcare' | 'home_services' |
//              'beauty' | 'real_estate' | 'auto' | null (general)
const PLATFORM_META = {
  // Global, all-industry
  google:        { label: 'Google',              locale: '*',         industry: null },
  yelp:          { label: 'Yelp',                locale: '*',         industry: null },
  facebook:      { label: 'Facebook',            locale: '*',         industry: null },
  tripadvisor:   { label: 'TripAdvisor',         locale: '*',         industry: 'hospitality' },
  trustpilot:    { label: 'Trustpilot',          locale: '*',         industry: null },

  // Hospitality
  booking:       { label: 'Booking.com',         locale: '*',         industry: 'hospitality' },
  agoda:         { label: 'Agoda',               locale: '*',         industry: 'hospitality' },
  traveloka:     { label: 'Traveloka',           locale: '*',         industry: 'hospitality' },
  airbnb:        { label: 'Airbnb',              locale: '*',         industry: 'hospitality' },
  expedia:       { label: 'Expedia',             locale: '*',         industry: 'hospitality' },
  hotels:        { label: 'Hotels.com',          locale: '*',         industry: 'hospitality' },
  klook:         { label: 'Klook',               locale: '*',         industry: 'hospitality' },
  tripcom:       { label: 'Trip.com',            locale: '*',         industry: 'hospitality' },
  hostelworld:   { label: 'Hostelworld',         locale: '*',         industry: 'hospitality' },

  // E-commerce
  shopee:        { label: 'Shopee',              locale: '*',         industry: 'ecommerce' },
  lazada:        { label: 'Lazada',              locale: '*',         industry: 'ecommerce' },
  tokopedia:     { label: 'Tokopedia',           locale: '*',         industry: 'ecommerce' },
  aliexpress:    { label: 'AliExpress',          locale: '*',         industry: 'ecommerce' },
  amazon:        { label: 'Amazon',              locale: '*',         industry: 'ecommerce' },
  etsy:          { label: 'Etsy',                locale: '*',         industry: 'ecommerce' },

  // Food delivery
  grabfood:      { label: 'GrabFood',            locale: '*',         industry: 'food_delivery' },
  foodpanda:     { label: 'foodpanda',           locale: '*',         industry: 'food_delivery' },
  lineman:       { label: 'LINE MAN',            locale: 'th',        industry: 'food_delivery' },
  robinhoodth:   { label: 'Robinhood (TH)',      locale: 'th',        industry: 'food_delivery' },
  doordash:      { label: 'DoorDash',            locale: '*',         industry: 'food_delivery' },
  ubereats:      { label: 'Uber Eats',           locale: '*',         industry: 'food_delivery' },
  deliveroo:     { label: 'Deliveroo',           locale: '*',         industry: 'food_delivery' },

  // B2B SaaS reviews
  g2:            { label: 'G2',                  locale: '*',         industry: 'saas' },
  capterra:      { label: 'Capterra',            locale: '*',         industry: 'saas' },
  getapp:        { label: 'GetApp',              locale: '*',         industry: 'saas' },
  softwareadvice:{ label: 'Software Advice',     locale: '*',         industry: 'saas' },

  // Healthcare
  zocdoc:        { label: 'Zocdoc',              locale: '*',         industry: 'healthcare' },
  healthgrades:  { label: 'Healthgrades',        locale: '*',         industry: 'healthcare' },
  ratemds:       { label: 'RateMDs',             locale: '*',         industry: 'healthcare' },

  // Home services
  houzz:         { label: 'Houzz',               locale: '*',         industry: 'home_services' },
  thumbtack:     { label: 'Thumbtack',           locale: '*',         industry: 'home_services' },
  angi:          { label: 'Angi',                locale: '*',         industry: 'home_services' },

  // Beauty / wellness
  fresha:        { label: 'Fresha',              locale: '*',         industry: 'beauty' },
  booksy:        { label: 'Booksy',              locale: '*',         industry: 'beauty' },
  mindbody:      { label: 'Mindbody',            locale: '*',         industry: 'beauty' },
  vagaro:        { label: 'Vagaro',              locale: '*',         industry: 'beauty' },

  // Real estate
  zillow:        { label: 'Zillow',              locale: '*',         industry: 'real_estate' },
  realtor:       { label: 'Realtor.com',         locale: '*',         industry: 'real_estate' },

  // Auto
  cars:          { label: 'Cars.com',            locale: '*',         industry: 'auto' },
  autotrader:    { label: 'AutoTrader',          locale: '*',         industry: 'auto' },
  dealerrater:   { label: 'DealerRater',         locale: '*',         industry: 'auto' },

  // Local — original locale-specific platforms
  wongnai:       { label: 'Wongnai',             locale: 'th',        industry: null },
  tabelog:       { label: 'Tabelog (食べログ)',  locale: 'ja',        industry: null },
  retty:         { label: 'Retty',               locale: 'ja',        industry: null },
  hotpepper:     { label: 'Hot Pepper',          locale: 'ja',        industry: null },
  gurunavi:      { label: 'Gurunavi (ぐるなび)', locale: 'ja',        industry: null },
  naver:         { label: 'Naver Place',         locale: 'ko',        industry: null },
  kakaomap:      { label: 'Kakao Map',           locale: 'ko',        industry: null },
  mangoplate:    { label: 'MangoPlate',          locale: 'ko',        industry: null },
  dianping:      { label: 'Dianping (大众点评)', locale: 'zh',        industry: null },
  meituan:       { label: 'Meituan (美团)',      locale: 'zh',        industry: null },
  xiaohongshu:   { label: 'Xiaohongshu (小红书)', locale: 'zh',       industry: null },
  thefork:       { label: 'TheFork',             locale: 'fr',        industry: null },
  mercadolibre:  { label: 'Mercado Libre',       locale: 'es',        industry: 'ecommerce' },
  pagesjaunes:   { label: 'Pages Jaunes',        locale: 'fr',        industry: null },
  avisverifies:  { label: 'Avis Vérifiés',       locale: 'fr',        industry: null },
  holidaycheck:  { label: 'HolidayCheck',        locale: 'de',        industry: 'hospitality' },
  ekomi:         { label: 'eKomi',               locale: 'de',        industry: null },
  kununu:        { label: 'kununu',              locale: 'de',        industry: null },
  reclameaqui:   { label: 'Reclame Aqui',        locale: 'pt',        industry: null },
  paginegialle:  { label: 'Pagine Gialle',       locale: 'it',        industry: null },

  // Internal
  mock:          { label: 'Mock',                locale: '_internal', industry: null },
  manual:        { label: 'Manual entry',        locale: '*',         industry: null },
};

function isValidPlatform(p) {
  return typeof p === 'string' && VALID_PLATFORMS.includes(p);
}

// Return platforms tagged with the given industry, in registry order.
function platformsForIndustry(industry) {
  if (!industry) return [];
  return Object.keys(PLATFORM_META).filter(
    (id) => PLATFORM_META[id].industry === industry
  );
}

module.exports = {
  VALID_PLATFORMS,
  GLOBAL,
  INDUSTRY,
  LOCAL,
  INTERNAL,
  PLATFORM_META,
  isValidPlatform,
  platformsForIndustry,
};
