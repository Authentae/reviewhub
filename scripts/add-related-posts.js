#!/usr/bin/env node
// Inserts a "Related posts" inline section right before </article>
// in EN blog posts that don't already have one. Idempotent.
//
// Mapping is hand-curated for relevance — each post links to the
// 2 most-related siblings.
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'client', 'public', 'blog');

// Hand-curated 2-per-post related-link graph for EN posts.
// (TH posts already have related-links inline.)
const RELATED = {
  'fake-extortion-google-reviews': [
    { slug: 'how-to-remove-google-review', title: 'How to remove a Google review (the honest playbook)' },
    { slug: 'why-respond-to-google-reviews', title: 'Why your Google reviews need owner replies' },
  ],
  'why-respond-to-google-reviews': [
    { slug: 'how-to-ask-for-google-reviews', title: 'How to ask customers for Google reviews' },
    { slug: 'fake-extortion-google-reviews', title: 'How to respond to fake / extortion Google reviews' },
  ],
  'how-to-remove-google-review': [
    { slug: 'fake-extortion-google-reviews', title: 'How to respond to fake / extortion Google reviews' },
    { slug: 'how-to-ask-for-google-reviews', title: 'How to ask customers for Google reviews' },
  ],
  'how-to-ask-for-google-reviews': [
    { slug: 'why-respond-to-google-reviews', title: 'Why your Google reviews need owner replies' },
    { slug: 'transfer-google-business-profile-ownership', title: 'How to transfer Google Business Profile ownership' },
  ],
  'transfer-google-business-profile-ownership': [
    { slug: 'how-to-ask-for-google-reviews', title: 'How to ask customers for Google reviews' },
    { slug: 'why-respond-to-google-reviews', title: 'Why your Google reviews need owner replies' },
  ],
};

const MARKER = 'data-related-posts="injected"';

for (const [slug, related] of Object.entries(RELATED)) {
  const fp = path.join(BLOG_DIR, `${slug}.html`);
  if (!fs.existsSync(fp)) {
    console.log('skip (no file):', slug);
    continue;
  }
  let html = fs.readFileSync(fp, 'utf8');
  if (html.includes(MARKER)) {
    console.log('skip (already injected):', slug);
    continue;
  }
  const links = related.map(r => `<a href="/blog/${r.slug}">${r.title}</a>`).join(' · ');
  const block = `\n<p ${MARKER} style="color:#4b5560;font-size:15px;border-top:1px solid #e8dec7;padding-top:20px;margin-top:40px">\n  Related posts: ${links}\n</p>\n`;
  // Insert immediately before </article> (last occurrence)
  const articleClose = html.lastIndexOf('</article>');
  if (articleClose === -1) {
    console.log('skip (no </article>):', slug);
    continue;
  }
  html = html.slice(0, articleClose) + block + html.slice(articleClose);
  fs.writeFileSync(fp, html);
  console.log('injected:', slug);
}
