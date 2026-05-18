#!/usr/bin/env node
// Validates blog HTML files match the three indexes that should reference
// every post:
//   1. client/public/sitemap.xml          (Google crawl)
//   2. client/public/feed.xml             (RSS subscribers)
//   3. client/src/pages/BlogIndex.jsx     (the /blog index page)
//
// Why this script exists:
//   On 2026-05-19 cycle 12 of the overnight loop, feed.xml was found to be
//   stale by 5 posts (11 days of drift) — every new blog HTML had been added
//   to sitemap.xml + BlogIndex.jsx but feed.xml was the consistent miss.
//   This catches that class of drift at commit time instead of at "I noticed
//   it 11 days later."
//
// Run: node scripts/check-blog-sync.js
// Exits 0 if all three indexes contain every blog slug; 1 (with the diff)
// if any slug is missing from any index.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'client', 'public', 'blog');
const SITEMAP = path.join(ROOT, 'client', 'public', 'sitemap.xml');
const FEED = path.join(ROOT, 'client', 'public', 'feed.xml');
const BLOG_INDEX = path.join(ROOT, 'client', 'src', 'pages', 'BlogIndex.jsx');

function slugsFromBlogDir() {
  return fs.readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace(/\.html$/, ''))
    .sort();
}

function slugsFromXmlFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  // Match both <loc>.../blog/SLUG</loc> (sitemap) and <link>.../blog/SLUG</link> (feed)
  const re = /\/blog\/([a-z0-9-]+)(?=<\/(?:loc|link)>)/g;
  const slugs = new Set();
  let m;
  while ((m = re.exec(text)) !== null) slugs.add(m[1]);
  return [...slugs].sort();
}

function slugsFromBlogIndex() {
  const text = fs.readFileSync(BLOG_INDEX, 'utf8');
  const re = /slug:\s*['"]([a-z0-9-]+)['"]/g;
  const slugs = new Set();
  let m;
  while ((m = re.exec(text)) !== null) slugs.add(m[1]);
  return [...slugs].sort();
}

function diff(setA, setB) {
  const onlyA = setA.filter((x) => !setB.includes(x));
  const onlyB = setB.filter((x) => !setA.includes(x));
  return { onlyA, onlyB };
}

const blogSlugs = slugsFromBlogDir();
const sitemapSlugs = slugsFromXmlFile(SITEMAP);
const feedSlugs = slugsFromXmlFile(FEED);
const indexSlugs = slugsFromBlogIndex();

const errors = [];

const sitemapDiff = diff(blogSlugs, sitemapSlugs);
if (sitemapDiff.onlyA.length) {
  errors.push(`sitemap.xml is MISSING ${sitemapDiff.onlyA.length} blog slugs:\n  - ${sitemapDiff.onlyA.join('\n  - ')}`);
}
if (sitemapDiff.onlyB.length) {
  errors.push(`sitemap.xml has ${sitemapDiff.onlyB.length} EXTRA slugs not on disk:\n  - ${sitemapDiff.onlyB.join('\n  - ')}`);
}

const feedDiff = diff(blogSlugs, feedSlugs);
if (feedDiff.onlyA.length) {
  errors.push(`feed.xml is MISSING ${feedDiff.onlyA.length} blog slugs:\n  - ${feedDiff.onlyA.join('\n  - ')}`);
}
if (feedDiff.onlyB.length) {
  errors.push(`feed.xml has ${feedDiff.onlyB.length} EXTRA slugs not on disk:\n  - ${feedDiff.onlyB.join('\n  - ')}`);
}

const indexDiff = diff(blogSlugs, indexSlugs);
if (indexDiff.onlyA.length) {
  errors.push(`BlogIndex.jsx is MISSING ${indexDiff.onlyA.length} blog slugs:\n  - ${indexDiff.onlyA.join('\n  - ')}`);
}
if (indexDiff.onlyB.length) {
  errors.push(`BlogIndex.jsx has ${indexDiff.onlyB.length} EXTRA slugs not on disk:\n  - ${indexDiff.onlyB.join('\n  - ')}`);
}

if (errors.length === 0) {
  console.log(`✅ ${blogSlugs.length} blog posts in sync across sitemap.xml, feed.xml, BlogIndex.jsx`);
  process.exit(0);
} else {
  console.error('❌ Blog sync check failed:\n');
  for (const e of errors) console.error(e + '\n');
  console.error('Fix: add the missing entries (or delete the leftover HTML/index entries).');
  console.error('Bypass once if intentional: git commit --no-verify');
  process.exit(1);
}
