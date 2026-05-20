#!/usr/bin/env node
/**
 * scripts/visual-regression.mjs
 *
 * Visual-regression harness. Captures screenshots of ReviewHub's top
 * marketing surfaces in light + dark mode + Thai locale, diffs them
 * against a stored baseline using pixelmatch, and fails (exit 1) if
 * any surface changes by more than the threshold.
 *
 * Why this exists:
 * Every UI ship today has zero coverage on what it does to non-edited
 * pages. Shared component / Tailwind / token changes silently break
 * Pricing, Audit, /for-spas. This script is the safety net.
 *
 * Usage:
 *   node scripts/visual-regression.mjs baseline    # capture new baseline
 *   node scripts/visual-regression.mjs check       # diff current vs baseline
 *   node scripts/visual-regression.mjs check --url=https://reviewhub.review   # against prod
 *
 * Output:
 *   tmp/visual/baseline/<slug>.png              — frozen reference shots
 *   tmp/visual/current/<slug>.png               — last capture
 *   tmp/visual/diff/<slug>.png                  — pixel-diff visualisation
 *   tmp/visual/report.json                      — machine-readable summary
 *
 * Threshold:
 *   --max-diff-pct=0.5  (default) — fail if >0.5% of pixels differ
 */
import puppeteer from 'puppeteer';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_ROOT = path.join(ROOT, 'tmp', 'visual');

// Top surfaces by traffic/conversion importance. Add new entries here
// when a new landing surface is built. Order = capture order; doesn't
// affect diff results.
//
// Each: { slug, path, viewport: {w, h}, dark?, lang? }
const SURFACES = [
  { slug: 'landing',           path: '/' },
  { slug: 'landing-dark',      path: '/',           dark: true },
  { slug: 'landing-th',        path: '/',           lang: 'th' },
  { slug: 'pricing',           path: '/pricing' },
  { slug: 'pricing-th',        path: '/pricing',    lang: 'th' },
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
  { slug: 'support',           path: '/support' },
  { slug: 'changelog',         path: '/changelog' },
  { slug: 'blog-index',        path: '/blog' },
];

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 1200;

function parseArgs() {
  const [mode, ...flags] = process.argv.slice(2);
  if (!mode || !['baseline', 'check'].includes(mode)) {
    console.error('Usage: node scripts/visual-regression.mjs <baseline|check> [--url=...] [--max-diff-pct=0.5] [--only=slug,slug]');
    process.exit(1);
  }
  const url = (flags.find(f => f.startsWith('--url=')) || '--url=http://localhost:5173').split('=')[1];
  const maxDiffPct = Number((flags.find(f => f.startsWith('--max-diff-pct=')) || '--max-diff-pct=0.5').split('=')[1]);
  const only = (flags.find(f => f.startsWith('--only=')) || '--only=').split('=')[1];
  const onlySlugs = only ? only.split(',').map(s => s.trim()).filter(Boolean) : null;
  return { mode, baseUrl: url.replace(/\/$/, ''), maxDiffPct, onlySlugs };
}

async function captureAll(baseUrl, targetDir, onlySlugs) {
  await mkdir(targetDir, { recursive: true });
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const captured = [];
  try {
    const surfaces = onlySlugs ? SURFACES.filter(s => onlySlugs.includes(s.slug)) : SURFACES;
    for (const surf of surfaces) {
      const page = await browser.newPage();
      await page.setViewport({ ...DEFAULT_VIEWPORT, ...(surf.viewport || {}), deviceScaleFactor: 1 });
      if (surf.lang) {
        // Pre-seed localStorage so I18nProvider picks the locale on mount.
        await page.evaluateOnNewDocument((lang) => {
          localStorage.setItem('reviewhub_lang', lang);
        }, surf.lang);
      }
      if (surf.dark) {
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
        await page.evaluateOnNewDocument(() => {
          localStorage.setItem('theme', 'dark');
          document.documentElement.classList.add('dark');
        });
      }
      const url = `${baseUrl}${surf.path}`;
      const t0 = Date.now();
      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      } catch (e) {
        // networkidle0 can race on long-poll endpoints; fall back to domcontentloaded
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      }
      await new Promise(r => setTimeout(r, SETTLE_MS));
      const out = path.join(targetDir, `${surf.slug}.png`);
      await page.screenshot({ path: out, fullPage: false });
      const sz = await stat(out);
      console.log(`  ${surf.slug.padEnd(20)} ${Math.round((Date.now() - t0) / 100) / 10}s  ${Math.round(sz.size / 1024)} KB`);
      captured.push({ slug: surf.slug, url, file: out });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return captured;
}

async function diffOne(baselinePath, currentPath, diffPath) {
  const [aRaw, bRaw] = await Promise.all([readFile(baselinePath), readFile(currentPath)]);
  const a = PNG.sync.read(aRaw);
  const b = PNG.sync.read(bRaw);
  if (a.width !== b.width || a.height !== b.height) {
    return { error: `dimensions differ (${a.width}x${a.height} vs ${b.width}x${b.height})`, diffPct: 100 };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: 0.1,
    alpha: 0.3,
    diffColor: [255, 0, 80],
  });
  const totalPixels = a.width * a.height;
  const diffPct = (diffPixels / totalPixels) * 100;
  if (diffPct > 0) {
    await writeFile(diffPath, PNG.sync.write(diff));
  }
  return { diffPixels, totalPixels, diffPct };
}

async function main() {
  const { mode, baseUrl, maxDiffPct, onlySlugs } = parseArgs();
  console.log(`Visual regression — mode=${mode} baseUrl=${baseUrl} maxDiffPct=${maxDiffPct}%`);
  if (onlySlugs) console.log(`  filter: ${onlySlugs.join(', ')}`);

  if (mode === 'baseline') {
    const baselineDir = path.join(OUT_ROOT, 'baseline');
    console.log(`\nCapturing baseline to ${baselineDir}/`);
    const captured = await captureAll(baseUrl, baselineDir, onlySlugs);
    console.log(`\n✓ Baseline captured: ${captured.length} surfaces`);
    return;
  }

  const baselineDir = path.join(OUT_ROOT, 'baseline');
  const currentDir = path.join(OUT_ROOT, 'current');
  const diffDir = path.join(OUT_ROOT, 'diff');
  await mkdir(diffDir, { recursive: true });

  if (!existsSync(baselineDir)) {
    console.error(`\n✗ No baseline found at ${baselineDir}`);
    console.error('  Run: node scripts/visual-regression.mjs baseline');
    process.exit(1);
  }

  console.log(`\nCapturing current to ${currentDir}/`);
  const captured = await captureAll(baseUrl, currentDir, onlySlugs);

  console.log(`\nDiffing vs baseline (threshold ${maxDiffPct}%)…`);
  const results = [];
  let failures = 0;
  for (const c of captured) {
    const baselinePath = path.join(baselineDir, `${c.slug}.png`);
    if (!existsSync(baselinePath)) {
      console.log(`  ${c.slug.padEnd(20)} no baseline (new surface)`);
      results.push({ slug: c.slug, status: 'new' });
      continue;
    }
    const diffPath = path.join(diffDir, `${c.slug}.png`);
    const r = await diffOne(baselinePath, c.file, diffPath);
    if (r.error) {
      console.log(`  ${c.slug.padEnd(20)} ✗ ${r.error}`);
      results.push({ slug: c.slug, status: 'error', ...r });
      failures++;
      continue;
    }
    const pctStr = r.diffPct.toFixed(3) + '%';
    const passed = r.diffPct <= maxDiffPct;
    const mark = passed ? '✓' : '✗';
    console.log(`  ${c.slug.padEnd(20)} ${mark} ${pctStr.padStart(8)}  (${r.diffPixels}/${r.totalPixels} px)`);
    results.push({ slug: c.slug, status: passed ? 'pass' : 'fail', ...r });
    if (!passed) failures++;
  }

  const report = {
    mode,
    baseUrl,
    timestamp: new Date().toISOString(),
    maxDiffPct,
    surfaces: results,
    summary: {
      total: results.length,
      pass: results.filter(r => r.status === 'pass').length,
      fail: results.filter(r => r.status === 'fail').length,
      new: results.filter(r => r.status === 'new').length,
      error: results.filter(r => r.status === 'error').length,
    },
  };
  await writeFile(path.join(OUT_ROOT, 'report.json'), JSON.stringify(report, null, 2));

  console.log(`\n${report.summary.pass}/${report.summary.total} passed.`);
  if (failures > 0) {
    console.log(`\n✗ ${failures} surface(s) over threshold. See ${diffDir}/`);
    process.exit(1);
  }
  console.log('\n✓ All surfaces within threshold.');
}

main().catch(err => {
  console.error('Visual regression failed:', err);
  process.exit(2);
});
