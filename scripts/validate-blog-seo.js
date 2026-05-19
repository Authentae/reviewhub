#!/usr/bin/env node
// Validates blog-post SEO meta + structured data. Catches regressions
// like SVG og:images sneaking back in, missing twitter:card,
// missing BreadcrumbList, or stale "extension" references.
//
// Run: node scripts/validate-blog-seo.js
// Exits 0 if all blog posts pass; 1 (with detailed errors) if any fail.
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'client', 'public', 'blog');

const REQUIRED_META = [
  { regex: /<meta property="og:image" content="[^"]+\.png"/, msg: 'og:image must be PNG (not SVG)' },
  { regex: /<meta property="og:image:type" content="image\/png"/, msg: 'og:image:type missing' },
  { regex: /<meta property="og:image:width" content="1200"/, msg: 'og:image:width missing' },
  { regex: /<meta property="og:image:height" content="630"/, msg: 'og:image:height missing' },
  { regex: /<meta name="twitter:card" content="summary_large_image"/, msg: 'twitter:card missing' },
  { regex: /<meta name="twitter:image" content="[^"]+\.png"/, msg: 'twitter:image missing or not PNG' },
  { regex: /<link rel="canonical" href="https:\/\/reviewhub\.review\/blog\//, msg: 'canonical URL missing or wrong' },
  // Cycles 43+44 standardised blog posts on /og-image-blog.png (distinct
  // from the homepage /og-image.png and the audit /og-image-audit.png).
  // Enforce that here so future posts (and future drift back) get caught
  // at commit time.
  { regex: /<meta property="og:image" content="https:\/\/reviewhub\.review\/og-image-blog\.png"/, msg: 'og:image must be /og-image-blog.png (cycle 43+44 standard)' },
  { regex: /<meta name="twitter:image" content="https:\/\/reviewhub\.review\/og-image-blog\.png"/, msg: 'twitter:image must be /og-image-blog.png (cycle 43+44 standard)' },
];

const REQUIRED_SCHEMA = [
  { regex: /"@type": "Article"/, msg: 'Article schema missing' },
  { regex: /"@type": "BreadcrumbList"/, msg: 'BreadcrumbList schema missing' },
  { regex: /"datePublished": "20\d{2}-\d{2}-\d{2}"/, msg: 'datePublished missing' },
];

const FORBIDDEN = [
  { regex: /Chrome extension|Chrome Web Store/i, msg: 'Stale Chrome extension reference (extension was dropped)' },
  { regex: /og-image\.svg/, msg: 'og-image.svg referenced (should be .png)' },
];

// First pass: build EN/TH pair map so we can require hreflang on
// paired posts (and skip the requirement on single-language posts).
const slugBase = (slug) => slug.replace(/-th$/, '');
const pairs = {};
for (const file of fs.readdirSync(BLOG_DIR)) {
  if (!file.endsWith('.html')) continue;
  const slug = file.replace(/\.html$/, '');
  const html = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  const isThai = /<html lang="th"/.test(html);
  const base = slugBase(slug);
  pairs[base] = pairs[base] || {};
  if (isThai) pairs[base].th = slug;
  else pairs[base].en = slug;
}
const isPaired = (slug) => {
  const p = pairs[slugBase(slug)];
  return p && p.en && p.th;
};

let errors = 0;
let posts = 0;

for (const file of fs.readdirSync(BLOG_DIR)) {
  if (!file.endsWith('.html')) continue;
  posts++;
  const fp = path.join(BLOG_DIR, file);
  const html = fs.readFileSync(fp, 'utf8');
  const slug = file.replace(/\.html$/, '');

  const fileErrors = [];

  for (const { regex, msg } of REQUIRED_META) {
    if (!regex.test(html)) fileErrors.push(`META  ${msg}`);
  }
  for (const { regex, msg } of REQUIRED_SCHEMA) {
    if (!regex.test(html)) fileErrors.push(`SCHEMA  ${msg}`);
  }
  for (const { regex, msg } of FORBIDDEN) {
    if (regex.test(html)) fileErrors.push(`FORBIDDEN  ${msg}`);
  }
  // Paired posts MUST have hreflang link tags
  if (isPaired(slug)) {
    if (!/hreflang="en"/.test(html)) fileErrors.push('HREFLANG  hreflang="en" missing (paired post)');
    if (!/hreflang="th"/.test(html)) fileErrors.push('HREFLANG  hreflang="th" missing (paired post)');
    if (!/hreflang="x-default"/.test(html)) fileErrors.push('HREFLANG  hreflang="x-default" missing (paired post)');
  }

  if (fileErrors.length > 0) {
    errors += fileErrors.length;
    console.error(`\n❌ ${file}`);
    fileErrors.forEach(e => console.error(`   ${e}`));
  } else {
    console.log(`✓ ${file}`);
  }
}

console.log(`\n${posts} blog post(s) checked.`);
if (errors > 0) {
  console.error(`${errors} error(s) found.`);
  process.exit(1);
} else {
  console.log('All checks passed.');
  process.exit(0);
}
