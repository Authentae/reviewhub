#!/usr/bin/env node
// Adds Schema.org BreadcrumbList JSON-LD after the Article schema in
// every blog post. Idempotent — skips files that already have a
// BreadcrumbList.
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'client', 'public', 'blog');
const ROOT = 'https://reviewhub.review';

for (const file of fs.readdirSync(BLOG_DIR)) {
  if (!file.endsWith('.html')) continue;
  const fp = path.join(BLOG_DIR, file);
  let html = fs.readFileSync(fp, 'utf8');
  if (html.includes('BreadcrumbList')) {
    console.log('skip (already has):', file);
    continue;
  }
  const headlineMatch = html.match(/"headline": "([^"]+)"/);
  if (!headlineMatch) {
    console.log('skip (no headline):', file);
    continue;
  }
  const slug = file.replace(/\.html$/, '');
  const isThai = /lang="th"/.test(html) || slug.endsWith('-th');
  const homeName = isThai ? 'หน้าหลัก' : 'Home';
  const blogName = isThai ? 'บล็อก' : 'Blog';
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: homeName, item: `${ROOT}/` },
      { '@type': 'ListItem', position: 2, name: blogName, item: `${ROOT}/blog` },
      { '@type': 'ListItem', position: 3, name: headlineMatch[1] },
    ],
  };
  const block = `\n<script type="application/ld+json">\n${JSON.stringify(breadcrumb, null, 2)}\n</script>\n`;
  // Insert after the FIRST closing </script> after the Article ld+json.
  // The existing pattern is: <script type="application/ld+json"> … "Article" … </script>
  const articleEnd = html.indexOf('</script>', html.indexOf('"@type": "Article"'));
  if (articleEnd === -1) {
    console.log('skip (no Article block):', file);
    continue;
  }
  const insertAt = articleEnd + '</script>'.length;
  html = html.slice(0, insertAt) + block + html.slice(insertAt);
  fs.writeFileSync(fp, html);
  console.log('added:', file);
}
