#!/usr/bin/env node
/**
 * scripts/screenshot.js — headless Chromium screenshot via Puppeteer.
 *
 * Why this exists:
 * Chrome MCP can drive Earth's signed-in browser and SHOW screenshots,
 * but `save_to_disk: true` doesn't actually write a recoverable PNG.
 * Puppeteer (installed 2026-05-21 as devDep) saves to disk fine but
 * has no access to Earth's auth — so use it for PUBLIC URLs.
 *
 * Usage:
 *   node scripts/screenshot.js <url> <output-path> [--full] [--width=1440] [--height=900]
 *
 * Examples:
 *   node scripts/screenshot.js https://reviewhub.review C:/Users/Computer/Desktop/screenshots/landing.png
 *   node scripts/screenshot.js https://reviewhub.review/audit-demo ./tmp/audit.png --full
 */
import puppeteer from 'puppeteer';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];

if (!url || !out) {
  console.error('Usage: node scripts/screenshot.js <url> <output-path> [--full] [--width=N] [--height=N]');
  process.exit(1);
}

const flags = args.slice(2);
const full = flags.includes('--full');
const width = Number((flags.find(f => f.startsWith('--width=')) || '--width=1440').split('=')[1]);
const height = Number((flags.find(f => f.startsWith('--height=')) || '--height=900').split('=')[1]);

await mkdir(path.dirname(out), { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
  // Settle web fonts + late-mount React state.
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: out, fullPage: full });
  const stat = await import('node:fs/promises').then(m => m.stat(out));
  console.log(`Saved ${out} (${Math.round(stat.size / 1024)} KB, ${width}x${height}${full ? ' full' : ''})`);
} finally {
  await browser.close();
}
