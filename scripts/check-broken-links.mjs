#!/usr/bin/env node
/**
 * scripts/check-broken-links.mjs
 *
 * Crawl every URL in sitemap.xml (production), follow every internal
 * `<a href>` on each page, and report any non-200 responses.
 *
 * Why this exists:
 * 33 blog posts, 8 vertical pages, 4 free tools, plus marketing surfaces
 * cross-link each other. Cycle 31 found 3 dead internal links manually.
 * Google deprioritises sites with broken internal links. This catches
 * rot the moment it ships.
 *
 * Usage:
 *   node scripts/check-broken-links.mjs                # prod sitemap
 *   node scripts/check-broken-links.mjs --url=https://reviewhub.review
 *   node scripts/check-broken-links.mjs --sample=10    # crawl 10 random URLs (quick)
 *   node scripts/check-broken-links.mjs --include-external   # also probe outbound links (slower)
 *
 * Output:
 *   tmp/broken-links/report.json    — full machine-readable
 *   tmp/broken-links/report.md      — human-readable summary
 *
 * Exit code:
 *   0  all internal links 200 (or 301/302 redirects with 200 destination)
 *   1  broken internal links found
 *   2  script error
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'tmp', 'broken-links');

function parseArgs() {
  const flags = process.argv.slice(2);
  const baseUrl = (flags.find(f => f.startsWith('--url=')) || '--url=https://reviewhub.review').split('=')[1].replace(/\/$/, '');
  const sampleStr = (flags.find(f => f.startsWith('--sample=')) || '--sample=0').split('=')[1];
  const sample = Number(sampleStr);
  const includeExternal = flags.includes('--include-external');
  const concurrency = Number((flags.find(f => f.startsWith('--concurrency=')) || '--concurrency=8').split('=')[1]);
  return { baseUrl, sample, includeExternal, concurrency };
}

async function fetchSitemap(baseUrl) {
  const res = await fetch(`${baseUrl}/sitemap.xml`, { headers: { 'user-agent': 'reviewhub-link-check/1.0' } });
  if (!res.ok) throw new Error(`sitemap.xml returned ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
  return urls;
}

// Known-false-positive paths — Cloudflare/CDN routes that 404 to
// raw HTTP probes (need JS) but resolve correctly in a real browser.
const FALSE_POSITIVE_PATHS = [
  '/cdn-cgi/',                  // Cloudflare obfuscated email + bot mgmt
];

function isInternalLink(href, baseUrl) {
  if (!href) return false;
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;
  for (const fp of FALSE_POSITIVE_PATHS) {
    if (href.includes(fp)) return false;
  }
  if (href.startsWith('/')) return true;
  try {
    const u = new URL(href);
    const base = new URL(baseUrl);
    return u.hostname === base.hostname;
  } catch {
    return false;
  }
}

function absolutize(href, pageUrl) {
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return null;
  }
}

async function extractLinks(pageUrl) {
  const res = await fetch(pageUrl, {
    headers: { 'user-agent': 'reviewhub-link-check/1.0' },
    redirect: 'follow',
  });
  const finalUrl = res.url;
  const status = res.status;
  if (!res.ok) return { pageUrl, finalUrl, status, links: [] };
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return { pageUrl, finalUrl, status, links: [] };
  const html = await res.text();
  // Match href attributes — both " and ' quotes. Ignores `href = "..."`-style
  // with extra spaces but that's rare in production HTML.
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/g)].map(m => m[1]);
  return { pageUrl, finalUrl, status, links: hrefs };
}

async function probeUrl(url) {
  try {
    // Some hosts (Cloudflare, GitHub) return 405 for HEAD — retry with GET.
    let res = await fetch(url, {
      method: 'HEAD',
      headers: { 'user-agent': 'reviewhub-link-check/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        headers: { 'user-agent': 'reviewhub-link-check/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
    }
    return { url, status: res.status, finalUrl: res.url, ok: res.ok };
  } catch (err) {
    return { url, status: 0, finalUrl: url, ok: false, error: err.message };
  }
}

async function processPool(items, limit, worker) {
  const results = [];
  let idx = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const { baseUrl, sample, includeExternal, concurrency } = parseArgs();
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Broken-link crawler — baseUrl=${baseUrl} concurrency=${concurrency}`);

  console.log(`\nFetching sitemap.xml…`);
  let pageUrls = await fetchSitemap(baseUrl);
  console.log(`  found ${pageUrls.length} URLs`);
  if (sample > 0) {
    pageUrls = pageUrls.sort(() => Math.random() - 0.5).slice(0, sample);
    console.log(`  sampling ${pageUrls.length}`);
  }

  console.log(`\nExtracting links from each page…`);
  const pageResults = await processPool(pageUrls, concurrency, async (url, i) => {
    if (i % 10 === 0) process.stdout.write(`  ${i}/${pageUrls.length}\r`);
    try {
      return await extractLinks(url);
    } catch (err) {
      return { pageUrl: url, finalUrl: url, status: 0, links: [], error: err.message };
    }
  });
  console.log(`  ${pageUrls.length}/${pageUrls.length}`);

  // Collect unique link URLs (absolutised), tagged internal/external,
  // and the set of pages that reference each.
  const linkMap = new Map();
  for (const pr of pageResults) {
    for (const href of pr.links) {
      const abs = absolutize(href, pr.pageUrl);
      if (!abs) continue;
      // Strip fragment for probing; preserve original href for reporting.
      const noFrag = abs.split('#')[0];
      const internal = isInternalLink(href, baseUrl);
      if (!internal && !includeExternal) continue;
      if (!linkMap.has(noFrag)) {
        linkMap.set(noFrag, { url: noFrag, internal, refs: [] });
      }
      const entry = linkMap.get(noFrag);
      if (!entry.refs.includes(pr.pageUrl)) entry.refs.push(pr.pageUrl);
    }
  }
  const links = [...linkMap.values()];
  console.log(`\nProbing ${links.length} unique links (${links.filter(l => l.internal).length} internal, ${links.filter(l => !l.internal).length} external)…`);

  const probes = await processPool(links, concurrency, async (link, i) => {
    if (i % 20 === 0) process.stdout.write(`  ${i}/${links.length}\r`);
    const probe = await probeUrl(link.url);
    return { ...link, ...probe };
  });
  console.log(`  ${links.length}/${links.length}`);

  // Classify
  const broken = probes.filter(p => !p.ok);
  const internalBroken = broken.filter(p => p.internal);
  const externalBroken = broken.filter(p => !p.internal);

  // Reports
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl,
    pagesChecked: pageUrls.length,
    linksProbed: links.length,
    internalCount: links.filter(l => l.internal).length,
    externalCount: links.filter(l => !l.internal).length,
    internalBrokenCount: internalBroken.length,
    externalBrokenCount: externalBroken.length,
    internalBroken,
    externalBroken: includeExternal ? externalBroken : [],
  };
  await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

  const md = [
    `# Broken-link report — ${report.timestamp}`,
    '',
    `Base URL: ${baseUrl}`,
    `Pages crawled: ${report.pagesChecked}`,
    `Internal links probed: ${report.internalCount}, broken: **${report.internalBrokenCount}**`,
    `External links probed: ${report.externalCount}, broken: **${report.externalBrokenCount}**`,
    '',
    '## Internal broken links',
    internalBroken.length === 0 ? '_None ✓_' : '',
    ...internalBroken.map(b =>
      `- ${b.status || 'ERR'} \`${b.url}\` (referenced by ${b.refs.length} page${b.refs.length === 1 ? '' : 's'}: ${b.refs.slice(0, 3).join(', ')}${b.refs.length > 3 ? '…' : ''})`
    ),
    '',
    ...(includeExternal ? [
      '## External broken links',
      externalBroken.length === 0 ? '_None ✓_' : '',
      ...externalBroken.map(b =>
        `- ${b.status || 'ERR'} \`${b.url}\` (referenced by ${b.refs.length} page${b.refs.length === 1 ? '' : 's'})`
      ),
    ] : []),
  ].join('\n');
  await writeFile(path.join(OUT_DIR, 'report.md'), md);

  console.log(`\nInternal broken: ${internalBroken.length}`);
  console.log(`External broken: ${externalBroken.length}${includeExternal ? '' : ' (not checked — pass --include-external)'}`);
  console.log(`Reports: tmp/broken-links/report.{json,md}`);

  if (internalBroken.length > 0) {
    console.log('\n✗ Internal broken links found:');
    for (const b of internalBroken.slice(0, 20)) {
      console.log(`  ${b.status || 'ERR'}  ${b.url}`);
      console.log(`        ← referenced by ${b.refs[0]}${b.refs.length > 1 ? ` (+${b.refs.length - 1} more)` : ''}`);
    }
    if (internalBroken.length > 20) console.log(`  …+${internalBroken.length - 20} more in report`);
    process.exit(1);
  }
  console.log('\n✓ No broken internal links.');
}

main().catch(err => {
  console.error('Crawler failed:', err);
  process.exit(2);
});
