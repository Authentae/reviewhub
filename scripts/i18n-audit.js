// One-shot audit: find i18n keys used in code but missing from the en
// baseline (those will render as the literal key string, a real UX bug),
// AND find keys defined but never used (dead weight).
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'client/src/i18n/translations.js'), 'utf8');
const lines = src.split(/\r?\n/);
const enKeys = new Set();
let inEn = false;
for (const line of lines) {
  if (/^const en = \{/.test(line)) { inEn = true; continue; }
  if (inEn && /^\};/.test(line)) break;
  if (inEn) {
    const m = line.match(/^  '([\w.\-]+)':/);
    if (m) enKeys.add(m[1]);
  }
}
console.log('en keys:', enKeys.size);

const usedKeys = new Set();
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name === 'node_modules' || f.name === '__tests__') continue;
      walk(p);
    } else if (/\.(jsx?|tsx?)$/.test(f.name) && !f.name.includes('translations')) {
      const content = fs.readFileSync(p, 'utf8');
      const re = /\bt\(\s*['"`]([\w.\-]+)['"`]/g;
      for (const m of content.matchAll(re)) usedKeys.add(m[1]);
    }
  }
};
walk(path.join(__dirname, '..', 'client/src'));
console.log('used keys (t() calls):', usedKeys.size);

const missing = [...usedKeys].filter(k => !enKeys.has(k)).sort();
console.log('\nused but NOT in en (will render as literal key):', missing.length);
if (missing.length) console.log(missing.join('\n'));

const orphans = [...enKeys].filter(k => !usedKeys.has(k)).sort();
console.log('\ndefined in en but NEVER used (dead keys):', orphans.length);
if (orphans.length) console.log(orphans.slice(0, 50).join('\n'));
