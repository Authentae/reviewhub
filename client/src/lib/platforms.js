// Client-side mirror of server/src/lib/platforms.js. Kept in sync manually —
// the platform list changes rarely, and avoiding a /api roundtrip keeps the
// review entry form snappy.
//
// Client uses this for:
//   - the platform <select> in the review entry form (filtered by locale)
//   - the platform <select> on the auto-rules and outreach pages
//   - display labels in the dashboard / reply tool / analytics

export const GLOBAL_PLATFORMS = [
  'google',
  'yelp',
  'facebook',
  'tripadvisor',
  'trustpilot',
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
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
  tripadvisor: 'TripAdvisor',
  trustpilot: 'Trustpilot',
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

// Flat list of every locale-specific platform (deduped), used to build
// the "rest of the world" tail of the dropdown so a user always sees the
// full registry — they just see their own locale's platforms first.
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
 * Order: globals first (Google/Yelp/Facebook/TripAdvisor/Trustpilot), then
 * the user's locale-specific platforms, then every other locale's platforms,
 * finally 'manual' as the escape hatch. A Thai SMB sees Wongnai near the
 * top; an English SMB sees the 5 globals + the long tail of every locale
 * platform we support — no platform is ever hidden by the locale picker.
 */
export function platformsForLocale(locale) {
  const localFirst = LOCAL_BY_LOCALE[locale] || [];
  const rest = ALL_LOCAL_PLATFORMS.filter((p) => !localFirst.includes(p));
  return [...GLOBAL_PLATFORMS, ...localFirst, ...rest, 'manual'];
}

/** Display label for any platform id. Falls back to a Title-cased id. */
export function platformLabel(id) {
  if (PLATFORM_LABELS[id]) return PLATFORM_LABELS[id];
  if (typeof id !== 'string' || !id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}
