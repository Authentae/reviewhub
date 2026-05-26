function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  siteUrl: () => read('NEXT_PUBLIC_SITE_URL'),
  adsense: {
    clientId: () => read('NEXT_PUBLIC_ADSENSE_CLIENT_ID'),
    slotHeader: () => read('NEXT_PUBLIC_ADSENSE_SLOT_HEADER'),
    slotInContent: () => read('NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT'),
    slotSidebar: () => read('NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR'),
  },
  affiliate: {
    turbotax: () => read('NEXT_PUBLIC_AFFILIATE_TURBOTAX_ID'),
    taxact: () => read('NEXT_PUBLIC_AFFILIATE_TAXACT_ID'),
    harness: () => read('NEXT_PUBLIC_AFFILIATE_HARNESS_ID'),
    carta: () => read('NEXT_PUBLIC_AFFILIATE_CARTA_ID'),
    empower: () => read('NEXT_PUBLIC_AFFILIATE_EMPOWER_ID'),
  },
  ga4Id: () => read('NEXT_PUBLIC_GA4_ID'),
  plausibleDomain: () => read('NEXT_PUBLIC_PLAUSIBLE_DOMAIN'),
  gscVerification: () => read('NEXT_PUBLIC_GSC_VERIFICATION'),
  noindex: () => read('ROBOTS_NOINDEX') === '1',
  isProd: () => process.env.NODE_ENV === 'production',
};
