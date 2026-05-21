#!/usr/bin/env node
/**
 * scripts/research-prospect.mjs
 *
 * Visit a candidate prospect website, find ALL email addresses
 * (including Cloudflare-obfuscated ones), follow the contact page if
 * the home page has none. Used overnight 2026-05-21 → 2026-05-22 to
 * verify Wave 6 prospect emails BEFORE Earth sends to them (avoiding
 * the Wave 5 failure where 4/14 muay thai emails bounced because
 * Earth pattern-guessed `<biz>@gmail.com` for unverified addresses).
 *
 * Usage:
 *   node scripts/research-prospect.mjs <url>
 *
 * Outputs a small JSON to stdout:
 *   {
 *     url,
 *     reachable,
 *     emails: ["info@biz.com", ...],
 *     contactPageUrl?,
 *     title,
 *     snippets: ["context lines mentioning email/contact"]
 *   }
 */
import puppeteer from 'puppeteer';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/research-prospect.mjs <url>');
  process.exit(1);
}

// Decode Cloudflare email obfuscation: the data-cfemail attribute is a
// hex-encoded XOR cipher with the first byte as the key.
function decodeCfEmail(hex) {
  try {
    const bytes = hex.match(/.{2}/g).map(b => parseInt(b, 16));
    const key = bytes.shift();
    return String.fromCharCode(...bytes.map(b => b ^ key));
  } catch { return null; }
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  let homeData = null;
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 25000 });
    homeData = await extractEmailData(page);
  } catch (err) {
    console.log(JSON.stringify({ url, reachable: false, error: err.message }));
    process.exit(0);
  }

  // If homepage has no emails, try common contact paths
  let contactData = null;
  let contactUrl = null;
  if (homeData.emails.length === 0) {
    const candidates = ['/contact', '/contact-us', '/contact-us/', '/get-in-touch', '/about', '/about-us'];
    for (const path of candidates) {
      try {
        const fullUrl = new URL(path, url).toString();
        await page.goto(fullUrl, { waitUntil: 'networkidle0', timeout: 15000 });
        const data = await extractEmailData(page);
        if (data.emails.length > 0) {
          contactData = data;
          contactUrl = fullUrl;
          break;
        }
      } catch { /* try next path */ }
    }
  }

  const finalEmails = [...new Set([
    ...homeData.emails,
    ...(contactData?.emails || []),
  ])];

  // Filter out generic placeholders
  const realEmails = finalEmails.filter(e =>
    !/example\.com|yoursite|@yourdomain|@email\.com/i.test(e)
  );

  const out = {
    url,
    reachable: true,
    emails: realEmails,
    contactPageUrl: contactUrl,
    title: homeData.title,
    snippets: [
      ...(homeData.contextSnippets || []),
      ...(contactData?.contextSnippets || []),
    ].slice(0, 5),
  };
  console.log(JSON.stringify(out, null, 2));
} finally {
  await browser.close();
}

async function extractEmailData(page) {
  return await page.evaluate((decodeCfEmailStr) => {
    // eslint-disable-next-line no-new-func
    const decode = new Function('hex', `return (${decodeCfEmailStr})(hex)`);
    const emails = new Set();
    // 1. mailto: links
    for (const a of document.querySelectorAll('a[href^="mailto:"]')) {
      const m = a.getAttribute('href').replace(/^mailto:/, '').split('?')[0];
      if (m) emails.add(m.trim().toLowerCase());
    }
    // 2. data-cfemail (Cloudflare obfuscation)
    for (const el of document.querySelectorAll('[data-cfemail]')) {
      const dec = decode(el.getAttribute('data-cfemail'));
      if (dec && dec.includes('@')) emails.add(dec.toLowerCase());
    }
    // 3. Plain-text emails in body innerText
    const text = document.body?.innerText || '';
    const matches = text.match(/[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const m of matches) emails.add(m.toLowerCase());
    // Context snippets — find sentences mentioning email/contact
    const sentences = text.split(/[.!?]\s+/).filter(s =>
      /email|contact|reach|inquir|appointment/i.test(s) && s.length < 200
    ).slice(0, 5);
    return {
      title: document.title || '',
      emails: [...emails],
      contextSnippets: sentences,
    };
  }, decodeCfEmail.toString());
}
