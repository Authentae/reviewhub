const fs = require('fs');
const path = require('path');

function listJsx(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (!['node_modules', 'dist', '__tests__'].includes(f.name)) out.push(...listJsx(p));
    } else if (/\.(jsx|tsx|js)$/.test(f.name)) out.push(p);
  }
  return out;
}

const root = path.resolve(__dirname, '..');
const files = listJsx(path.join(root, 'client/src'));
const importedTargets = new Set();

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /import\s+(?:\w+|\{[^}]+\}|\*\s+as\s+\w+)?\s*(?:,\s*(?:\w+|\{[^}]+\}))?\s+from\s+['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    const from = m[1];
    if (!from.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(f), from);
    for (const ext of ['', '.jsx', '.js', '.tsx', '.ts', '/index.jsx', '/index.js']) {
      const t = resolved + ext;
      if (fs.existsSync(t) && fs.statSync(t).isFile()) {
        importedTargets.add(t);
        break;
      }
    }
  }
  // dynamic imports
  const reDyn = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of src.matchAll(reDyn)) {
    const from = m[1];
    if (!from.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(f), from);
    for (const ext of ['', '.jsx', '.js', '.tsx', '.ts']) {
      const t = resolved + ext;
      if (fs.existsSync(t) && fs.statSync(t).isFile()) {
        importedTargets.add(t);
        break;
      }
    }
  }
}

const orphans = files.filter(f => {
  if (importedTargets.has(f)) return false;
  if (/main\.jsx$|App\.jsx$|setup\.js$/.test(f)) return false;
  return true;
});

console.log(`scanned ${files.length} files, ${importedTargets.size} unique imports`);
console.log(`orphans (never statically or dynamically imported): ${orphans.length}\n`);
for (const o of orphans) {
  const rel = path.relative(root, o);
  const sizeKb = (fs.statSync(o).size / 1024).toFixed(1);
  console.log(`  ${sizeKb.padStart(6)} KB  ${rel}`);
}
