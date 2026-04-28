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

/**
 * Return the list of platform identifiers a user should see in dropdowns,
 * given their current i18n locale. Globals always come first; the user's
 * locale-specific platforms come next; then 'manual' as a final escape hatch.
 */
export function platformsForLocale(locale) {
  const local = LOCAL_BY_LOCALE[locale] || [];
  return [...GLOBAL_PLATFORMS, ...local, 'manual'];
}

/** Display label for any platform id. Falls back to a Title-cased id. */
export function platformLabel(id) {
  if (PLATFORM_LABELS[id]) return PLATFORM_LABELS[id];
  if (typeof id !== 'string' || !id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}
