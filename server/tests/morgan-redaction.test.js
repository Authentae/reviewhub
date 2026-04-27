// Regression test for the morgan :url-token override that strips
// sensitive query params before they hit stdout.
//
// Captures morgan's emitted log line via its `stream` option and asserts
// the URL is redacted before being written. End-to-end coverage that
// the wiring in app.js actually applies sanitizePath to the :url token.

const test = require('node:test');
const assert = require('node:assert');

// Require app first so app.js's top-level `morgan.token('url', ...)`
// registration runs before we use morgan ourselves.
require('./helpers');
require('../src/app').createApp();

const morgan = require('morgan');

function captureMorganUrl(originalUrl) {
  let captured = '';
  const stream = { write: (line) => { captured += line; } };
  // Use a dirt-simple format that emits ONLY the :url token so we can
  // assert on its post-redaction value.
  const middleware = morgan(':url', { stream, immediate: true });
  const req = { method: 'GET', headers: {}, originalUrl, url: originalUrl };
  const res = {};
  // immediate: true runs before the response, no need for res.on('finish').
  middleware(req, res, () => {});
  return captured.trim();
}

test('morgan :url token redacts sensitive params', () => {
  const t1 = captureMorganUrl('/api/auth/unsubscribe?token=abc123');
  assert.match(t1, /token=\[REDACTED\]/);
  assert.doesNotMatch(t1, /abc123/);

  const t2 = captureMorganUrl('/api/platforms/google/oauth/callback?code=4%2F0AY&state=xyz');
  assert.match(t2, /code=\[REDACTED\]/);
  assert.match(t2, /state=\[REDACTED\]/);

  // safe params untouched
  const t3 = captureMorganUrl('/api/reviews?page=2&sort=newest');
  assert.strictEqual(t3, '/api/reviews?page=2&sort=newest');

  // path with no query string is unchanged
  const t4 = captureMorganUrl('/api/dashboard');
  assert.strictEqual(t4, '/api/dashboard');
});
