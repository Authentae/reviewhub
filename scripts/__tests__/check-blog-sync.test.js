// Tests for scripts/check-blog-sync.js — the pre-commit guard that catches
// blog HTML / sitemap.xml / feed.xml / BlogIndex.jsx drift.
//
// Why test a script that we hand-wrote? Because it's wired into the
// pre-commit hook (cycle 13 of 2026-05-19), which means a regression in
// the regex / file paths could either:
//   (a) silently pass when blog files ARE out of sync (worse — the whole
//       point of the guard is to catch this), or
//   (b) wrongly fail on healthy commits (annoying — blocks legitimate work)
//
// Strategy: spawn the script with `node scripts/check-blog-sync.js` against
// the real repo state. On commit the repo is always in-sync (the guard
// only runs locally and CI doesn't care), so this test asserts exit 0.
// A second test wraps the script's modules and feeds a tampered input
// to assert it would detect drift.

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-blog-sync.js');

test('exits 0 when blog HTML, sitemap, feed and BlogIndex are all in sync', () => {
  // The repo state at test time is the committed state, which is always
  // in-sync (the pre-commit hook enforces this on every commit).
  const out = execFileSync('node', [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /✅.*in sync/, `expected success line, got: ${out}`);
});

test('exits 1 when a blog HTML exists with no matching sitemap entry', () => {
  // Create a temporary fake blog HTML that nothing else references,
  // run the script, expect non-zero. Clean up after.
  const BLOG_DIR = path.join(ROOT, 'client', 'public', 'blog');
  const fakeName = `test-sync-fixture-${process.pid}-${Date.now()}`;
  const fakePath = path.join(BLOG_DIR, `${fakeName}.html`);
  // Minimal valid HTML — content doesn't matter, just needs to exist.
  fs.writeFileSync(fakePath, '<!doctype html><html><body>test</body></html>');
  try {
    let exitCode = 0;
    let stderr = '';
    try {
      execFileSync('node', [SCRIPT], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      exitCode = e.status || 1;
      stderr = (e.stderr || '').toString();
    }
    assert.strictEqual(exitCode, 1, 'script should exit 1 when out-of-sync');
    assert.match(stderr, new RegExp(fakeName), 'error output should name the missing slug');
    assert.match(stderr, /sitemap\.xml is MISSING/, 'should call out sitemap.xml specifically');
  } finally {
    // Always clean up the fixture, even if the test fails.
    try { fs.unlinkSync(fakePath); } catch { /* already gone */ }
  }
});

test('finds the three indexes by their canonical paths', () => {
  // Sanity check — confirm the script's hard-coded paths still resolve.
  // If someone renames sitemap.xml or moves BlogIndex.jsx, this test
  // surfaces it as a script error, not a silent never-checks-anything bug.
  const REQUIRED_FILES = [
    path.join(ROOT, 'client', 'public', 'blog'),
    path.join(ROOT, 'client', 'public', 'sitemap.xml'),
    path.join(ROOT, 'client', 'public', 'feed.xml'),
    path.join(ROOT, 'client', 'src', 'pages', 'BlogIndex.jsx'),
  ];
  for (const p of REQUIRED_FILES) {
    assert.ok(fs.existsSync(p), `index file missing or moved: ${p}`);
  }
});
