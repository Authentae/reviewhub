// Unit tests for sanitizePath — the helper that strips sensitive query
// params (token, code, state, signature) before they reach Sentry/logs.
//
// This is the only line of defence between an exception inside the
// verify-email / reset-password / unsubscribe / OAuth-callback flows and
// the single-use token landing in an external observability tool.

const test = require('node:test');
const assert = require('node:assert');
const { sanitizePath } = require('../src/lib/sanitizePath');

test('sanitizePath', async (t) => {
  await t.test('passes through paths with no query string', () => {
    assert.strictEqual(sanitizePath('/api/dashboard'), '/api/dashboard');
    assert.strictEqual(sanitizePath('/'), '/');
  });

  await t.test('passes through non-sensitive query params unchanged', () => {
    assert.strictEqual(
      sanitizePath('/api/reviews?page=2&sort=newest&limit=20'),
      '/api/reviews?page=2&sort=newest&limit=20'
    );
  });

  await t.test('redacts token= param', () => {
    const out = sanitizePath('/verify-email?token=abc123def456');
    assert.strictEqual(out, '/verify-email?token=[REDACTED]');
  });

  await t.test('redacts code= param (OAuth callback)', () => {
    const out = sanitizePath('/api/platforms/google/oauth/callback?code=4%2F0AY0e&state=xyz');
    assert.match(out, /code=\[REDACTED\]/);
    assert.match(out, /state=\[REDACTED\]/);
    assert.doesNotMatch(out, /4%2F0AY0e/);
    assert.doesNotMatch(out, /=xyz/);
  });

  await t.test('redacts signature= param', () => {
    const out = sanitizePath('/api/billing/webhook?signature=hmac123');
    assert.strictEqual(out, '/api/billing/webhook?signature=[REDACTED]');
  });

  await t.test('preserves the position of redacted params alongside safe ones', () => {
    const out = sanitizePath('/foo?page=1&token=secret&sort=desc');
    assert.strictEqual(out, '/foo?page=1&token=[REDACTED]&sort=desc');
  });

  await t.test('case-insensitive on the param name', () => {
    assert.match(sanitizePath('/x?Token=s'), /Token=\[REDACTED\]/);
    assert.match(sanitizePath('/x?TOKEN=s'), /TOKEN=\[REDACTED\]/);
  });

  await t.test('handles flag-only params (no =) without crashing', () => {
    // e.g. ?token (no value) — still redact the key as a precaution.
    const out = sanitizePath('/x?token&page=1');
    assert.match(out, /token=\[REDACTED\]/);
    assert.match(out, /page=1/);
  });

  await t.test('preserves an empty query string edge case', () => {
    assert.strictEqual(sanitizePath('/x?'), '/x');
  });

  await t.test('passes through non-string input unchanged', () => {
    assert.strictEqual(sanitizePath(undefined), undefined);
    assert.strictEqual(sanitizePath(null), null);
  });

  await t.test('does NOT touch param values that merely contain "token" as substring', () => {
    // The key must equal one of the sensitive names exactly. A value like
    // ?next=/profile?token=... that's been double-encoded is safe — only
    // the outermost key matters here.
    const out = sanitizePath('/foo?next=token-page');
    assert.strictEqual(out, '/foo?next=token-page');
  });
});
