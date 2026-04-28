// Build a "go to this review on the source platform" URL given a review +
// the user's business. Most platforms don't expose a deep-link to a specific
// review unless we have the review's external ID, but a search URL with the
// business name is good enough — drops the user 1-2 clicks from the actual
// reply box, which beats opening Wongnai cold and searching from scratch.
//
// Returns null when we have nothing useful to link to (manual entries, etc.).

import { PLATFORM_LABELS } from './platforms';

function enc(s) {
  return encodeURIComponent(String(s || '').trim());
}

// Per-platform URL builder. Receives:
//   review:   { external_id, review_text, ... }  — current review row
//   business: { business_name, google_place_id, yelp_business_id,
//               facebook_page_id, ...metadata }  — owner of the review
//
// Returns: a URL string or null.
const builders = {
  // Google: deep-link to reviews if we have a Place ID; otherwise to Maps search.
  google: ({ business }) => {
    if (business?.google_place_id) {
      return `https://search.google.com/local/reviews?placeid=${enc(business.google_place_id)}`;
    }
    if (business?.business_name) {
      return `https://www.google.com/maps/search/${enc(business.business_name)}`;
    }
    return 'https://business.google.com/';
  },

  // Yelp: business detail page if we have the slug, else search.
  yelp: ({ business }) => {
    if (business?.yelp_business_id) {
      return `https://www.yelp.com/biz/${enc(business.yelp_business_id)}`;
    }
    return business?.business_name
      ? `https://www.yelp.com/search?find_desc=${enc(business.business_name)}`
      : 'https://biz.yelp.com/';
  },

  facebook: ({ business }) => {
    if (business?.facebook_page_id) {
      return `https://www.facebook.com/${enc(business.facebook_page_id)}/reviews`;
    }
    return 'https://business.facebook.com/';
  },

  tripadvisor: ({ business }) =>
    business?.business_name
      ? `https://www.tripadvisor.com/Search?q=${enc(business.business_name)}`
      : 'https://www.tripadvisor.com/',

  trustpilot: ({ business }) =>
    business?.business_name
      ? `https://www.trustpilot.com/search?query=${enc(business.business_name)}`
      : 'https://business.trustpilot.com/',

  wongnai: ({ business }) =>
    business?.business_name
      ? `https://www.wongnai.com/search?q=${enc(business.business_name)}`
      : 'https://www.wongnai.com/',

  tabelog: ({ business }) =>
    business?.business_name
      ? `https://tabelog.com/en/rstLst/?LstSearchKeywords=${enc(business.business_name)}`
      : 'https://tabelog.com/',

  retty: ({ business }) =>
    business?.business_name
      ? `https://retty.me/search/?keyword=${enc(business.business_name)}`
      : 'https://retty.me/',

  hotpepper: ({ business }) =>
    business?.business_name
      ? `https://www.hotpepper.jp/CSP/cs010001/?keyword=${enc(business.business_name)}`
      : 'https://www.hotpepper.jp/',

  gurunavi: ({ business }) =>
    business?.business_name
      ? `https://r.gnavi.co.jp/area/jp/rs/?fwp=${enc(business.business_name)}`
      : 'https://r.gnavi.co.jp/',

  naver: ({ business }) =>
    business?.business_name
      ? `https://map.naver.com/v5/search/${enc(business.business_name)}`
      : 'https://map.naver.com/',

  kakaomap: ({ business }) =>
    business?.business_name
      ? `https://map.kakao.com/?q=${enc(business.business_name)}`
      : 'https://map.kakao.com/',

  mangoplate: ({ business }) =>
    business?.business_name
      ? `https://www.mangoplate.com/search/${enc(business.business_name)}`
      : 'https://www.mangoplate.com/',

  dianping: ({ business }) =>
    business?.business_name
      ? `https://www.dianping.com/search/keyword/0/0_${enc(business.business_name)}`
      : 'https://www.dianping.com/',

  meituan: ({ business }) =>
    business?.business_name
      ? `https://www.meituan.com/s/${enc(business.business_name)}`
      : 'https://www.meituan.com/',

  xiaohongshu: ({ business }) =>
    business?.business_name
      ? `https://www.xiaohongshu.com/search_result?keyword=${enc(business.business_name)}`
      : 'https://www.xiaohongshu.com/',

  thefork: ({ business }) =>
    business?.business_name
      ? `https://www.thefork.com/search?cityName=&searchTerm=${enc(business.business_name)}`
      : 'https://www.thefork.com/',

  pagesjaunes: ({ business }) =>
    business?.business_name
      ? `https://www.pagesjaunes.fr/recherche/${enc(business.business_name)}`
      : 'https://www.pagesjaunes.fr/',

  avisverifies: ({ business }) =>
    business?.business_name
      ? `https://www.avis-verifies.com/avis-clients/?q=${enc(business.business_name)}`
      : 'https://www.avis-verifies.com/',

  holidaycheck: ({ business }) =>
    business?.business_name
      ? `https://www.holidaycheck.de/dh/suche/${enc(business.business_name)}`
      : 'https://www.holidaycheck.de/',

  ekomi: ({ business }) =>
    business?.business_name
      ? `https://www.ekomi.de/bewertungen-${enc(business.business_name)}.html`
      : 'https://www.ekomi.de/',

  kununu: ({ business }) =>
    business?.business_name
      ? `https://www.kununu.com/de/search/companies?q=${enc(business.business_name)}`
      : 'https://www.kununu.com/',

  reclameaqui: ({ business }) =>
    business?.business_name
      ? `https://www.reclameaqui.com.br/empresa/${enc(business.business_name)}/`
      : 'https://www.reclameaqui.com.br/',

  paginegialle: ({ business }) =>
    business?.business_name
      ? `https://www.paginegialle.it/ricerca/${enc(business.business_name)}`
      : 'https://www.paginegialle.it/',

  mercadolibre: ({ business }) =>
    business?.business_name
      ? `https://listado.mercadolibre.com.ar/${enc(business.business_name)}`
      : 'https://www.mercadolibre.com/',

  // Hospitality
  booking: ({ business }) =>
    business?.business_name
      ? `https://www.booking.com/searchresults.html?ss=${enc(business.business_name)}`
      : 'https://admin.booking.com/',
  agoda: ({ business }) =>
    business?.business_name
      ? `https://www.agoda.com/search?query=${enc(business.business_name)}`
      : 'https://ycs.agoda.com/',
  traveloka: ({ business }) =>
    business?.business_name
      ? `https://www.traveloka.com/en-en/hotel/search?query=${enc(business.business_name)}`
      : 'https://tpp.traveloka.com/',
  airbnb: ({ business }) =>
    business?.business_name
      ? `https://www.airbnb.com/s/${enc(business.business_name)}/homes`
      : 'https://www.airbnb.com/hosting',
  expedia: ({ business }) =>
    business?.business_name
      ? `https://www.expedia.com/Hotel-Search?destination=${enc(business.business_name)}`
      : 'https://www.expediapartnercentral.com/',
  hotels: ({ business }) =>
    business?.business_name
      ? `https://www.hotels.com/search.do?q=${enc(business.business_name)}`
      : 'https://www.hotels.com/',
  klook: ({ business }) =>
    business?.business_name
      ? `https://www.klook.com/search/?keyword=${enc(business.business_name)}`
      : 'https://merchant.klook.com/',
  tripcom: ({ business }) =>
    business?.business_name
      ? `https://www.trip.com/hotels/list?searchKeyword=${enc(business.business_name)}`
      : 'https://www.trip.com/',
  hostelworld: ({ business }) =>
    business?.business_name
      ? `https://www.hostelworld.com/search?search_keywords=${enc(business.business_name)}`
      : 'https://www.hostelworld.com/',

  // E-commerce
  shopee: ({ business }) =>
    business?.business_name
      ? `https://shopee.com/search?keyword=${enc(business.business_name)}`
      : 'https://seller.shopee.com/',
  lazada: ({ business }) =>
    business?.business_name
      ? `https://www.lazada.com/catalog/?q=${enc(business.business_name)}`
      : 'https://sellercenter.lazada.com/',
  tokopedia: ({ business }) =>
    business?.business_name
      ? `https://www.tokopedia.com/search?st=product&q=${enc(business.business_name)}`
      : 'https://seller.tokopedia.com/',
  aliexpress: ({ business }) =>
    business?.business_name
      ? `https://www.aliexpress.com/wholesale?SearchText=${enc(business.business_name)}`
      : 'https://www.aliexpress.com/',
  amazon: ({ business }) =>
    business?.business_name
      ? `https://www.amazon.com/s?k=${enc(business.business_name)}`
      : 'https://sellercentral.amazon.com/',
  etsy: ({ business }) =>
    business?.business_name
      ? `https://www.etsy.com/search?q=${enc(business.business_name)}`
      : 'https://www.etsy.com/your/shops',

  // Food delivery
  grabfood: ({ business }) =>
    business?.business_name
      ? `https://food.grab.com/sg/en/restaurants?keyword=${enc(business.business_name)}`
      : 'https://food.grab.com/',
  foodpanda: ({ business }) =>
    business?.business_name
      ? `https://www.foodpanda.com/search?q=${enc(business.business_name)}`
      : 'https://www.foodpanda.com/',
  lineman: ({ business }) =>
    business?.business_name
      ? `https://lineman.line.me/search?q=${enc(business.business_name)}`
      : 'https://lineman.line.me/',
  robinhoodth: () => 'https://robinhood.in.th/',
  doordash: ({ business }) =>
    business?.business_name
      ? `https://www.doordash.com/search/store/${enc(business.business_name)}`
      : 'https://www.doordash.com/',
  ubereats: ({ business }) =>
    business?.business_name
      ? `https://www.ubereats.com/search?q=${enc(business.business_name)}`
      : 'https://www.ubereats.com/',
  deliveroo: ({ business }) =>
    business?.business_name
      ? `https://deliveroo.com/search?q=${enc(business.business_name)}`
      : 'https://deliveroo.com/',

  // B2B SaaS
  g2: ({ business }) =>
    business?.business_name
      ? `https://www.g2.com/search?query=${enc(business.business_name)}`
      : 'https://www.g2.com/',
  capterra: ({ business }) =>
    business?.business_name
      ? `https://www.capterra.com/search/?search=${enc(business.business_name)}`
      : 'https://www.capterra.com/',
  getapp: ({ business }) =>
    business?.business_name
      ? `https://www.getapp.com/search/?q=${enc(business.business_name)}`
      : 'https://www.getapp.com/',
  softwareadvice: ({ business }) =>
    business?.business_name
      ? `https://www.softwareadvice.com/search/?q=${enc(business.business_name)}`
      : 'https://www.softwareadvice.com/',

  // Healthcare
  zocdoc: ({ business }) =>
    business?.business_name
      ? `https://www.zocdoc.com/search?text=${enc(business.business_name)}`
      : 'https://www.zocdoc.com/',
  healthgrades: ({ business }) =>
    business?.business_name
      ? `https://www.healthgrades.com/search?q=${enc(business.business_name)}`
      : 'https://www.healthgrades.com/',
  ratemds: ({ business }) =>
    business?.business_name
      ? `https://www.ratemds.com/search?q=${enc(business.business_name)}`
      : 'https://www.ratemds.com/',

  // Home services
  houzz: ({ business }) =>
    business?.business_name
      ? `https://www.houzz.com/professionals/search/${enc(business.business_name)}`
      : 'https://www.houzz.com/',
  thumbtack: ({ business }) =>
    business?.business_name
      ? `https://www.thumbtack.com/search?q=${enc(business.business_name)}`
      : 'https://www.thumbtack.com/',
  angi: ({ business }) =>
    business?.business_name
      ? `https://www.angi.com/companylist/${enc(business.business_name)}`
      : 'https://www.angi.com/',

  // Beauty/wellness
  fresha: ({ business }) =>
    business?.business_name
      ? `https://www.fresha.com/search?q=${enc(business.business_name)}`
      : 'https://www.fresha.com/',
  booksy: ({ business }) =>
    business?.business_name
      ? `https://booksy.com/en-us/s/${enc(business.business_name)}`
      : 'https://booksy.com/',
  mindbody: ({ business }) =>
    business?.business_name
      ? `https://www.mindbodyonline.com/explore/search/${enc(business.business_name)}`
      : 'https://www.mindbodyonline.com/',
  vagaro: ({ business }) =>
    business?.business_name
      ? `https://www.vagaro.com/Search?q=${enc(business.business_name)}`
      : 'https://www.vagaro.com/',

  // Real estate
  zillow: ({ business }) =>
    business?.business_name
      ? `https://www.zillow.com/professionals/?searchterm=${enc(business.business_name)}`
      : 'https://www.zillow.com/',
  realtor: ({ business }) =>
    business?.business_name
      ? `https://www.realtor.com/realestateagents/search/${enc(business.business_name)}`
      : 'https://www.realtor.com/',

  // Auto
  cars: ({ business }) =>
    business?.business_name
      ? `https://www.cars.com/research/dealers/${enc(business.business_name)}`
      : 'https://www.cars.com/',
  autotrader: ({ business }) =>
    business?.business_name
      ? `https://www.autotrader.com/dealers/search?searchTerm=${enc(business.business_name)}`
      : 'https://www.autotrader.com/',
  dealerrater: ({ business }) =>
    business?.business_name
      ? `https://www.dealerrater.com/search/?searchTerm=${enc(business.business_name)}`
      : 'https://www.dealerrater.com/',
};

/**
 * Returns a URL the user can click to land on (or near) the original
 * review on the source platform. Best-effort:
 *   - If we have a platform-specific ID stored on the business, deep-link
 *   - Else if we know the platform, link to its search with the business name
 *   - Else null (caller hides the button)
 */
export function platformLink({ review, business }) {
  if (!review?.platform) return null;
  const builder = builders[review.platform];
  if (!builder) return null;
  try {
    return builder({ review, business });
  } catch {
    return null;
  }
}

/** Friendly button label, e.g. "Open on Wongnai →" */
export function platformLinkLabel(platform) {
  const name = PLATFORM_LABELS[platform] || platform;
  return `Open on ${name} →`;
}
