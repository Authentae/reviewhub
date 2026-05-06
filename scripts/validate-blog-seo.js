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

let errors = 0;
let posts = 0;

for (const file of fs.readdirSync(BLOG_DIR)) {
  if (!file.endsWith('.html')) continue;
  posts++;
  const fp = path.join(BLOG_DIR, file);
  const html = fs.readFileSync(fp, 'utf8');

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
