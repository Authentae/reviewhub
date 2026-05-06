#!/usr/bin/env node
// Scans client source for stale product-positioning references that
// contradict current scope. Currently catches: Chrome extension,
// iOS / Android app, Chrome Web Store. These were dropped from scope
// but old copy keeps surfacing in i18n keys, blog drafts, marketing
// pages.
//
// Run: node scripts/check-stale-positioning.js
// Exit 0 if clean, 1 with detailed file:line context if any caught.
//
// Whitelist: any line containing "archived", "HISTORICAL",
// "dropped", "extension-era", "// removed", or that's a deliberate
// note about the past (e.g. CLAUDE.md / wiki / launch README).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN = ['client/src/pages', 'client/src/components', 'client/src/i18n'];

// Files where future-state references are expected (roadmap, changelog
// historical entries, etc.).
const FILE_WHITELIST = [
  /Roadmap\.jsx$/,         // explicitly lists future / not-yet-built work
  /Changelog\.jsx$/,       // historical changelog entries can mention old scope
];

const FORBIDDEN = [
  { regex: /Chrome\s+extension|Add\s+to\s+Chrome|Chrome\s+Web\s+Store/i, kind: 'Chrome extension' },
  { regex: /\biOS\s+app|\bAndroid\s+app|App\s+Store|Play\s+Store/i, kind: 'native app' },
  { regex: /ส่วนขยาย\s*Chrome|ส่วนขยายของ\s*Chrome/i, kind: 'Chrome extension (TH)' },
];

const WHITELIST_LINE = [
  /archived/i,
  /HISTORICAL/i,
  /dropped/i,
  /extension-era/i,
  /\/\/\s*removed/i,
  /\/\*.*was dropped/i,
];

let total = 0;
let errors = 0;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) scanDir(full);
    else if (/\.(jsx?|tsx?)$/.test(ent.name)) scanFile(full);
  }
}

function scanFile(fp) {
  if (FILE_WHITELIST.some(r => r.test(fp))) return;
  total++;
  const lines = fs.readFileSync(fp, 'utf8').split('\n');
  const fileErrors = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (WHITELIST_LINE.some(r => r.test(line))) continue;
    for (const { regex, kind } of FORBIDDEN) {
      if (regex.test(line)) {
        // Check ±3 lines around this for whitelist context (comment block)
        const context = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        if (WHITELIST_LINE.some(r => r.test(context))) continue;
        fileErrors.push({ line: i + 1, kind, text: line.trim().slice(0, 120) });
      }
    }
  }
  if (fileErrors.length > 0) {
    errors += fileErrors.length;
    const rel = path.relative(ROOT, fp);
    console.error(`\n❌ ${rel}`);
    for (const e of fileErrors) {
      console.error(`   line ${e.line}  [${e.kind}]  ${e.text}`);
    }
  }
}

for (const dir of SCAN) {
  scanDir(path.join(ROOT, dir));
}

console.log(`\n${total} source files scanned.`);
if (errors > 0) {
  console.error(`${errors} stale positioning reference(s) found.`);
  process.exit(1);
} else {
  console.log('No stale positioning references.');
  process.exit(0);
}
