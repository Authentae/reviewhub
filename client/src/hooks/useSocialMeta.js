import { useEffect } from 'react';

// Override the page's Open Graph + Twitter Card meta tags while the
// component is mounted, then restore the originals on unmount.
//
// Why this exists: index.html has site-wide defaults (good for the
// landing page and most crawls) but per-page surfaces — particularly
// /audit-preview/<token> — want their own preview card. When a
// founder pastes the audit URL into iMessage/Slack/LINE, the link
// preview should say "AI reply drafts for {business_name}" instead
// of the generic ReviewHub landing-page card.
//
// Crawlers that matter:
//   - Slackbot LinkExpanding v2 (executes JS since 2023)
//   - Twitter Card crawler (executes JS)
//   - facebookexternalhit (limited JS, but reads the static index.html
//     fallback so the default site card still renders)
//   - iMessage (no JS, gets index.html defaults)
//
// We replace `content` rather than removing/adding so iMessage etc.
// that read the static HTML get a sensible default and JS-capable
// crawlers see the override.
//
// Usage:
//   useSocialMeta({
//     title: `Reply drafts for ${businessName}`,
//     description: `${N} AI-drafted Google review replies — free to copy.`,
//   });

const TARGETS = [
  { selector: 'meta[property="og:title"]',       attr: 'content', from: 'title' },
  { selector: 'meta[property="og:description"]', attr: 'content', from: 'description' },
  { selector: 'meta[property="og:image"]',       attr: 'content', from: 'image' },
  { selector: 'meta[name="twitter:title"]',      attr: 'content', from: 'title' },
  { selector: 'meta[name="twitter:description"]', attr: 'content', from: 'description' },
  { selector: 'meta[name="twitter:image"]',      attr: 'content', from: 'image' },
  { selector: 'meta[name="description"]',         attr: 'content', from: 'description' },
];

export default function useSocialMeta({ title, description, image } = {}) {
  useEffect(() => {
    if (!title && !description && !image) return undefined;
    const restorations = [];

    for (const t of TARGETS) {
      const node = document.head.querySelector(t.selector);
      if (!node) continue;
      const newValue = t.from === 'title' ? title
        : t.from === 'description' ? description
        : image;
      if (newValue == null) continue;
      restorations.push({ node, attr: t.attr, original: node.getAttribute(t.attr) });
      node.setAttribute(t.attr, newValue);
    }

    return () => {
      for (const r of restorations) {
        if (r.original == null) {
          r.node.removeAttribute(r.attr);
        } else {
          r.node.setAttribute(r.attr, r.original);
        }
      }
    };
  }, [title, description, image]);
}
