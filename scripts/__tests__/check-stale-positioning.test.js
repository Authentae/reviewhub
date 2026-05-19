// Tests for scripts/check-stale-positioning.js — pre-commit guard that
// catches Chrome-extension / iOS-app references sneaking back into the
// client. The product dropped those features, but old copy keeps
// resurfacing from i18n keys / marketing pages.
//
// Same meta-test rationale as scripts/__tests__/check-blog-sync.test.js:
// the script is wired into the pre-commit hook, so a regression in the
// regex would either silently pass (we re-accumulate stale references)
// or wrongly fail healthy commits.

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-stale-positioning.js');

function runScript() {
  try {
    const stdout = execFileSync('node', [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return {
      code: e.status || 1,
      stdout: (e.stdout || '').toString(),
      stderr: (e.stderr || '').toString(),
    };
  }
}

test('exits 0 on the committed client source (no stale references)', () => {
  const r = runScript();
  assert.strictEqual(r.code, 0, `expected exit 0, got ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
});

test('exits 1 when a file in scope adds a "Chrome extension" reference', () => {
  // Inject a fixture file under client/src/components/ that contains the
  // forbidden phrase. Verify the script catches it. Clean up after.
  const fixturePath = path.join(ROOT, 'client', 'src', 'components', `_stale_test_${process.pid}_${Date.now()}.jsx`);
  fs.writeFileSync(
    fixturePath,
    'export default function Test() { return <span>Try our Chrome extension!</span>; }\n'
  );
  try {
    const r = runScript();
    assert.strictEqual(r.code, 1, 'should fail when a Chrome extension reference is present');
    assert.match(r.stdout + r.stderr, /Chrome extension/i, 'output should name the offending phrase');
  } finally {
    try { fs.unlinkSync(fixturePath); } catch { /* already gone */ }
  }
});

test('exits 1 when an "iOS app" reference is added', () => {
  const fixturePath = path.join(ROOT, 'client', 'src', 'components', `_stale_ios_${process.pid}_${Date.now()}.jsx`);
  fs.writeFileSync(
    fixturePath,
    'export default function Test() { return <a href="#">Download the iOS app</a>; }\n'
  );
  try {
    const r = runScript();
    assert.strictEqual(r.code, 1, 'should fail when an iOS app reference is present');
    assert.match(r.stdout + r.stderr, /native app|iOS app/i, 'output should flag the iOS app reference');
  } finally {
    try { fs.unlinkSync(fixturePath); } catch { /* already gone */ }
  }
});

test('whitelist comments ("archived" / "HISTORICAL") suppress the warning', () => {
  // A line that mentions Chrome extension but also includes a whitelist
  // marker should NOT fail the script — the whole point of the
  // whitelist is to let historical-reference comments through.
  const fixturePath = path.join(ROOT, 'client', 'src', 'components', `_stale_archived_${process.pid}_${Date.now()}.jsx`);
  fs.writeFileSync(
    fixturePath,
    '// archived: we shipped a Chrome extension in 2024 and dropped it 2025-Q4\nexport default function T() { return null; }\n'
  );
  try {
    const r = runScript();
    assert.strictEqual(r.code, 0, `whitelisted line should pass, got code ${r.code}\n${r.stdout}\n${r.stderr}`);
  } finally {
    try { fs.unlinkSync(fixturePath); } catch { /* already gone */ }
  }
});

test('Roadmap.jsx and Changelog.jsx are file-whitelisted', () => {
  // These pages legitimately reference future/historical scope (roadmap)
  // and past ships (changelog). Inject the forbidden phrase into one of
  // them and verify the script DOESN'T flag it — it's expected there.
  // Use Changelog.jsx since it actually exists in the repo.
  const target = path.join(ROOT, 'client', 'src', 'pages', 'Changelog.jsx');
  if (!fs.existsSync(target)) {
    // Skip if Changelog.jsx ever gets moved/deleted — test would false-fail.
    return;
  }
  const original = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(target, original + '\n// stale-test: our old Chrome extension shipped 2024-11.\n');
  try {
    const r = runScript();
    assert.strictEqual(r.code, 0, 'Changelog.jsx should be file-whitelisted from the scan');
  } finally {
    fs.writeFileSync(target, original);
  }
});
