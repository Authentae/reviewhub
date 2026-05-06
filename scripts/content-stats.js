#!/usr/bin/env node
// Reports stats on the blog content: post count by language, word
// count totals, average reading time, distribution by date.
//
// Run: node scripts/content-stats.js
// Useful to check progress on the EN/TH parity goal and total
// volume of content shipped.
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'client', 'public', 'blog');

const posts = [];
for (const file of fs.readdirSync(BLOG_DIR)) {
  if (!file.endsWith('.html')) continue;
  const slug = file.replace(/\.html$/, '');
  const html = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  // Extract date from datePublished in Article schema
  const dateMatch = html.match(/"datePublished": "(20\d{2}-\d{2}-\d{2})"/);
  const date = dateMatch ? dateMatch[1] : 'unknown';
  // Extract lang
  const langMatch = html.match(/<html lang="(\w+)"/);
  const lang = langMatch ? langMatch[1] : 'unknown';
  // Strip tags + scripts to count words
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Thai words don't space-separate, so count chars / 6 as a rough proxy
  const isCJKish = lang === 'th' || lang === 'ja' || lang === 'zh' || lang === 'ko';
  const words = isCJKish ? Math.round(text.length / 6) : text.split(/\s+/).length;
  posts.push({ slug, date, lang, words });
}

// Sort by date desc
posts.sort((a, b) => b.date.localeCompare(a.date));

const byLang = posts.reduce((acc, p) => {
  acc[p.lang] = (acc[p.lang] || 0) + 1;
  return acc;
}, {});

const totalWords = posts.reduce((s, p) => s + p.words, 0);
const totalPosts = posts.length;
const avgWords = Math.round(totalWords / totalPosts);

const byDate = posts.reduce((acc, p) => {
  acc[p.date] = (acc[p.date] || 0) + 1;
  return acc;
}, {});
const datesSorted = Object.keys(byDate).sort().reverse();

console.log('# ReviewHub blog content stats\n');
console.log(`Total posts:       ${totalPosts}`);
console.log(`  English:         ${byLang.en || 0}`);
console.log(`  Thai:            ${byLang.th || 0}`);
console.log(`Total words:       ${totalWords.toLocaleString()}`);
console.log(`Average per post:  ${avgWords.toLocaleString()}`);
console.log(`\nBy publish date:`);
for (const d of datesSorted.slice(0, 10)) {
  console.log(`  ${d}  ${byDate[d]} post(s)`);
}
console.log(`\nNewest 5:`);
for (const p of posts.slice(0, 5)) {
  console.log(`  [${p.lang}] ${p.date}  ${p.slug}  (${p.words.toLocaleString()} words)`);
}
