// Express app factory. Exports a configured app without starting a listener,
// so tests can mount it in-process via supertest while production uses
// index.js to bind it to a port and run the full boot sequence.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const pathLib = require('path');

// Resolve the app version once at boot. Priority:
//   1. APP_VERSION env (Railway can set this from $RAILWAY_GIT_COMMIT_SHA)
//   2. server/package.json#version (semantic version string)
//   3. 'dev' as the last-resort fallback
// Cached at module load — version doesn't change at runtime.
let _appVersion = null;
function getAppVersion() {
  if (_appVersion) return _appVersion;
  if (process.env.APP_VERSION) {
    _appVersion = process.env.APP_VERSION;
    return _appVersion;
  }
  try {
    const pkgPath = pathLib.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.version) {
      _appVersion = pkg.version;
      return _appVersion;
    }
  } catch { /* fall through */ }
  _appVersion = 'dev';
  return _appVersion;
}

// Compute the SHA-256 hash of the inline theme-flash script in client/index.html
// at boot time, so CSP automatically tracks edits to that script (no manual
// hash bumping). Falls back to a hardcoded hash if the file isn't present
// (test runs without a built client). The hash format is what helmet's
// scriptSrc directive expects: 'sha256-<base64>'.
function computeInlineScriptHash() {
  // Look in two places: the built client SPA (CLIENT_DIST_DIR or ../client-dist
  // when SERVE_CLIENT=1) and the source-of-truth at client/index.html.
  const candidates = [
    process.env.CLIENT_DIST_DIR && pathLib.join(process.env.CLIENT_DIST_DIR, 'index.html'),
    pathLib.join(__dirname, '..', 'client-dist', 'index.html'),
    pathLib.join(__dirname, '..', '..', 'client', 'index.html'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const html = fs.readFileSync(p, 'utf8');
      // Match the FIRST inline <script>...</script> with no src attribute.
      // The theme-flash script is the only inline script in index.html;
      // all other scripts are external (type="module" src=...).
      const m = html.match(/<script>\s*([\s\S]+?)\s*<\/script>/);
      if (!m) continue;
      const hash = crypto.createHash('sha256').update(m[1]).digest('base64');
      return `'sha256-${hash}'`;
    } catch { /* try next candidate */ }
  }
  // Hardcoded fallback (matches the script as-of 2026-04-27); kept so test
  // boots without a client/ checkout still succeed.
  return "'sha256-NSs+hzMhH+NczQN/UN0+Sl/EWmV2lnPzMCeXmqiPIvk='";
}
const INLINE_SCRIPT_HASH = computeInlineScriptHash();

function createApp() {
  const app = express();

  // Trust first proxy in production (Vercel, nginx, etc.) so rate limiting
  // and IP detection work correctly behind a reverse proxy.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // The hash allows ONE specific inline script in index.html that
        // applies the dark/light class before React mounts — prevents a
        // theme-flash on first paint. The hash is auto-computed at boot
        // from the actual built index.html (see computeInlineScriptHash
        // above), so editing the inline script no longer requires manually
        // bumping the hash here — would silently re-block the theme-flash
        // and re-introduce the white-flash regression for dark-mode users.
        // plausible.io serves the analytics script tag <script defer src="...">
        // when Plausible is enabled. Allowed here so the snippet works without
        // a CSP redeploy.
        scriptSrc: ["'self'", INLINE_SCRIPT_HASH, 'https://plausible.io', 'https://widget.frill.co'],
        // Google Fonts: CSS from fonts.googleapis.com, woff2 from fonts.gstatic.com.
        // Without these in style-src/font-src, the editorial typography
        // (Instrument Serif / Inter Tight / JetBrains Mono) silently falls
        // back to system sans-serif on every page — visible regression.
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https://*.frill.co', 'https://*.frillcdn.com'],
        // connect-src additions:
        // - *.ingest.us.sentry.io / *.ingest.sentry.io: frontend Sentry SDK
        //   POST /envelope/ events from the browser. Without this the SDK
        //   tries the request and is silently blocked by the browser.
        // - plausible.io: Plausible analytics script POSTs page-views to
        //   /api/event. Pre-allowed so the user can drop in the snippet
        //   without redeploying CSP.
        connectSrc: [
          "'self'",
          'https://*.ingest.us.sentry.io',
          'https://*.ingest.sentry.io',
          'https://plausible.io',
          'https://api.frill.co',
        ],
        // Frill loads suggestion images and avatars; allow data: + frill-cdn.
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // In production, silently upgrade any stray http:// URL to https://
        // (browsers don't render mixed content anyway, but this prevents the
        // request from even being attempted → saves the roundtrip and avoids
        // any referrer leak). Skipped in dev so local http dev servers work.
        ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
    hidePoweredBy: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
    permittedCrossDomainPolicies: false,
  }));

  app.use((req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=()'
    );
    next();
  });
  app.use(compression());
  app.use((req, res, next) => {
    const reqId = req.headers['x-request-id'];
    if (reqId && /^[a-z0-9]{1,32}$/.test(reqId)) {
      res.setHeader('X-Request-Id', reqId);
    }
    next();
  });
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

  // Billing webhook: receives RAW body for HMAC signature verification.
  // Must be mounted BEFORE express.json() or the body is consumed as parsed
  // JSON and the signature check fails. We mount just this one route with
  // express.raw() — every other route gets the normal JSON parser below.
  //
  // Rate-limited per-IP to blunt a signature-spraying attack. Legitimate LS
  // webhooks arrive a handful per minute at most; 60/min/IP leaves generous
  // headroom even during a bulk subscription-change event.
  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
  });
  app.post(
    '/api/billing/webhook',
    webhookLimiter,
    express.raw({ type: '*/*', limit: '1mb' }),
    (req, res, next) => {
      // Billing router exports its webhook handler directly so we can mount
      // it here with express.raw() without JSON-parsing the body (HMAC
      // verification needs the raw bytes).
      const { webhookHandler } = require('./routes/billing');
      return webhookHandler(req, res, next);
    }
  );

  app.use(express.json({ limit: '50kb' }));
  // Parse Cookie headers so readSessionCookie() in middleware/auth can read
  // the httpOnly session cookie. No signing key needed — the cookie VALUE
  // is a JWT that's already signed.
  app.use(cookieParser());

  // CSRF defence for state-changing requests. With SameSite=Lax on the
  // session cookie, cross-site GET/HEAD/OPTIONS navigation still carries
  // the cookie (expected), but cross-site form POSTs do NOT. Attackers
  // could still try cross-origin fetches with credentials — those are
  // rejected here unless they carry an X-Requested-With header, which
  // simple-request rules prevent cross-origin scripts from sending without
  // an explicit CORS preflight (and our CORS policy only allows the
  // configured CLIENT_URL). This is the standard double-submit-cookie
  // pattern minus the cookie — the custom header alone is enough given
  // our CORS + SameSite policy.
  const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
  app.use((req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    // Skip CSRF check for Bearer-authenticated requests — they come from
    // non-browser clients (curl, scripts, mobile apps) that aren't subject
    // to CSRF, and don't send cookies.
    const hasBearer = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
    if (hasBearer) return next();
    // If no session cookie is present, auth middleware will reject anyway —
    // let that happen with a clearer error. CSRF only applies to cookie-auth.
    if (!req.cookies || !req.cookies.rh_session) return next();
    // Require the custom header. Browsers from other origins can't set this
    // without a CORS preflight; our CORS policy doesn't allow other origins.
    const xrw = req.headers['x-requested-with'];
    if (xrw !== 'XMLHttpRequest') {
      return res.status(403).json({ error: 'CSRF check failed' });
    }
    next();
  });
  // Default Cache-Control for /api/* responses. User-specific JSON shouldn't
  // be cached by browsers or intermediate proxies — without an explicit
  // header, browser heuristic caching can serve stale data, and a
  // misconfigured CDN could cross-leak responses between users. Routes that
  // genuinely benefit from caching (publicWidget, plans, public reviews
  // feed) explicitly call setHeader to override this default — Express's
  // setHeader replaces, so the override wins.
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    next();
  });

  // In-memory request metrics (counts + latency percentiles). Exposed to the
  // operator at /api/admin/metrics. Mounted after body parsing so req.route
  // is populated by the time we record the bucket.
  const metrics = require('./lib/metrics');
  app.use(metrics.middleware());

  morgan.token('req-id', (req) => req.headers['x-request-id'] || '-');
  // Override morgan's :url token to strip sensitive query params before
  // logging. The default :url echoes req.originalUrl verbatim, which
  // means /api/auth/unsubscribe?token=... and the OAuth callback's
  // ?code=&state= get written to stdout (and onward to Railway's log
  // aggregator, etc.). Reuse the same sanitizer the global error
  // middleware uses so redaction is consistent across surfaces.
  const { sanitizePath } = require('./lib/sanitizePath');
  morgan.token('url', (req) => sanitizePath(req.originalUrl || req.url));
  // Skip request logging in tests — test runners render cleaner without it.
  if (process.env.NODE_ENV !== 'test') {
    // Production uses a tweaked combined format: same fields as Apache
    // combined, but the URL token is the redacted one. The default
    // combined format inlines :method :url, so by overriding the :url
    // token above we cover it without rewriting the format string.
    const logFormat = process.env.NODE_ENV === 'production'
      ? 'combined'
      : ':method :url :status :response-time ms [:req-id]';
    app.use(morgan(logFormat));
  }

  // The /api/auth limiter is a wide-net defence for brute-forcing login or
  // spraying registration. Individual routes add tighter limits on top.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    // In tests, skip the limiter so fixtures can create many users rapidly.
    skip: () => process.env.NODE_ENV === 'test',
  });

  // Public widget endpoint — no auth needed, registered before auth routes
  app.use('/api/public', require('./routes/publicWidget'));

  app.use('/api/auth', authLimiter, require('./routes/auth'));
  app.use('/api/admin', require('./routes/admin'));
  // Admin sub-router for business-claim approvals (same admin-email gate)
  app.use('/api/admin/claims', require('./routes/businessClaims').adminRouter);
  app.use('/api/reviews', require('./routes/reviews'));
  // Owner public responses on reviews (POST/PUT/DELETE/GET /:id/response).
  // Mounted on the same /api/reviews prefix; Express resolves the more
  // specific /:id/response paths against this router, while bare /:id
  // routes (PUT pin/flag/etc.) still hit the main reviews router above.
  app.use('/api/reviews', require('./routes/reviewResponses'));
  app.use('/api/tags', require('./routes/tags'));
  app.use('/api/review-requests', require('./routes/reviewRequests'));
  app.use('/api/auto-rules', require('./routes/autoRules'));
  app.use('/api/businesses', require('./routes/businesses'));
  // Claim flow lives on the same /api/businesses prefix
  app.use('/api/businesses', require('./routes/businessClaims'));
  app.use('/api/templates', require('./routes/templates'));
  app.use('/api/platforms', require('./routes/platforms'));
  app.use('/api/webhooks', require('./routes/webhooks'));
  app.use('/api/plans', require('./routes/plans'));
  // Note: /api/billing/webhook is already mounted above with raw body.
  // The rest of the billing routes (checkout, portal) get JSON parsed
  // requests via the standard pipeline.
  app.use('/api/billing', require('./routes/billing'));
  app.use('/api/apikeys', require('./routes/apiKeys'));
  app.use('/api/support', require('./routes/support'));
  app.use('/api/extension', require('./routes/extension'));
  app.use('/api/gdpr', require('./routes/gdpr'));
  app.use('/api/owner', require('./routes/owner'));
  app.use('/api/inbound', require('./routes/inbound'));

  // Health check. Returns 200 when all critical dependencies respond, 503 when
  // any of them is down. Structure is stable so load balancers / uptime
  // monitors can alert on `ok: false` without parsing detail. Individual
  // component fields surface which dep is broken when something fails.
  app.get('/api/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const components = {
      db: 'unknown',
      smtp: 'unknown',
      ai: 'unknown',
      billing: 'unknown',
      sentry: 'unknown',
      analytics: 'unknown',
      line: 'unknown',
      frill: 'unknown',
      promptpay: 'unknown',
      inbound_email: 'unknown',
    };
    let overallOk = true;

    // DB — load-bearing. A failure here is a hard 503.
    try {
      const { get } = require('./db/schema');
      const row = get('SELECT 1 as ok');
      components.db = row ? 'ok' : 'error';
      if (!row) overallOk = false;
    } catch (err) {
      components.db = 'error';
      // Never echo err.message to the public health endpoint in production —
      // SQLite errors can include filesystem paths, table/column names, or
      // schema metadata that help an attacker fingerprint the deployment. In
      // dev/test we keep the detail to make debugging painless. The full
      // error still flows through captureException via the global handler if
      // the DB also fails on a real request.
      if (process.env.NODE_ENV !== 'production') {
        components.db_error = err.message;
      }
      overallOk = false;
    }

    // SMTP — advisory. 'configured' means env is set; the actual TCP probe
    // happens at boot via verifySmtp(). 'console-fallback' is a valid state
    // for dev (emails log to stdout instead of being sent).
    components.smtp = process.env.SMTP_HOST ? 'configured' : 'console-fallback';

    // AI drafts — advisory. 'live' = real Anthropic API key wired,
    // 'mock' = built-in template/mock client (still functional, just not
    // calling a real LLM). Useful for ops dashboards: a sudden flip from
    // 'live' to 'mock' on a given env means someone removed the key.
    if (process.env.ANTHROPIC_MOCK === '1') {
      components.ai = 'mock-forced';
    } else if (process.env.ANTHROPIC_API_KEY) {
      components.ai = 'live';
    } else if (process.env.NODE_ENV === 'production') {
      // Prod without an API key falls back to template-only — flag it so
      // operators notice. Not a hard failure since drafts still work.
      components.ai = 'template-fallback';
    } else {
      components.ai = 'mock-dev';
    }

    // Billing — advisory. 'configured' means LS creds AND at least one
    // variant ID are set, so /checkout can actually issue a real session.
    // Without variants, the route 400s with "billing not configured."
    const lsKey = process.env.LEMONSQUEEZY_API_KEY;
    const lsStore = process.env.LEMONSQUEEZY_STORE_ID;
    const hasAnyVariant = !!(
      process.env.LS_VARIANT_STARTER_MONTHLY ||
      process.env.LS_VARIANT_PRO_MONTHLY ||
      process.env.LS_VARIANT_BUSINESS_MONTHLY
    );
    if (lsKey && lsStore && hasAnyVariant) {
      components.billing = 'configured';
    } else if (lsKey || lsStore) {
      components.billing = 'partial'; // half-configured, /checkout likely 400s
    } else {
      components.billing = 'free-only';
    }

    // Sentry — advisory. Frontend SDK reads VITE_SENTRY_DSN at build time;
    // server forwarder uses SENTRY_DSN at runtime. Either being set means
    // error reporting is wired. Operators see drift if env vars get unset.
    components.sentry = (process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN)
      ? 'configured'
      : 'not-configured';

    // Plausible — auto-injects on production hostname only. We can only
    // confirm intent via NODE_ENV; the actual injection happens client-side.
    components.analytics = process.env.NODE_ENV === 'production'
      ? 'plausible-auto-inject'
      : 'dev-disabled';

    // LINE Messaging — owner push notifications. Both env vars required.
    components.line = (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_OWNER_USER_ID)
      ? 'configured'
      : 'not-configured';

    // Frill — feedback widget. Build-time env, but we can detect intent.
    components.frill = process.env.VITE_FRILL_KEY ? 'configured' : 'not-configured';

    // PromptPay — Thai instant-transfer QR. Single env var.
    components.promptpay = process.env.PROMPTPAY_ID ? 'configured' : 'not-configured';

    // Inbound email — auto-import via forwarded review notifications.
    // 'configured' = Mailgun signing key set; the endpoint will accept webhooks.
    // 'not-configured' = endpoint returns 401 (intentional — secret-only addresses
    //   still resolve via /api/inbound/address, just no live mail flow yet).
    components.inbound_email = process.env.MAILGUN_WEBHOOK_SIGNING_KEY ? 'configured' : 'not-configured';

    const payload = {
      ok: overallOk,
      ts: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      version: getAppVersion(),
      components,
    };
    res.status(overallOk ? 200 : 503).json(payload);
  });

  app.use('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Optional: serve the built React SPA from this same process. Controlled by
  // SERVE_CLIENT=1 so dev (where Vite serves on :5173) and tests don't get
  // affected. Production Dockerfile copies the built dist/ to /app/client-dist
  // and sets this env var, giving us a single-service deploy topology
  // (one Railway / Fly / VPS service handles both /api/* and the SPA) without
  // needing a separate nginx or reverse proxy.
  if (process.env.SERVE_CLIENT === '1') {
    const path = require('path');
    const fs = require('fs');
    const clientDist = process.env.CLIENT_DIST_DIR || path.join(__dirname, '..', 'client-dist');
    if (fs.existsSync(clientDist)) {
      // Hashed asset bundles (/assets/index-abcd.js) can cache for a year —
      // filename changes on content change. index.html itself must not cache.
      app.use('/assets', express.static(path.join(clientDist, 'assets'), {
        immutable: true,
        maxAge: '1y',
      }));
      app.use(express.static(clientDist, {
        index: false, // we route / manually below so we can set no-cache on HTML
        maxAge: '1d',
        // Try `<path>.html` for extension-less URLs before falling through
        // to the SPA fallback. Lets /blog/reply-1-star-google-review-th
        // serve the static HTML file at /blog/reply-1-star-google-review-th.html
        // without forcing the .html in the URL the user sees.
        extensions: ['html'],
      }));
      // SPA fallback: anything not matching /api/* or a static asset gets
      // index.html so client-side routing handles /dashboard, /settings, etc.
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(clientDist, 'index.html'));
      });
      console.log(`[APP] Serving client SPA from ${clientDist}`);
    } else {
      console.warn(`[APP] SERVE_CLIENT=1 but ${clientDist} does not exist — client not served`);
    }
  }

  const { captureException } = require('./lib/errorReporter');
  // sanitizePath was already required above for the morgan :url token.
  app.use((err, req, res, next) => {
    const errorId = Date.now().toString(36);
    captureException(err, {
      errorId,
      method: req.method,
      path: sanitizePath(req.originalUrl),
      userId: req.user?.id,
      requestId: req.headers['x-request-id'] || undefined,
    });
    res.status(500).json({ error: 'Internal server error', errorId });
  });

  return app;
}

module.exports = { createApp };
