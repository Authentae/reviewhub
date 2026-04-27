// Strip sensitive query-string params from a URL before forwarding it to
// error reports. The token=... form is the single-use credential for
// verify-email / reset-password / unsubscribe / OAuth callback flows; if
// an exception fires inside one of those requests, sending the URL
// verbatim to Sentry/log aggregators leaks the token to anyone with log
// access (they could replay-take-over the account or unsubscribe arbitrary
// users).
//
// Whitelist of param names treated as sensitive — anything else passes
// through so operators retain useful debugging signal (page=, sort=, etc.).
const SENSITIVE_QUERY_PARAMS = new Set(['token', 'code', 'state', 'signature']);

function sanitizePath(originalUrl) {
  if (typeof originalUrl !== 'string') return originalUrl;
  const qIdx = originalUrl.indexOf('?');
  if (qIdx < 0) return originalUrl;
  const pathPart = originalUrl.slice(0, qIdx);
  const queryPart = originalUrl.slice(qIdx + 1);
  const cleaned = queryPart
    .split('&')
    .map((kv) => {
      const eqIdx = kv.indexOf('=');
      const key = eqIdx < 0 ? kv : kv.slice(0, eqIdx);
      return SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())
        ? `${key}=[REDACTED]`
        : kv;
    })
    .join('&');
  return cleaned ? `${pathPart}?${cleaned}` : pathPart;
}

module.exports = { sanitizePath, SENSITIVE_QUERY_PARAMS };
