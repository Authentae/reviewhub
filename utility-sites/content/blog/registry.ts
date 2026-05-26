export interface BlogParagraph {
  type: 'p';
  text: string;
}
export interface BlogHeading {
  type: 'h2' | 'h3';
  text: string;
}
export interface BlogList {
  type: 'ul' | 'ol';
  items: string[];
}
export interface BlogQuote {
  type: 'quote';
  text: string;
  cite?: string;
}
export interface BlogCallout {
  type: 'callout';
  text: string;
}
export type BlogBlock = BlogParagraph | BlogHeading | BlogList | BlogQuote | BlogCallout;

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // ISO YYYY-MM-DD
  dateModified: string;
  authorName: string;
  reviewerName?: string;
  blocks: BlogBlock[];
  /** Suggested affiliate offer to render below content. */
  affiliateOfferIds?: string[];
}

import { whyRsuTooHigh } from './posts/why-rsu-tax-bill-too-high';
import { supplementalRule } from './posts/22-vs-37-supplemental-withholding';
import { estimatedTax } from './posts/estimated-tax-after-rsu-vest';
import { extraW4 } from './posts/extra-w4-withholding-rsu';
import { byState } from './posts/rsu-taxes-by-state';
import { yearEndChecklist } from './posts/year-end-equity-comp-checklist';

export const blogPosts: BlogPost[] = [
  whyRsuTooHigh,
  supplementalRule,
  estimatedTax,
  extraW4,
  byState,
  yearEndChecklist,
];

export function findPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
