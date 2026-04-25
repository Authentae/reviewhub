// Routes for platform-connection management.
// GET  /            — list the current user's connections with sync status
// POST /sync        — trigger an immediate sync for all of the user's connections
// POST /:id/sync    — sync a single connection (user must own the underlying business)
//
// Connection rows are created implicitly when the user sets a platform ID on
// their business via PUT /businesses/:id. We don't expose a POST here for that
// because the existing businesses route is already the source of truth.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { syncOne, syncAll } = require('../jobs/syncReviews');
const { logAudit } = require('../lib/audit');

const router = express.Router();
router.use(authMiddleware);

// Rate limit the manual-sync button aggressively — one sync per minute per user
// is plenty, and protects us from a user spamming the button.
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  message: { error: 'Too many sync requests, please wait a moment' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: fetch the caller's active business, or null if they don't own one yet.
function getUserBusiness(userId) {
  const user = get('SELECT active_business_id FROM users WHERE id = ?', [userId]);
  if (user?.active_business_id) {
    return get('SELECT id FROM businesses WHERE id = ? AND user_id = ?', [user.active_business_id, userId]);
  }
  return get('SELECT id FROM businesses WHERE user_id = ? ORDER BY id ASC LIMIT 1', [userId]);
}

router.get('/', (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.json({ connections: [] });

    // Never leak tokens to the client — they're server-only secrets.
    const rows = all(
      `SELECT id, business_id, provider, external_account_id,
              last_synced_at, last_sync_error, reviews_synced_count, created_at
       FROM platform_connections
       WHERE business_id = ?
       ORDER BY provider`,
      [business.id]
    );
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ connections: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/sync', syncLimiter, async (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });
    const result = await syncAll({ businessId: business.id });
    res.setHeader('Cache-Control', 'no-store, private');
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/sync', syncLimiter, async (req, res) => {
  try {
    const connId = parseInt(req.params.id, 10);
    if (!Number.isInteger(connId) || connId <= 0) {
      return res.status(400).json({ error: 'Invalid connection id' });
    }
    // Ownership check: the connection must belong to a business owned by this user.
    const conn = get(
      `SELECT pc.id FROM platform_connections pc
       JOIN businesses b ON b.id = pc.business_id
       WHERE pc.id = ? AND b.user_id = ?`,
      [connId, req.user.id]
    );
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    const result = await syncOne(connId);
    res.setHeader('Cache-Control', 'no-store, private');
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Google OAuth flow ────────────────────────────────────────────────────
//
// Two routes: /google/oauth/start and /google/oauth/callback. The first is
// auth-required and initiates the OAuth dance; the second is NOT auth-required
// (Google redirects the browser here directly, without our session cookie
// following on same-site=strict) but validates a one-time state token we
// stashed in a short-lived cookie.

const googleOAuth = require('../lib/providers/googleOAuth');

// Short-lived cookie holding the OAuth state + the user id it was bound to.
// ~10 minutes is plenty for the user to complete the Google consent screen.
const OAUTH_STATE_COOKIE = 'rh_google_oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

router.get('/google/oauth/start', (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found — create one in Settings first' });
    if (!googleOAuth.isConfigured()) {
      return res.status(503).json({ error: 'Google OAuth is not configured on this deployment' });
    }

    const state = googleOAuth.generateState();
    // Store state + user id + business id in an httpOnly cookie scoped to
    // the OAuth callback path. The callback will validate the state matches
    // and identify the user from it (cookies from a top-level Google redirect
    // DO carry SameSite=Lax cookies, so this works).
    res.cookie(OAUTH_STATE_COOKIE, JSON.stringify({
      state,
      userId: req.user.id,
      businessId: business.id,
      expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: OAUTH_STATE_TTL_MS,
    });

    const url = googleOAuth.getAuthorizationUrl(state);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// OAuth callback. Google redirects the browser here with ?code=...&state=...
// Note: this is NOT wrapped in authMiddleware — Google's redirect is a top-
// level browser navigation and may not carry our session cookie in all
// configurations. Auth identity is proven via the state cookie we set.
// Remove the authMiddleware from this sub-route by re-declaring the handler
// on a router that doesn't have the authMiddleware applied.
const publicRouter = express.Router();
publicRouter.get('/google/oauth/callback', async (req, res) => {
  const base = process.env.CLIENT_URL || 'http://localhost:5173';
  const returnUrl = (ok, reason) => {
    const params = new URLSearchParams({ google: ok ? 'connected' : 'error' });
    if (reason) params.set('reason', reason);
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
    return res.redirect(`${base}/settings?${params.toString()}`);
  };

  try {
    const { code, state, error: googleError } = req.query;
    if (googleError) return returnUrl(false, 'denied'); // user clicked cancel
    if (!code || !state) return returnUrl(false, 'missing_params');

    // Validate state from cookie — defence against CSRF and replay.
    const cookieRaw = req.cookies?.[OAUTH_STATE_COOKIE];
    if (!cookieRaw) return returnUrl(false, 'state_missing');
    let parsed;
    try { parsed = JSON.parse(cookieRaw); } catch { return returnUrl(false, 'state_bad'); }
    // Constant-time compare — `!==` on strings short-circuits at the first
    // differing character, which theoretically leaks state bytes. State is
    // 48 hex chars = 192 bits, so the attack is implausible, but tokens.safeEqual
    // is the same cost and removes the worry.
    const { safeEqual } = require('../lib/tokens');
    if (typeof state !== 'string' || !safeEqual(parsed.state, state)) {
      return returnUrl(false, 'state_mismatch');
    }
    if (parsed.expiresAt < Date.now()) return returnUrl(false, 'state_expired');

    // Exchange code for tokens
    const tokens = await googleOAuth.exchangeCodeForTokens(code);

    // Upsert platform_connections for this (business, 'google')
    const existing = get(
      'SELECT id FROM platform_connections WHERE business_id = ? AND provider = ?',
      [parsed.businessId, 'google']
    );
    if (existing) {
      run(
        `UPDATE platform_connections
           SET access_token = ?, refresh_token = ?, token_expires_at = ?,
               external_account_id = COALESCE(external_account_id, ?)
         WHERE id = ?`,
        [tokens.access_token, tokens.refresh_token || null, tokens.expires_at,
         tokens.google_email || 'google_account', existing.id]
      );
    } else {
      // external_account_id is required NOT NULL on the schema. Before the
      // user picks a specific location we use their Google account email as
      // a placeholder — they'll later choose which Google location to sync
      // from if they have multiple.
      run(
        `INSERT INTO platform_connections (business_id, provider, external_account_id,
           access_token, refresh_token, token_expires_at)
         VALUES (?, 'google', ?, ?, ?, ?)`,
        [parsed.businessId, tokens.google_email || 'google_account',
         tokens.access_token, tokens.refresh_token || null, tokens.expires_at]
      );
    }

    // Mirror to the legacy businesses.google_place_id column for code paths
    // that still read it. We set it to the Google account email for now —
    // real Place ID discovery happens at first sync.
    run('UPDATE businesses SET google_place_id = COALESCE(google_place_id, ?) WHERE id = ?',
      [tokens.google_email || 'google_account', parsed.businessId]);

    logAudit({ ip: req.ip, headers: req.headers }, 'platform.connected', {
      userId: parsed.userId,
      metadata: { provider: 'google', via: 'oauth', google_email: tokens.google_email },
    });

    return returnUrl(true);
  } catch (err) {
    console.error('[GOOGLE OAUTH]', err.message);
    return returnUrl(false, 'exchange_failed');
  }
});

// Mount the public callback at the same /api/platforms prefix by exporting
// a wrapper that mounts both. app.js already has authMiddleware applied at
// the /api/platforms level via router.use(authMiddleware). The callback
// needs to bypass that — we handle it by having the callback route be
// defined on publicRouter and using req.path early-return above.
//
// Simpler approach: we wrap the whole module export and prepend the public
// router's routes.
const wrapper = express.Router();
wrapper.use('/', publicRouter); // public routes take priority (match first)
wrapper.use('/', router);        // authed routes for everything else

module.exports = wrapper;
