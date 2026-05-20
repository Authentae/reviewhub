#!/usr/bin/env node
/**
 * scripts/a11y-audit.mjs
 *
 * Run axe-core via Puppeteer across ReviewHub's top surfaces. Emits
 * a violations report grouped by impact (critical / serious / moderate
 * / minor). Fails (exit 1) if any serious-or-critical violations exist.
 *
 * Why this exists:
 * Accessibility matters for SEO (Lighthouse weighting), legal exposure
 * once we have US customers (ADA), and inclusive use. Zero current
 * coverage. Lighthouse's a11y score is a surface signal; axe-core gives
 * actionable per-violation diagnostics.
 *
 * Usage:
 *   node scripts/a11y-audit.mjs                       # all surfaces, prod
 *   node scripts/a11y-audit.mjs --url=http://localhost:5173
 *   node scripts/a11y-audit.mjs --only=landing,pricing
 *   node scripts/a11y-audit.mjs --fail-on=moderate    # stricter (default: serious)
 *
 * Output:
 *   tmp/a11y/<slug>.json     — full axe report per surface
 *   tmp/a11y/summary.md      — human-readable violations grouped
 *   tmp/a11y/summary.json    — machine-readable summary
 */
import puppeteer from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'tmp', 'a11y');

const SURFACES = [
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
  { slug: 'tool-generator',    path: '/tools/review-reply-generator' },
  { slug: 'guide',             path: '/guide' },
  { slug: 'blog-index',        path: '/blog' },
  { slug: 'register',          path: '/register' },
  { slug: 'login',             path: '/login' },
];

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

function parseArgs() {
  const flags = process.argv.slice(2);
  const baseUrl = (flags.find(f => f.startsWith('--url=')) || '--url=https://reviewhub.review').split('=')[1].replace(/\/$/, '');
  const only = (flags.find(f => f.startsWith('--only=')) || '--only=').split('=')[1];
  const onlySlugs = only ? only.split(',').map(s => s.trim()).filter(Boolean) : null;
  const failOn = (flags.find(f => f.startsWith('--fail-on=')) || '--fail-on=serious').split('=')[1];
  return { baseUrl, onlySlugs, failOn };
}

function impactAtLeast(impact, threshold) {
  const i = IMPACT_ORDER.indexOf(impact);
  const t = IMPACT_ORDER.indexOf(threshold);
  return i >= 0 && t >= 0 && i <= t;
}

async function auditOne(browser, baseUrl, surf) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const url = `${baseUrl}${surf.path}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  } catch {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  }
  await new Promise(r => setTimeout(r, 800));

  // WCAG 2.1 AA is the practical bar; axe defaults cover wcag2a/2aa.
  const results = await new AxePuppeteer(page)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  await page.close();
  return { slug: surf.slug, url, ...results };
}

async function main() {
  const { baseUrl, onlySlugs, failOn } = parseArgs();
  await mkdir(OUT_DIR, { recursive: true });

  const surfaces = onlySlugs ? SURFACES.filter(s => onlySlugs.includes(s.slug)) : SURFACES;
  console.log(`a11y audit — baseUrl=${baseUrl} surfaces=${surfaces.length} fail-on=${failOn}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const summary = [];
  let totalCritical = 0, totalSerious = 0, totalModerate = 0, totalMinor = 0;
  let failures = 0;

  try {
    for (const surf of surfaces) {
      const t0 = Date.now();
      try {
        const res = await auditOne(browser, baseUrl, surf);
        await writeFile(path.join(OUT_DIR, `${surf.slug}.json`), JSON.stringify(res, null, 2));
        const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        for (const v of res.violations) counts[v.impact || 'minor']++;
        totalCritical += counts.critical;
        totalSerious += counts.serious;
        totalModerate += counts.moderate;
        totalMinor += counts.minor;

        const exceedsFailThreshold = res.violations.some(v => impactAtLeast(v.impact || 'minor', failOn));
        if (exceedsFailThreshold) failures++;
        const mark = exceedsFailThreshold ? '✗' : '✓';
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(
          `${mark} ${surf.slug.padEnd(20)} ` +
          `crit=${String(counts.critical).padStart(2)} ` +
          `serious=${String(counts.serious).padStart(2)} ` +
          `moderate=${String(counts.moderate).padStart(2)} ` +
          `minor=${String(counts.minor).padStart(2)} ` +
          `(${elapsed}s)`
        );
        summary.push({ slug: surf.slug, url: res.url, counts, violations: res.violations.map(v => ({
          id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.length,
        })) });
      } catch (err) {
        console.log(`✗ ${surf.slug.padEnd(20)} ERROR: ${err.message}`);
        summary.push({ slug: surf.slug, error: err.message });
        failures++;
      }
    }
  } finally {
    await browser.close();
  }

  // Summary markdown
  const md = [
    `# Accessibility audit — ${new Date().toISOString()}`,
    '',
    `Base URL: ${baseUrl}`,
    `Surfaces audited: ${summary.length}`,
    '',
    `**Totals:** critical=${totalCritical} serious=${totalSerious} moderate=${totalModerate} minor=${totalMinor}`,
    '',
    '## Per-surface counts',
    '',
    '| Surface | Critical | Serious | Moderate | Minor |',
    '|---|---:|---:|---:|---:|',
    ...summary.filter(s => !s.error).map(s =>
      `| ${s.slug} | ${s.counts.critical} | ${s.counts.serious} | ${s.counts.moderate} | ${s.counts.minor} |`
    ),
    '',
    '## Top violations (by surface, serious+)',
    '',
    ...summary.flatMap(s => {
      if (s.error) return [`### ${s.slug} — ERROR: ${s.error}`, ''];
      const seriousPlus = s.violations.filter(v => impactAtLeast(v.impact, 'serious'));
      if (seriousPlus.length === 0) return [];
      return [
        `### ${s.slug}`,
        ...seriousPlus.map(v =>
          `- **[${v.impact}]** \`${v.id}\` — ${v.help} (${v.nodes} nodes) · [docs](${v.helpUrl})`
        ),
        '',
      ];
    }),
  ].join('\n');
  await writeFile(path.join(OUT_DIR, 'summary.md'), md);
  await writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    baseUrl,
    totals: { critical: totalCritical, serious: totalSerious, moderate: totalModerate, minor: totalMinor },
    failures,
    surfaces: summary,
  }, null, 2));

  console.log(`\nTotals: critical=${totalCritical}  serious=${totalSerious}  moderate=${totalModerate}  minor=${totalMinor}`);
  console.log(`Reports: tmp/a11y/summary.{md,json}`);
  console.log(`\n${summary.length - failures}/${summary.length} surfaces clean at fail-on=${failOn}.`);

  if (failures > 0) process.exit(1);
}

main().catch(err => {
  console.error('a11y audit failed:', err);
  process.exit(2);
});
