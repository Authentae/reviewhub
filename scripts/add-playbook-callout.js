#!/usr/bin/env node
/**
 * Adds an in-post callout pointing to /tools/one-star-playbook on the
 * 1-star-relevant blog posts. Idempotent — re-runs are no-ops.
 *
 * Pattern: a small editorial callout inserted right before the
 * `<div class="footer-cta">` final-CTA block. Bilingual; the Thai
 * version is inserted into -th.html files.
 */
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'client', 'public', 'blog');

const RELEVANT = [
  'fake-extortion-google-reviews',
  'what-one-star-reviews-tell-you',
  'bangkok-hospitality-review-mistakes',
];

const MARKER = 'data-playbook-callout="injected"';
// Anchor priority: callout goes BEFORE the final CTA block if present,
// else before the related-posts strip, else before the closing </article>.
const ANCHORS = [
  '<div class="footer-cta">',
  '<p data-related-posts="injected"',
  '</article>',
];

const CALLOUT_EN = `<aside ${MARKER} style="margin:32px 0;padding:20px 22px;background:#fdf6e7;border-left:4px solid #c08a3e;border-radius:0 8px 8px 0">
  <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#a07d20;font-family:ui-monospace,SFMono-Regular,monospace">FREE TOOL · 2 MIN</p>
  <p style="margin:0 0 10px;font-size:17px;font-weight:600;color:#1d242c">Got a 1-star you're not sure how to answer?</p>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#4b5560">Walk through a 2-minute decision tree that figures out what KIND of 1-star you have — legitimate-specific, pattern, competitor, or extortion — and gives you a Thai+English reply template plus what NOT to say.</p>
  <a href="/tools/one-star-playbook" style="display:inline-block;font-size:14px;font-weight:600;color:#163d4a;background:#e7c992;padding:8px 14px;border-radius:6px;text-decoration:none">Open the 1-Star Playbook →</a>
</aside>
  `;

const CALLOUT_TH = `<aside ${MARKER} style="margin:32px 0;padding:20px 22px;background:#fdf6e7;border-left:4px solid #c08a3e;border-radius:0 8px 8px 0">
  <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#a07d20;font-family:ui-monospace,SFMono-Regular,monospace">เครื่องมือฟรี · 2 นาที</p>
  <p style="margin:0 0 10px;font-size:17px;font-weight:600;color:#1d242c">ได้รีวิว 1 ดาว ไม่แน่ใจว่าจะตอบยังไง?</p>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#4b5560">ลอง decision tree 2 นาที จับว่ารีวิว 1 ดาวของคุณเป็นแบบไหน — ลูกค้าจริง, ปัญหาเรื้อรัง, คู่แข่ง, หรือข่มขู่ — แล้วได้ template ตอบ TH+EN พร้อมระบุสิ่งที่ห้ามพูด</p>
  <a href="/tools/one-star-playbook" style="display:inline-block;font-size:14px;font-weight:600;color:#163d4a;background:#e7c992;padding:8px 14px;border-radius:6px;text-decoration:none">เปิด 1-Star Playbook →</a>
</aside>
  `;

let touched = 0, skipped = 0;
for (const slug of RELEVANT) {
  for (const suffix of ['', '-th']) {
    const file = path.join(BLOG_DIR, slug + suffix + '.html');
    if (!fs.existsSync(file)) { console.log('  skip (missing):', path.basename(file)); continue; }
    let html = fs.readFileSync(file, 'utf8');
    if (html.includes(MARKER)) { skipped++; continue; }
    const anchor = ANCHORS.find((a) => html.includes(a));
    if (!anchor) { console.log('  skip (no anchor):', path.basename(file)); continue; }
    const callout = suffix === '-th' ? CALLOUT_TH : CALLOUT_EN;
    html = html.replace(anchor, callout + anchor);
    fs.writeFileSync(file, html);
    touched++;
    console.log('  injected:', path.basename(file));
  }
}
console.log(`\nDone. ${touched} injected, ${skipped} already had callout.`);
