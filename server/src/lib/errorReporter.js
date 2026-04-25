// Centralised error-reporting abstraction.
//
// Today: writes structured JSON to stderr in production (so CloudWatch,
// Datadog, or any log aggregator can index fields), plain text in dev for
// readability. If SENTRY_DSN is set the error is also forwarded to Sentry
// via a lightweight HTTP store-endpoint call — no SDK dependency, so we
// don't pay for it when the operator hasn't opted in.
//
// Every call site already does `console.error(err)` today; this lets us
// upgrade the destination in one place.

const SERVICE = 'reviewhub-api';

function serializeError(err) {
  if (!err) return { message: String(err) };
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err.code ? { code: err.code } : {}),
      ...(err.errorId ? { errorId: err.errorId } : {}),
    };
  }
  return { message: String(err) };
}

function captureException(err, context = {}) {
  const record = {
    level: 'error',
    service: SERVICE,
    ts: new Date().toISOString(),
    error: serializeError(err),
    ...context,
  };
  if (process.env.NODE_ENV === 'production') {
    // Machine-readable single-line JSON. Log aggregators auto-parse.
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(record));
  } else {
    // Human-readable — tests and local dev.
    // eslint-disable-next-line no-console
    console.error(
      `[ERROR${record.errorId ? ':' + record.errorId : ''}]`,
      err?.stack || err,
      Object.keys(context).length ? context : ''
    );
  }
  // Forward to Sentry if DSN is configured. Fire-and-forget — we never
  // block the caller on external availability.
  forwardToSentry(record).catch(() => { /* swallow — can't error-report errors */ });
}

// Minimal Sentry envelope-endpoint forwarder. Avoids taking on @sentry/node as
// a runtime dep: the store API accepts a simple JSON payload. If the DSN is
// malformed we silently skip; it's diagnostic, not load-bearing.
//
// DSN format: https://<publicKey>@<host>/<projectId>
async function forwardToSentry(record) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  let publicKey, host, projectId;
  try {
    const u = new URL(dsn);
    publicKey = u.username;
    host = u.host;
    projectId = u.pathname.replace(/^\//, '');
    if (!publicKey || !host || !projectId) throw new Error('malformed DSN');
  } catch {
    // Log once per process; don't spam.
    if (!forwardToSentry._warned) {
      forwardToSentry._warned = true;
      // eslint-disable-next-line no-console
      console.warn('[errorReporter] SENTRY_DSN is set but malformed — skipping forward');
    }
    return;
  }

  const endpoint = `https://${host}/api/${projectId}/store/`;
  const payload = {
    event_id: record.errorId || (record.ts + Math.random()).replace(/[^a-z0-9]/gi, '').slice(0, 32),
    timestamp: record.ts,
    platform: 'node',
    level: 'error',
    logger: SERVICE,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || undefined,
    exception: {
      values: [
        {
          type: record.error.name || 'Error',
          value: record.error.message || String(record.error),
          stacktrace: record.error.stack ? { frames: parseStack(record.error.stack) } : undefined,
        },
      ],
    },
    tags: {
      kind: record.kind || undefined,
    },
    extra: Object.fromEntries(
      Object.entries(record).filter(([k]) => !['level', 'service', 'ts', 'error'].includes(k))
    ),
  };

  const authHeader = [
    'Sentry sentry_version=7',
    `sentry_key=${publicKey}`,
    `sentry_client=reviewhub-errorReporter/1.0`,
  ].join(', ');

  // 2-second timeout so a slow Sentry doesn't back up the event loop.
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 2000);
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': authHeader },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

// Very lightweight V8 stack-trace parser — good enough for Sentry to group
// and display. Real SDKs do source-map resolution; we don't.
function parseStack(stack) {
  return String(stack).split('\n').slice(1).map((line) => {
    const m = line.match(/at (?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
    if (!m) return { filename: line.trim() };
    return {
      function: m[1] || '<anonymous>',
      filename: m[2],
      lineno: Number(m[3]),
      colno: Number(m[4]),
    };
  }).reverse(); // Sentry wants oldest-first
}

// Install global handlers so unhandled rejections and uncaught exceptions
// land in the same reporter instead of being silently lost.
function installGlobalHandlers() {
  process.on('unhandledRejection', (reason) => {
    captureException(reason, { kind: 'unhandledRejection' });
  });
  process.on('uncaughtException', (err) => {
    captureException(err, { kind: 'uncaughtException' });
    // Uncaught exceptions leave the process in an unknown state; exit so the
    // supervisor (systemd, Docker) restarts us cleanly.
    process.exit(1);
  });
}

module.exports = { captureException, installGlobalHandlers };
