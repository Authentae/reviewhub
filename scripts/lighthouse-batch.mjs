#!/usr/bin/env node
/**
 * scripts/lighthouse-batch.mjs
 *
 * Run Lighthouse against a list of ReviewHub URLs and produce a CSV +
 * Markdown summary of Performance / Accessibility / Best-Practices /
 * SEO scores. Fails (exit 1) if any score drops below the threshold.
 *
 * Why this exists:
 * We have 33 blog posts + 10 marketing surfaces and have NEVER measured
 * Core Web Vitals beyond ad-hoc PSI runs on Landing. Lighthouse score is
 * a direct SEO ranking factor and a real signal of perceived speed.
 *
 * Usage:
 *   node scripts/lighthouse-batch.mjs              # prod, default URL set
 *   node scripts/lighthouse-batch.mjs --url=http://localhost:5173
 *   node scripts/lighthouse-batch.mjs --only=landing,pricing
 *   node scripts/lighthouse-batch.mjs --min-perf=70 --min-seo=90 --min-a11y=90
 *   node scripts/lighthouse-batch.mjs --form-factor=mobile  # default
 *   node scripts/lighthouse-batch.mjs --form-factor=desktop
 *
 * Output:
 *   tmp/lighthouse/<slug>.json            — full Lighthouse JSON
 *   tmp/lighthouse/summary.csv            — scores per URL
 *   tmp/lighthouse/summary.md             — human-readable table
 *   tmp/lighthouse/cwv.csv                — LCP/CLS/INP/TBT/FCP per URL
 */
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'tmp', 'lighthouse');

// The URL set is intentionally small to keep runtime reasonable
// (~15-25s per URL × N). Add as surfaces matter; remove when dead.
const URLS = [
  { slug: 'landing',           path: '/' },
  { slug: 'pricing',           path: '/pricing' },
  { slug: 'about',             path: '/about' },
  { slug: 'why-us',            path: '/why-us' },
  { slug: 'trust',             path: '/trust' },
  { slug: 'integrations',      path: '/integrations' },
  { slug: 'audit',             path: '/audit' },
  { slug: 'audit-demo',        path: '/audit-demo' },
  { slug: 'for-spas',          path: '/for-spas' },
  { slug: 'for-dentists',      path: '/for-dentists' },
  { slug: 'vs-birdeye',        path: '/vs/birdeye' },
  { slug: 'vs-chatgpt',        path: '/vs/chatgpt' },
  { slug: 'tool-generator',    path: '/tools/review-reply-generator' },
  { slug: 'guide',             path: '/guide' },
  { slug: 'blog-index',        path: '/blog' },
  // Sample one blog post to baseline. Add more if signal warrants.
  { slug: 'blog-fast-reply',   path: '/blog/how-fast-should-you-reply-to-google-reviews' },
];

function parseArgs() {
  const flags = process.argv.slice(2);
  const baseUrl = (flags.find(f => f.startsWith('--url=')) || '--url=https://reviewhub.review').split('=')[1].replace(/\/$/, '');
  const only = (flags.find(f => f.startsWith('--only=')) || '--only=').split('=')[1];
  const onlySlugs = only ? only.split(',').map(s => s.trim()).filter(Boolean) : null;
  const formFactor = (flags.find(f => f.startsWith('--form-factor=')) || '--form-factor=mobile').split('=')[1];
  const minPerf = Number((flags.find(f => f.startsWith('--min-perf=')) || '--min-perf=60').split('=')[1]);
  const minSeo = Number((flags.find(f => f.startsWith('--min-seo=')) || '--min-seo=85').split('=')[1]);
  const minA11y = Number((flags.find(f => f.startsWith('--min-a11y=')) || '--min-a11y=85').split('=')[1]);
  const minBp = Number((flags.find(f => f.startsWith('--min-bp=')) || '--min-bp=85').split('=')[1]);
  return { baseUrl, onlySlugs, formFactor, minPerf, minSeo, minA11y, minBp };
}

async function runOne(url, formFactor) {
  // userDataDir: false avoids a Windows EPERM bug where chrome-launcher
  // creates a temp profile dir under %LOCALAPPDATA%\Temp\lighthouse.NNN
  // and Windows file-locks it before lighthouse can read it back.
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    userDataDir: false,
  });
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      formFactor,
      screenEmulation: formFactor === 'mobile'
        ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }
        : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    });
    return result.lhr;
  } finally {
    await chrome.kill();
  }
}

function pct(category) {
  if (!category || typeof category.score !== 'number') return null;
  return Math.round(category.score * 100);
}

function ms(audit) {
  if (!audit || typeof audit.numericValue !== 'number') return null;
  return Math.round(audit.numericValue);
}

function cls(audit) {
  if (!audit || typeof audit.numericValue !== 'number') return null;
  return Math.round(audit.numericValue * 1000) / 1000;
}

async function main() {
  const { baseUrl, onlySlugs, formFactor, minPerf, minSeo, minA11y, minBp } = parseArgs();
  await mkdir(OUT_DIR, { recursive: true });
  const urls = onlySlugs ? URLS.filter(u => onlySlugs.includes(u.slug)) : URLS;

  console.log(`Lighthouse batch — baseUrl=${baseUrl} form-factor=${formFactor} surfaces=${urls.length}`);
  console.log(`Thresholds: perf≥${minPerf} seo≥${minSeo} a11y≥${minA11y} best-practices≥${minBp}\n`);

  const rows = [];
  let failures = 0;
  const t0 = Date.now();

  for (const u of urls) {
    const url = `${baseUrl}${u.path}`;
    const tStart = Date.now();
    try {
      const lhr = await runOne(url, formFactor);
      await writeFile(path.join(OUT_DIR, `${u.slug}.json`), JSON.stringify(lhr, null, 2));
      const perf = pct(lhr.categories.performance);
      const a11y = pct(lhr.categories.accessibility);
      const bp = pct(lhr.categories['best-practices']);
      const seo = pct(lhr.categories.seo);
      const lcp = ms(lhr.audits['largest-contentful-paint']);
      const fcp = ms(lhr.audits['first-contentful-paint']);
      const tbt = ms(lhr.audits['total-blocking-time']);
      const clsValue = cls(lhr.audits['cumulative-layout-shift']);
      const si = ms(lhr.audits['speed-index']);

      const failed = (perf !== null && perf < minPerf) ||
                     (seo !== null && seo < minSeo) ||
                     (a11y !== null && a11y < minA11y) ||
                     (bp !== null && bp < minBp);
      if (failed) failures++;

      const elapsed = Math.round((Date.now() - tStart) / 1000);
      console.log(
        `${failed ? '✗' : '✓'} ${u.slug.padEnd(20)} ` +
        `perf=${String(perf).padStart(3)} ` +
        `a11y=${String(a11y).padStart(3)} ` +
        `bp=${String(bp).padStart(3)} ` +
        `seo=${String(seo).padStart(3)} | ` +
        `LCP=${String(lcp).padStart(5)}ms ` +
        `CLS=${String(clsValue).padStart(5)} ` +
        `TBT=${String(tbt).padStart(4)}ms ` +
        `(${elapsed}s)`
      );

      rows.push({ slug: u.slug, url, perf, a11y, bp, seo, lcp, fcp, tbt, cls: clsValue, si, failed });
    } catch (err) {
      console.log(`✗ ${u.slug.padEnd(20)} ERROR: ${err.message}`);
      rows.push({ slug: u.slug, url, error: err.message, failed: true });
      failures++;
    }
  }

  // CSV summary
  const csv = [
    'slug,url,perf,a11y,best_practices,seo,lcp_ms,fcp_ms,tbt_ms,cls,speed_index_ms,failed',
    ...rows.map(r => [
      r.slug, r.url, r.perf ?? '', r.a11y ?? '', r.bp ?? '', r.seo ?? '',
      r.lcp ?? '', r.fcp ?? '', r.tbt ?? '', r.cls ?? '', r.si ?? '',
      r.failed ? '1' : '0',
    ].join(',')),
  ].join('\n');
  await writeFile(path.join(OUT_DIR, 'summary.csv'), csv);

  // Markdown summary
  const mdRows = rows.map(r =>
    r.error
      ? `| ${r.slug} | ERROR: ${r.error} | | | | | | | | |`
      : `| ${r.slug} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp}ms | ${r.fcp}ms | ${r.tbt}ms | ${r.cls} | ${r.failed ? '✗' : '✓'} |`
  );
  const md = [
    `# Lighthouse run — ${new Date().toISOString()}`,
    '',
    `Form factor: **${formFactor}** · Base: ${baseUrl}`,
    `Thresholds: perf ≥ ${minPerf}, seo ≥ ${minSeo}, a11y ≥ ${minA11y}, best-practices ≥ ${minBp}`,
    '',
    '| Surface | Perf | A11y | BP | SEO | LCP | FCP | TBT | CLS | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|:---:|',
    ...mdRows,
    '',
    `**${rows.length - failures}/${rows.length} surfaces pass.**`,
  ].join('\n');
  await writeFile(path.join(OUT_DIR, 'summary.md'), md);

  const totalElapsed = Math.round((Date.now() - t0) / 1000);
  console.log(`\n${rows.length - failures}/${rows.length} passed. Total ${totalElapsed}s.`);
  console.log(`See tmp/lighthouse/summary.md and summary.csv`);

  if (failures > 0) process.exit(1);
}

main().catch(err => {
  console.error('Lighthouse batch failed:', err);
  process.exit(2);
});
