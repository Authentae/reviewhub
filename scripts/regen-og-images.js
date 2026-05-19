#!/usr/bin/env node
// Regenerates every PNG raster of an SVG static asset from its SVG source.
// Run after editing any SVG so the social-share/PNG mirrors stay in sync.
//
// Why this exists:
//   On 2026-05-19 cycle 7, og-image.png was 6+ weeks behind og-image.svg
//   because the documented sharp command lived in an HTML comment that
//   nobody re-ran when the SVG copy was last edited. A one-line npm
//   script eliminates the "remember the magic invocation" tax.
//
// Usage:
//   node scripts/regen-og-images.js
//
// Prerequisites:
//   sharp must be installed in client/ (it's not a direct dependency;
//   install transiently if missing: `cd client && npm install --no-save sharp`)
//
// Outputs all regenerated files with sizes; exits 1 on any failure.

const path = require('path');
const fs = require('fs');

// sharp lives under client/node_modules because that's where it gets
// installed transiently. Resolve from there.
const sharpPath = path.join(__dirname, '..', 'client', 'node_modules', 'sharp');
let sharp;
try {
  sharp = require(sharpPath);
} catch {
  console.error('❌ sharp is not installed. Run: cd client && npm install --no-save sharp');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'client', 'public');

// SVG source → list of PNG renders. Each render entry is [filename, width, height].
// height === width for square favicons; rectangular for og-image / x-header.
const RENDERS = [
  {
    svg: 'og-image.svg',
    outputs: [
      ['og-image.png', 1200, 630],
    ],
  },
  {
    svg: 'og-image-audit.svg',
    outputs: [
      ['og-image-audit.png', 1200, 630],
    ],
  },
  {
    svg: 'x-header.svg',
    outputs: [
      ['x-header.png', 1500, 500],
    ],
  },
  {
    svg: 'favicon.svg',
    outputs: [
      ['favicon-32.png', 32, 32],
      ['favicon-180.png', 180, 180],
      ['favicon-192.png', 192, 192],
      ['favicon-512.png', 512, 512],
    ],
  },
  {
    // Maskable variant — single centred sparkle scaled to ~64% so iOS
    // adaptive-icon cropping (~80% safe zone) doesn't clip the brand mark.
    // Both sizes are referenced in manifest.webmanifest with purpose: "maskable".
    svg: 'favicon-maskable.svg',
    outputs: [
      ['favicon-maskable-192.png', 192, 192],
      ['favicon-maskable-512.png', 512, 512],
    ],
  },
  {
    // Apple Touch Icon variant — flat square (no SVG corner rounding),
    // sparkle at ~75% so iOS's own corner mask doesn't double-round.
    // Referenced by <link rel="apple-touch-icon"> in index.html.
    svg: 'favicon-apple-touch.svg',
    outputs: [
      ['favicon-apple-touch-180.png', 180, 180],
    ],
  },
];

async function regenOne(svgFile, [outFile, width, height]) {
  const svgPath = path.join(PUB, svgFile);
  const outPath = path.join(PUB, outFile);
  if (!fs.existsSync(svgPath)) {
    throw new Error(`SVG missing: ${svgPath}`);
  }
  const buf = fs.readFileSync(svgPath);
  // density:300 gives crisp rasterization for text-heavy SVGs.
  await sharp(buf, { density: 300 }).resize(width, height).png({ quality: 90 }).toFile(outPath);
  const stat = fs.statSync(outPath);
  console.log(`  ✓ ${outFile.padEnd(24)} ${width}×${height}  ${stat.size.toString().padStart(7)} B`);
}

async function main() {
  console.log('🎨 Regenerating PNG renders from SVG sources...\n');
  let errors = 0;
  for (const group of RENDERS) {
    console.log(`📄 ${group.svg}`);
    for (const out of group.outputs) {
      try {
        await regenOne(group.svg, out);
      } catch (e) {
        console.error(`  ✗ ${out[0]}: ${e.message}`);
        errors++;
      }
    }
  }
  console.log();
  if (errors) {
    console.error(`❌ ${errors} render(s) failed.`);
    process.exit(1);
  }
  console.log('✅ All PNG renders refreshed.');
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
