import type { Metadata } from 'next';
import { env } from './env';

const FALLBACK_SITE_URL = 'http://localhost:3000';
const PLACEHOLDER_PROD_URL = 'https://example.com';
export const SITE_NAME = 'Utility Tools';

let warnedMissingProd = false;

export function siteUrl(): string {
  const fromEnv = env.siteUrl();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (env.isProd()) {
    if (!warnedMissingProd && typeof window === 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(
        '[seo] NEXT_PUBLIC_SITE_URL is not set; using https://example.com placeholder. Set it in your deploy env before launch.',
      );
      warnedMissingProd = true;
    }
    return PLACEHOLDER_PROD_URL;
  }
  return FALLBACK_SITE_URL;
}

export function canonical(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl()}${p === '/' ? '' : p}`;
}

interface BuildMetadataInput {
  slug: string;
  title: string;
  description: string;
  ogImagePath?: string;
  noindex?: boolean;
}

export function buildMetadata({
  slug,
  title,
  description,
  ogImagePath = '/og-default.png',
  noindex,
}: BuildMetadataInput): Metadata {
  const url = canonical(slug);
  const image = `${siteUrl()}${ogImagePath}`;
  const robots = noindex || env.noindex() ? { index: false, follow: false } : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: SITE_NAME,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots,
  };
}

interface FaqItem {
  q: string;
  a: string;
}

interface HowToStep {
  name: string;
  text: string;
}

export function webApplicationSchema(opts: {
  name: string;
  description: string;
  url: string;
  category?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    applicationCategory: opts.category ?? 'FinanceApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

export function howToSchema(opts: { name: string; description: string; steps: HowToStep[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

export function faqSchema(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: canonical(it.path),
    })),
  };
}

export function articleSchema(opts: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  reviewerName?: string;
  imagePath?: string;
}) {
  const image = opts.imagePath ? `${siteUrl()}${opts.imagePath}` : `${siteUrl()}/og-default.png`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    author: { '@type': 'Person', name: opts.authorName },
    ...(opts.reviewerName
      ? { reviewedBy: { '@type': 'Person', name: opts.reviewerName } }
      : {}),
    image,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: siteUrl(),
    },
  };
}
