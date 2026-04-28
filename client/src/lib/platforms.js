// Client-side mirror of server/src/lib/platforms.js. Kept in sync manually —
// the platform list changes rarely, and avoiding a /api roundtrip keeps the
// review entry form snappy.

export const GLOBAL_PLATFORMS = [
  'google',
  'yelp',
  'facebook',
  'tripadvisor',
  'trustpilot',
];

// Multi-region, vertical-specific platforms. Hotel-bookers, food-delivery,
// B2B SaaS-review sites, etc. Mostly closed APIs; intake via email forwarding
// or CSV; reply via copy/paste or extension auto-fill.
export const INDUSTRY_PLATFORMS = [
  // Hospitality
  'booking', 'agoda', 'traveloka', 'airbnb', 'expedia', 'hotels',
  'klook', 'tripcom', 'hostelworld',
  // E-commerce
  'shopee', 'lazada', 'tokopedia', 'aliexpress', 'amazon', 'etsy',
  // Food delivery
  'grabfood', 'foodpanda', 'lineman', 'robinhoodth', 'doordash', 'ubereats', 'deliveroo',
  // B2B SaaS reviews
  'g2', 'capterra', 'getapp', 'softwareadvice',
  // Healthcare
  'zocdoc', 'healthgrades', 'ratemds',
  // Home services
  'houzz', 'thumbtack', 'angi',
  // Beauty / wellness
  'fresha', 'booksy', 'mindbody', 'vagaro',
  // Real estate
  'zillow', 'realtor',
  // Auto
  'cars', 'autotrader', 'dealerrater',
];

// locale → array of locale-specific platform identifiers
export const LOCAL_BY_LOCALE = {
  th: ['wongnai'],
  ja: ['tabelog', 'retty', 'hotpepper', 'gurunavi'],
  ko: ['naver', 'kakaomap', 'mangoplate'],
  zh: ['dianping', 'meituan', 'xiaohongshu'],
  es: ['mercadolibre', 'thefork'],
  fr: ['thefork', 'pagesjaunes', 'avisverifies'],
  de: ['holidaycheck', 'ekomi', 'kununu'],
  pt: ['reclameaqui'],
  it: ['thefork', 'paginegialle'],
};

// Display labels — shown verbatim in the UI.
export const PLATFORM_LABELS = {
  // Global
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
  tripadvisor: 'TripAdvisor',
  trustpilot: 'Trustpilot',

  // Hospitality
  booking: 'Booking.com',
  agoda: 'Agoda',
  traveloka: 'Traveloka',
  airbnb: 'Airbnb',
  expedia: 'Expedia',
  hotels: 'Hotels.com',
  klook: 'Klook',
  tripcom: 'Trip.com',
  hostelworld: 'Hostelworld',

  // E-commerce
  shopee: 'Shopee',
  lazada: 'Lazada',
  tokopedia: 'Tokopedia',
  aliexpress: 'AliExpress',
  amazon: 'Amazon',
  etsy: 'Etsy',

  // Food delivery
  grabfood: 'GrabFood',
  foodpanda: 'foodpanda',
  lineman: 'LINE MAN',
  robinhoodth: 'Robinhood (TH)',
  doordash: 'DoorDash',
  ubereats: 'Uber Eats',
  deliveroo: 'Deliveroo',

  // B2B SaaS
  g2: 'G2',
  capterra: 'Capterra',
  getapp: 'GetApp',
  softwareadvice: 'Software Advice',

  // Healthcare
  zocdoc: 'Zocdoc',
  healthgrades: 'Healthgrades',
  ratemds: 'RateMDs',

  // Home services
  houzz: 'Houzz',
  thumbtack: 'Thumbtack',
  angi: 'Angi',

  // Beauty / wellness
  fresha: 'Fresha',
  booksy: 'Booksy',
  mindbody: 'Mindbody',
  vagaro: 'Vagaro',

  // Real estate
  zillow: 'Zillow',
  realtor: 'Realtor.com',

  // Auto
  cars: 'Cars.com',
  autotrader: 'AutoTrader',
  dealerrater: 'DealerRater',

  // Locale-specific
  wongnai: 'Wongnai',
  tabelog: 'Tabelog (食べログ)',
  retty: 'Retty',
  hotpepper: 'Hot Pepper',
  gurunavi: 'Gurunavi (ぐるなび)',
  naver: 'Naver Place',
  kakaomap: 'Kakao Map',
  mangoplate: 'MangoPlate',
  dianping: 'Dianping (大众点评)',
  meituan: 'Meituan (美团)',
  xiaohongshu: 'Xiaohongshu (小红书)',
  thefork: 'TheFork',
  mercadolibre: 'Mercado Libre',
  pagesjaunes: 'Pages Jaunes',
  avisverifies: 'Avis Vérifiés',
  holidaycheck: 'HolidayCheck',
  ekomi: 'eKomi',
  kununu: 'kununu',
  reclameaqui: 'Reclame Aqui',
  paginegialle: 'Pagine Gialle',

  manual: 'Manual entry',
};

// Flat list of every locale-specific platform (deduped). Used to build the
// "rest of the world" tail of the dropdown.
const ALL_LOCAL_PLATFORMS = (() => {
  const seen = new Set();
  const out = [];
  for (const list of Object.values(LOCAL_BY_LOCALE)) {
    for (const p of list) {
      if (!seen.has(p)) { seen.add(p); out.push(p); }
    }
  }
  return out;
})();

/**
 * Return the list of platform identifiers a user should see in dropdowns.
 * Order: globals first, then user's locale platforms, then industry platforms,
 * then other locales' platforms, finally 'manual'. Total: ~60 entries; users
 * see their own locale's relevant platforms ranked first but no platform is
 * ever hidden.
 */
export function platformsForLocale(locale) {
  const localFirst = LOCAL_BY_LOCALE[locale] || [];
  const otherLocales = ALL_LOCAL_PLATFORMS.filter((p) => !localFirst.includes(p));
  return [
    ...GLOBAL_PLATFORMS,
    ...localFirst,
    ...INDUSTRY_PLATFORMS,
    ...otherLocales,
    'manual',
  ];
}

/** Display label for any platform id. Falls back to a Title-cased id. */
export function platformLabel(id) {
  if (PLATFORM_LABELS[id]) return PLATFORM_LABELS[id];
  if (typeof id !== 'string' || !id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}
