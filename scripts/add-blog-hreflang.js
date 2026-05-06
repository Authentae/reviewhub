#!/usr/bin/env node
// Adds hreflang link tags to blog posts that have an EN/TH pair.
// Tells Google that the two posts are language alternates so it
// shows the right one in the user's locale instead of competing
// with itself.
//
// Idempotent — skips files that already have hreflang.
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'client', 'public', 'blog');
const ROOT = 'https://reviewhub.review';

// Build a map of base-slug → { en?, th? }
const slugBase = (slug) => slug.replace(/-th$/, '');
const map = {};
for (const file of fs.readdirSync(BLOG_DIR)) {
  if (!file.endsWith('.html')) continue;
  const slug = file.replace(/\.html$/, '');
  const html = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  const isThai = /<html lang="th"/.test(html);
  const base = slugBase(slug);
  map[base] = map[base] || {};
  if (isThai) map[base].th = slug;
  else map[base].en = slug;
}

let added = 0;
let skipped = 0;
for (const [base, pair] of Object.entries(map)) {
  if (!pair.en || !pair.th) {
    skipped++;
    continue; // single-language post, no alternate to declare
  }
  for (const lang of ['en', 'th']) {
    const fp = path.join(BLOG_DIR, `${pair[lang]}.html`);
    let html = fs.readFileSync(fp, 'utf8');
    if (html.includes('hreflang="en"')) {
      continue;
    }
    const enUrl = `${ROOT}/blog/${pair.en}`;
    const thUrl = `${ROOT}/blog/${pair.th}`;
    const block = `\n<link rel="alternate" hreflang="en" href="${enUrl}" />\n<link rel="alternate" hreflang="th" href="${thUrl}" />\n<link rel="alternate" hreflang="x-default" href="${enUrl}" />`;
    // Insert after the canonical link
    const canonicalEnd = html.indexOf('>', html.indexOf('rel="canonical"'));
    if (canonicalEnd === -1) continue;
    html = html.slice(0, canonicalEnd + 1) + block + html.slice(canonicalEnd + 1);
    fs.writeFileSync(fp, html);
    added++;
    console.log('added:', pair[lang]);
  }
}
console.log(`\nDone. Added: ${added}, single-language skipped: ${skipped}`);
