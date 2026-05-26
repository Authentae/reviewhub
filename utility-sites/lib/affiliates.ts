import { env } from './env';

export type AffiliateOfferId =
  | 'turbotax-premier'
  | 'taxact-premier'
  | 'harness-wealth'
  | 'carta'
  | 'empower';

export interface AffiliateOffer {
  id: AffiliateOfferId;
  brand: string;
  headline: string;
  body: string;
  cta: string;
  /** Returns the destination URL with partner ID + UTM. Empty string when partner ID is absent (dev). */
  href: () => string;
  /** Free-form context string (FTC disclosure rendered alongside). */
  badge?: string;
  /** Optional eligibility hint — used by the calculator to decide which to render. */
  showWhen?: { minShortfallUsd?: number };
}

function withUtm(base: string, utmContent: string): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}utm_source=utility-tools&utm_medium=affiliate&utm_campaign=rsu-shortfall&utm_content=${utmContent}`;
}

export const affiliates: Record<AffiliateOfferId, AffiliateOffer> = {
  'turbotax-premier': {
    id: 'turbotax-premier',
    brand: 'TurboTax Premier',
    headline: 'File your equity-comp taxes with TurboTax Premier',
    body:
      'Built for people with RSUs, ESPP, and capital gains. Imports W-2 and broker 1099-Bs automatically.',
    cta: 'Get TurboTax Premier',
    href: () => {
      const id = env.affiliate.turbotax();
      if (!id) return '#';
      return withUtm(`https://turbotax.intuit.com/?aff=${encodeURIComponent(id)}`, 'turbotax');
    },
    badge: 'Affiliate link — we may earn a commission',
    showWhen: { minShortfallUsd: 500 },
  },
  'taxact-premier': {
    id: 'taxact-premier',
    brand: 'TaxAct Premier',
    headline: 'Cheaper alternative for equity-comp filers',
    body:
      'Lower price than TurboTax with the same RSU / ESPP / capital-gains support. Good fit if your return is otherwise simple.',
    cta: 'See TaxAct Premier',
    href: () => {
      const id = env.affiliate.taxact();
      if (!id) return '#';
      return withUtm(`https://www.taxact.com/?aff=${encodeURIComponent(id)}`, 'taxact');
    },
    badge: 'Affiliate link — we may earn a commission',
    showWhen: { minShortfallUsd: 500 },
  },
  'harness-wealth': {
    id: 'harness-wealth',
    brand: 'Harness Wealth',
    headline: 'Talk to a CPA who specializes in equity comp',
    body:
      'For high earners with mixed RSU / ISO / NSO / ESPP situations. Vetted tax pros who know §83(b), §409A, and AMT.',
    cta: 'Match with a tax pro',
    href: () => {
      const id = env.affiliate.harness();
      if (!id) return '#';
      return withUtm(`https://www.harnesswealth.com/tax?ref=${encodeURIComponent(id)}`, 'harness');
    },
    badge: 'Affiliate link — we may earn a commission',
    showWhen: { minShortfallUsd: 5_000 },
  },
  carta: {
    id: 'carta',
    brand: 'Carta',
    headline: 'Track every vest, exercise, and tax event in one place',
    body:
      'Free for individuals. Models RSU/ISO/NSO grants, projects taxes on each vest, and exports for your CPA.',
    cta: 'Try Carta free',
    href: () => {
      const id = env.affiliate.carta();
      if (!id) return '#';
      return withUtm(`https://carta.com/individuals/?ref=${encodeURIComponent(id)}`, 'carta');
    },
    badge: 'Affiliate link — we may earn a commission',
  },
  empower: {
    id: 'empower',
    brand: 'Empower',
    headline: 'See your equity comp + cash + brokerage in one dashboard',
    body:
      'Free wealth-tracking dashboard popular with tech workers. Optional paid advisor consultation.',
    cta: 'Try Empower free',
    href: () => {
      const id = env.affiliate.empower();
      if (!id) return '#';
      return withUtm(`https://www.empower.com/?ref=${encodeURIComponent(id)}`, 'empower');
    },
    badge: 'Affiliate link — we may earn a commission',
  },
};

/** Returns the offers that should display given the calculator result. */
export function offersForShortfall(shortfallUsd: number): AffiliateOffer[] {
  return Object.values(affiliates).filter((o) => {
    const min = o.showWhen?.minShortfallUsd ?? 0;
    return shortfallUsd >= min;
  });
}
