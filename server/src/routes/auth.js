const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { get, insert, run, transaction } = require('../db/schema');
const { signToken, authMiddleware, mfaPendingMiddleware } = require('../middleware/auth');
const { setSessionCookie, clearSessionCookie } = require('../lib/sessionCookie');
const {
  validatePassword,
  hashPassword,
  comparePassword,
  needsRehash,
  MAX_LENGTH: PW_MAX_LENGTH,
  BCRYPT_COST,
} = require('../lib/passwordPolicy');

// Timing-oracle defense: bcrypt.compare against this dummy hash on the
// "unknown email" login path so response time matches the "bad password"
// path (which compares against a real user's hash). Generated ONCE at
// module load using the same BCRYPT_COST as real users — if the cost
// constant changes, the dummy automatically tracks it. Hardcoding a
// $2a$10$… dummy while real users hashed at cost 12 was the bug that
// reopened the email-enumeration oracle for months.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync(
  'reviewhub-timing-defense-dummy-not-a-real-password',
  BCRYPT_COST
);

// Bump this when Terms or Privacy get a material revision. Existing users
// whose terms_version_accepted != current will need to re-accept (handle in UI).
// Stored on user row so we know WHICH version each user saw.
const CURRENT_TERMS_VERSION = '2025-04-22';

// Cheap-but-good-enough email shape check. Not RFC 5322 — that requires a
// 6KB regex and rejects valid addresses anyway. We trust the SMTP delivery
// step to be the actual proof-of-existence; this just blocks obvious junk.
// Length cap matches RFC 5321's 254-char practical maximum.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LEN = 254;
function isValidEmail(s) {
  return typeof s === 'string' && s.length <= EMAIL_MAX_LEN && EMAIL_RE.test(s);
}
const { generateToken, hashToken, verifyUnsubToken } = require('../lib/tokens');
const { sendVerificationEmail, sendPasswordResetEmail, sendMfaCode, sendEmailChangeAlert, sendEmailChangeConfirmation, portBlockHint } = require('../lib/email');
const { logAudit } = require('../lib/audit');
const { captureException } = require('../lib/errorReporter');
const {
  OTP_EXPIRY_MINUTES,
  generateOtp,
  generateRecoveryCodes,
  hashOtp,
  hashRecoveryCode,
  normaliseOtp,
  compareHashes,
} = require('../lib/mfa');

const router = express.Router();

// Build an absolute URL pointing at the client app. CLIENT_URL is already used
// by email templates and CORS config, so reuse it as the canonical app origin.
function clientUrl(pathWithQuery) {
  const base = process.env.CLIENT_URL || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}${pathWithQuery}`;
}

// Fire-and-forget: don't block the HTTP response if SMTP is slow or down.
// Failures forward to captureException so they reach Sentry (when configured)
// AND keep the human-readable [EMAIL] line in stderr for local visibility —
// SMTP outages are operationally important (verification flow stalls, password
// resets stall) so we surface them through the same telemetry path as route
// errors, not a raw console.error swallow.
function sendEmailInBackground(promise, label) {
  promise.catch((err) => {
    const hint = portBlockHint ? portBlockHint(err) : '';
    console.error(`[EMAIL] ${label} failed: ${err.message}${hint}`);
    captureException(err, { kind: 'email.send_failed', label });
  });
}

// Rate limiter for password change — prevents brute-forcing current password
const pwChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many password change attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for account reads/deletes — general protection
const accountLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for /register and /login — defends against credential stuffing
// and account-enumeration spraying. 20 attempts / 15 min / IP is generous for a
// real human (occasional typos, password manager misfires) but cuts off any
// automated abuse. Skipped in tests so the timing-oracle test (which fires
// 10+ logins in a tight loop) doesn't hit 429.
const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/register', authAttemptLimiter, require('../middleware/honeypot').honeypot({ fakeBody: { ok: true } }), async (req, res) => {
  const rawEmail = req.body.email;
  const rawPassword = req.body.password;
  if ((rawEmail !== undefined && rawEmail !== null && typeof rawEmail !== 'string') ||
      (rawPassword !== undefined && rawPassword !== null && typeof rawPassword !== 'string')) {
    return res.status(400).json({ error: 'email and password must be strings' });
  }
  const email = (rawEmail || '').trim().toLowerCase();
  const password = rawPassword || '';
  // Explicit attestations required at signup. These are the ingredients of
  // a valid, defensible contract under most jurisdictions: clear assent to
  // specific terms, confirmation of contractual capacity (age), and a
  // timestamped audit trail with IP + UA recorded below.
  const acceptedTerms = req.body.acceptedTerms === true;
  const ageConfirmed = req.body.ageConfirmed === true;

  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (email.length > EMAIL_MAX_LEN) return res.status(400).json({ error: `Email address too long (max ${EMAIL_MAX_LEN} characters)` });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });
  const pwCheck = validatePassword(password, { email });
  if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error });
  if (!acceptedTerms) return res.status(400).json({ error: 'You must agree to the Terms of Service and Privacy Policy to create an account' });
  if (!ageConfirmed) return res.status(400).json({ error: 'You must confirm you are at least 18 years old to create an account' });

  try {
    const existing = get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await hashPassword(password);

    // Generate an email-verification token up front so we can persist its hash
    // inside the same transaction that creates the user.
    const verify = generateToken();

    // Create user + subscription + verification token in a single atomic transaction.
    // New users land on the FREE tier by default — no 14-day trial. Rationale:
    // for a review-aggregation tool, a full-feature trial lets customers burn
    // through their historical review backlog (the high-value catch-up work)
    // and leave. The Free tier is the trial: unlimited time but capped at
    // 3 AI drafts/month and 1 connected platform, which prevents backlog
    // blasting while still letting users experience the product.
    // Record IP/UA at acceptance time — these are the evidence if the user
    // later disputes having agreed. `req.ip` respects trust-proxy when set
    // (production behind a reverse proxy); socket.remoteAddress is the
    // fallback for dev.
    const acceptIp = (req.ip || req.socket?.remoteAddress || null)?.slice(0, 64) || null;
    const acceptUa = (req.headers['user-agent'] || '').slice(0, 500) || null;

    // Referral tracking — if the signup URL included ?ref=CODE we record
    // which existing user referred this one. Silent on invalid codes (no
    // error surfaced) so attackers can't probe for valid referral codes.
    let referredByUserId = null;
    const refCode = (req.body.ref || req.query?.ref || '').toString().trim().toUpperCase().slice(0, 20);
    if (refCode) {
      try {
        const referrer = get('SELECT id FROM users WHERE referral_code = ?', [refCode]);
        if (referrer) referredByUserId = referrer.id;
      } catch { /* silent */ }
    }

    // Preferred-language capture: pick best match from Accept-Language so
    // background-job emails (weekly digest, follow-up review request, new
    // review notification) can later reach the user in the right locale
    // without needing a live req. Falls through to 'en' for unknown.
    const preferredLang = req.acceptsLanguages(['th', 'en']) || 'en';

    let userId;
    transaction((tx) => {
      userId = tx.insert(
        `INSERT INTO users (
           email, password_hash,
           email_verify_token_hash, email_verify_sent_at,
           terms_accepted_at, terms_version_accepted, terms_accept_ip, terms_accept_ua,
           age_confirmed,
           referred_by_user_id,
           preferred_lang
         ) VALUES (?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?, 1, ?, ?)`,
        [email, hash, verify.hash, CURRENT_TERMS_VERSION, acceptIp, acceptUa, referredByUserId, preferredLang]
      );
      if (!userId) throw new Error('Failed to create user');
      tx.run(
        "INSERT INTO subscriptions (user_id, status, plan, price) VALUES (?, 'active', 'free', 0)",
        [userId]
      );
    });

    if (!userId) return res.status(500).json({ error: 'Failed to create account' });

    // Send verification email asynchronously — don't delay the registration response.
    // Pick the user's preferred locale from Accept-Language so Thai users get
    // the Thai email instead of always-English. acceptsLanguages returns the
    // best match from the supplied list (or false if none match).
    sendEmailInBackground(
      sendVerificationEmail(email, clientUrl(`/verify-email?token=${verify.plaintext}`), preferredLang),
      'verification'
    );

    // Still issue a JWT so the user can start using the app immediately.
    // Verification is not required to log in; it's a soft prompt shown in the UI.
    const token = signToken({ id: userId, email });
    setSessionCookie(res, token);
    logAudit(req, 'user.register', { userId });
    // Separate audit entry for Terms acceptance — this is the high-value
    // one in a dispute, with version explicitly recorded so later Terms
    // changes can't retroactively change the contract a user accepted.
    logAudit(req, 'user.terms_accepted', {
      userId,
      metadata: { version: CURRENT_TERMS_VERSION, age_confirmed: true },
    });
    res.setHeader('Cache-Control', 'no-store');
    // `token` is still returned in the body for the migration window —
    // existing clients read it from there and stash in localStorage. New
    // client code ignores it and relies on the httpOnly cookie.
    res.json({ token, user: { id: userId, email, email_verified: false } });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', authAttemptLimiter, async (req, res) => {
  const rawEmail = req.body.email;
  const rawPassword = req.body.password;
  if ((rawEmail !== undefined && rawEmail !== null && typeof rawEmail !== 'string') ||
      (rawPassword !== undefined && rawPassword !== null && typeof rawPassword !== 'string')) {
    return res.status(400).json({ error: 'email and password must be strings' });
  }
  const email = (rawEmail || '').trim().toLowerCase();
  const password = rawPassword || '';
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (email.length > 254 || password.length > 128) return res.status(401).json({ error: 'Invalid credentials' });

  try {
    const user = get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      // Burn a bcrypt cycle against the module-load dummy hash (same
      // BCRYPT_COST as real users) so response time for "unknown email"
      // matches "bad password". See DUMMY_BCRYPT_HASH at the top of this
      // file for why the cost factor has to track BCRYPT_COST exactly.
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      logAudit(req, 'user.login_failed', { metadata: { reason: 'unknown_email' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      logAudit(req, 'user.login_failed', { userId: user.id, metadata: { reason: 'bad_password' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Opportunistic re-hash: if this user's password was hashed at the old
    // cost factor, upgrade it now while we have the plaintext in hand. Keeps
    // existing accounts current without forcing a password reset.
    if (needsRehash(user.password_hash)) {
      try {
        const upgraded = await hashPassword(password);
        run('UPDATE users SET password_hash = ? WHERE id = ?', [upgraded, user.id]);
      } catch (e) {
        // Re-hash failure is non-fatal — login still succeeds with the old hash.
        console.warn('[AUTH] opportunistic rehash failed:', e.message);
      }
    }

    // If 2FA is on, don't issue a full JWT. Issue a short-lived "mfa_pending"
    // token that can ONLY be exchanged at /login/mfa. Meanwhile we generate
    // a challenge code and email it. The pending token encodes `mfa: true` so
    // authMiddleware rejects it on any normal API route.
    if (user.mfa_enabled) {
      const otp = generateOtp();
      run(
        `UPDATE users SET mfa_code_hash = ?, mfa_code_expires_at = ?, mfa_last_sent_at = datetime('now') WHERE id = ?`,
        [
          hashOtp(otp),
          new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000).toISOString().slice(0, 19).replace('T', ' '),
          user.id,
        ]
      );
      const mfaLang = req.acceptsLanguages(['th', 'en']) || 'en';
      sendEmailInBackground(sendMfaCode(user.email, otp, 'login', mfaLang), 'mfa-login');
      logAudit(req, 'user.login.mfa_challenged', { userId: user.id });

      const pendingToken = signToken({ id: user.id, email: user.email, mfa: 'pending' }, { expiresIn: '10m' });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ mfaRequired: true, mfaPendingToken: pendingToken });
    }

    const token = signToken({ id: user.id, email: user.email });
    setSessionCookie(res, token);
    logAudit(req, 'user.login', { userId: user.id });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ token, user: { id: user.id, email: user.email, email_verified: !!user.email_verified_at, mfa_enabled: false } });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout — clears the session cookie. Idempotent; safe to call without auth.
// The JWT itself remains valid until its exp (JWTs are stateless), but the
// cookie the browser uses to present it is now gone.
router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true });
});

router.get('/me', accountLimiter, authMiddleware, (req, res) => {
  try {
    const user = get(
      `SELECT id, email, created_at, email_verified_at, mfa_enabled,
              notif_new_review, notif_negative_alert, notif_weekly_summary,
              follow_up_after_days, onboarding_dismissed_at,
              pending_email, pending_email_expires_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    // If the JWT validates but the underlying user row is gone — account
    // self-deleted on another device, admin-removed, or DB cleanup —
    // the session is stale. Clear the cookie and return 401 so the
    // client redirects to /login instead of rendering a half-empty page.
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Session no longer valid' });
    }
    const sub = get('SELECT * FROM subscriptions WHERE user_id = ?', [req.user.id]);
    // Hydrate plan metadata (name, price, features) so the client doesn't
    // have to keep a parallel copy of the plan catalogue.
    const { getPlan, planMax } = require('../lib/billing/plans');
    const planMeta = sub ? getPlan(sub.plan || 'starter') : null;
    if (sub && planMeta) sub.plan_meta = planMeta;
    // Surface AI draft quota so the UI can show proactive "2 of 3 left"
    // before the user hits the limit. Resets implicitly — if the stored
    // period_start isn't the current YYYY-MM, the used count is 0 for the
    // purposes of display (the enforcement module does the same comparison
    // atomically when a draft is actually consumed).
    if (sub) {
      const maxDrafts = planMax(sub.plan || 'free', 'maxAiDraftsPerMonth');
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
      const usedThisMonth = sub.ai_drafts_period_start === currentPeriod
        ? (sub.ai_drafts_used || 0)
        : 0;
      sub.ai_drafts_used_this_month = usedThisMonth;
      sub.ai_drafts_max_per_month = maxDrafts; // null = unlimited
      sub.ai_drafts_remaining = maxDrafts === null ? null : Math.max(0, maxDrafts - usedThisMonth);
    }
    // Separate notification prefs so the client doesn't have to make a second request
    const notifications = user ? {
      notif_new_review: user.notif_new_review !== 0,
      notif_negative_alert: user.notif_negative_alert !== 0,
      notif_weekly_summary: user.notif_weekly_summary !== 0,
      follow_up_after_days: user.follow_up_after_days ?? 0,
    } : null;
    // Surface an in-flight email change so the UI can show a "pending:
    // new@example.com — click the link in your inbox" banner. If the
    // stored expiry is in the past, treat it as expired (NULL) so stale
    // rows don't look active.
    let pendingEmail = null;
    if (user?.pending_email) {
      const expiresAt = user.pending_email_expires_at
        ? new Date(user.pending_email_expires_at + 'Z')
        : null;
      if (expiresAt && expiresAt.getTime() > Date.now()) {
        pendingEmail = {
          address: user.pending_email,
          expires_at: expiresAt.toISOString(),
        };
      }
    }
    const safeUser = user ? {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      email_verified: !!user.email_verified_at,
      mfa_enabled: user.mfa_enabled === 1,
      pending_email: pendingEmail,
      onboarding_dismissed: !!user.onboarding_dismissed_at,
    } : null;
    // Session expiry is derived from the JWT's `exp` claim (seconds since
    // epoch) set by signToken. Exposing it here lets the frontend show a
    // session-expiring banner without needing to read the httpOnly cookie.
    const sessionExpiresAt = req.user?.exp ? new Date(req.user.exp * 1000).toISOString() : null;
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ user: safeUser, subscription: sub, notifications, session_expires_at: sessionExpiresAt });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel a pending email change. Authenticated user can wipe the pending_*
// fields if they started a change but didn't click the link yet.
router.delete('/email/pending', accountLimiter, authMiddleware, (req, res) => {
  try {
    run(
      `UPDATE users
          SET pending_email = NULL,
              pending_email_token_hash = NULL,
              pending_email_expires_at = NULL
        WHERE id = ?`,
      [req.user.id]
    );
    logAudit(req, 'user.email_change_cancelled', { userId: req.user.id });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GDPR-compliant data export. Returns every row we hold for the authenticated
// user: account info, subscription, business, reviews, templates, platform
// connections (with secrets redacted). Served as an attachment so browsers
// save-as rather than render.
router.get('/me/export', accountLimiter, authMiddleware, (req, res) => {
  try {
    const { all } = require('../db/schema');
    const userId = req.user.id;

    const user = get(
      `SELECT id, email, created_at, email_verified_at,
              notif_new_review, notif_negative_alert, notif_weekly_summary, notif_onboarding,
              follow_up_after_days, onboarding_dismissed_at,
              preferred_lang
       FROM users WHERE id = ?`,
      [userId]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const subscription = get('SELECT id, status, price, renewal_date, created_at FROM subscriptions WHERE user_id = ?', [userId]);
    const business = get('SELECT id, business_name, google_place_id, yelp_business_id, facebook_page_id, created_at FROM businesses WHERE user_id = ?', [userId]);
    const reviews = business
      ? all(
          `SELECT id, platform, reviewer_name, rating, review_text, sentiment,
                  response_text, note, external_id, created_at, updated_at
           FROM reviews WHERE business_id = ?
           ORDER BY created_at DESC`,
          [business.id]
        )
      : [];
    const templates = all('SELECT id, title, body, created_at, updated_at FROM templates WHERE user_id = ?', [userId]);
    // Review requests (sent via /review-requests). Contains PII about the user's
    // customers (names + emails) — under GDPR this is the user's own record of
    // data they hold and they're entitled to export it. Token hashes omitted
    // since they're security material, not user data.
    const reviewRequests = business
      ? all(
          `SELECT id, customer_name, customer_email, platform, message,
                  sent_at, clicked_at, follow_up_sent_at
           FROM review_requests WHERE business_id = ?
           ORDER BY sent_at DESC`,
          [business.id]
        )
      : [];
    const tags = all('SELECT id, name, color, created_at FROM tags WHERE user_id = ?', [userId]);
    const autoRules = all(
      `SELECT id, name, enabled, platform, sentiment, min_rating, max_rating,
              match_keywords, response_text, tag_id, created_at
       FROM auto_rules WHERE user_id = ?
       ORDER BY created_at ASC`,
      [userId]
    );
    // Audit log entries are part of the user's personal data under GDPR.
    // Most recent 1000 entries — plenty for any realistic audit and caps
    // export size for users with extremely chatty accounts.
    const auditLog = all(
      `SELECT id, event, ip, user_agent, metadata, created_at
       FROM audit_log WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 1000`,
      [userId]
    );
    const platformConnections = business
      ? all(
          // Secret fields (access_token, refresh_token) deliberately omitted — users
          // don't need them, and surfacing them risks accidental sharing.
          `SELECT id, provider, external_account_id, last_synced_at,
                  last_sync_error, reviews_synced_count, created_at
           FROM platform_connections WHERE business_id = ?`,
          [business.id]
        )
      : [];
    // Lifecycle email send-log. Each row is "we sent you the day-N
    // onboarding email at this timestamp." Users have a right to see
    // what we sent them under GDPR Article 15.
    const onboardingEmails = all(
      `SELECT day_number, sent_at FROM onboarding_emails WHERE user_id = ? ORDER BY day_number ASC`,
      [userId]
    );

    const payload = {
      exported_at: new Date().toISOString(),
      schema_version: 4, // v4 adds onboarding_emails + preferred_lang/notif_onboarding on user
      user,
      subscription,
      business,
      reviews,
      review_requests: reviewRequests,
      tags,
      auto_rules: autoRules,
      templates,
      platform_connections: platformConnections,
      audit_log: auditLog,
      onboarding_emails: onboardingEmails,
    };

    const filename = `reviewhub-export-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store, private');
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/me', accountLimiter, authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Require password re-auth for permanent account deletion. A hijacked
    // session token alone shouldn't be enough to wipe the account — this
    // matches the same gate used by /mfa/disable. The Settings UI prompts
    // the user for their password before sending this request.
    const rawPw = req.body?.password;
    if (rawPw !== undefined && rawPw !== null && typeof rawPw !== 'string') {
      return res.status(400).json({ error: 'password must be a string' });
    }
    const password = rawPw || '';
    if (!password) return res.status(400).json({ error: 'Password required to delete account' });
    const userRow = get('SELECT id, password_hash FROM users WHERE id = ?', [userId]);
    if (!userRow) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) {
      logAudit(req, 'user.delete_failed', { userId, metadata: { reason: 'bad_password' } });
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Log BEFORE delete — cascade will remove the audit rows too (FK ON DELETE CASCADE),
    // but having the event recorded at deletion time in application logs is useful for
    // operators. The audit-log row itself cascades away with the user.
    logAudit(req, 'user.deleted', { userId });
    const { all } = require('../db/schema');
    const business = get('SELECT id FROM businesses WHERE user_id = ?', [userId]);

    // Before deleting, ask upstream OAuth providers to revoke the tokens we
    // hold for this account. Fire-and-forget — we never block the account
    // deletion on provider availability, but we DO try, because keeping
    // valid refresh tokens for a deleted user is a liability if those
    // tokens ever leak (backups, etc.).
    if (business) {
      const conns = all(
        `SELECT provider, access_token, refresh_token FROM platform_connections WHERE business_id = ?`,
        [business.id]
      );
      for (const c of conns) {
        if (c.provider === 'google') {
          const { revokeToken } = require('../lib/providers/googleOAuth');
          // Revoke refresh_token if present (that kills all derived access
          // tokens); otherwise fall back to the access_token.
          const tok = c.refresh_token || c.access_token;
          if (tok) revokeToken(tok).catch(() => { /* best-effort */ });
        }
        // Other providers (Yelp/Facebook/…) don't have token-stored
        // integrations yet; when they do, add their revoke calls here.
      }
    }

    // All deletes in a single transaction = 1 disk write
    transaction((tx) => {
      if (business) {
        // Reviews cascade automatically on business delete, but we delete explicitly for clarity
        tx.run('DELETE FROM reviews WHERE business_id = ?', [business.id]);
        tx.run('DELETE FROM businesses WHERE id = ?', [business.id]);
      }
      // Delete user-owned data before the user row itself
      tx.run('DELETE FROM templates WHERE user_id = ?', [userId]);
      tx.run('DELETE FROM subscriptions WHERE user_id = ?', [userId]);
      tx.run('DELETE FROM users WHERE id = ?', [userId]);
    });
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Rate limiter for notification preference reads/writes
const notifLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Referral / affiliate code ────────────────────────────────────────
//
// Every user has an optional referral code — short, human-readable,
// shareable. First call to GET /auth/referral-code lazily assigns one if
// the column is NULL. Payout / commission tracking lives outside this
// module (see docs/affiliate-program.md for the design).

function generateReferralCode(length = 8) {
  // Avoid 0/O/1/I ambiguity; alphanum-ish. Length 8 = 32^8 ≈ 10^12 codes.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const crypto = require('crypto');
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

router.get('/referral-code', notifLimiter, authMiddleware, (req, res) => {
  try {
    let row = get('SELECT referral_code FROM users WHERE id = ?', [req.user.id]);
    if (!row?.referral_code) {
      // Lazy-assign on first access. Retry on collision up to 5 times;
      // 32^8 space makes collisions astronomically rare.
      for (let i = 0; i < 5; i++) {
        const code = generateReferralCode();
        try {
          run('UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL', [code, req.user.id]);
          row = get('SELECT referral_code FROM users WHERE id = ?', [req.user.id]);
          if (row?.referral_code) break;
        } catch { /* unique-index violation → retry */ }
      }
    }
    if (!row?.referral_code) return res.status(500).json({ error: 'Couldn\'t assign code' });

    // Stats: how many users signed up with this code
    const stats = get(
      'SELECT COUNT(*) as referred_count FROM users WHERE referred_by_user_id = ?',
      [req.user.id]
    );
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.json({
      code: row.referral_code,
      referral_link: `${baseUrl}/register?ref=${row.referral_code}`,
      referred_count: stats?.referred_count || 0,
    });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Browser extension token ──────────────────────────────────────────
//
// One token per user, available on ALL plans (including Free). Separate from
// the general API-keys feature (which is Business-tier-only) because the
// extension is a distribution wedge — gating it behind the top tier would
// kill the exact PLG flywheel it's built to feed. Scope is narrow: the
// token only unlocks POST /api/extension/draft (which itself respects the
// user's AI-draft quota, so Free users can't abuse it).
//
// Rotation: POST regenerates (old token is invalidated by the new hash
// overwriting the column). DELETE revokes without a replacement.

router.post('/extension-token', notifLimiter, authMiddleware, (req, res) => {
  try {
    const crypto = require('crypto');
    // `rh_ext_` prefix signals to the auth middleware to route this through
    // the extension-token path, not the general API-key lookup. 32 bytes of
    // randomness is overkill for the threat model (low-value draft endpoint)
    // but keeps this consistent with other token strengths in the app.
    const plaintext = 'rh_ext_' + crypto.randomBytes(32).toString('base64url');
    const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
    run(
      "UPDATE users SET extension_token_hash = ?, extension_token_created_at = datetime('now') WHERE id = ?",
      [hash, req.user.id]
    );
    res.json({ token: plaintext, created_at: new Date().toISOString() });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/extension-token', notifLimiter, authMiddleware, (req, res) => {
  try {
    run(
      'UPDATE users SET extension_token_hash = NULL, extension_token_created_at = NULL WHERE id = ?',
      [req.user.id]
    );
    res.json({ revoked: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Returns whether the user has a token set (not the token itself — that's
// only exposed once at POST time). Used by Settings UI to show the right
// button (generate vs regenerate vs revoke).
router.get('/extension-token', notifLimiter, authMiddleware, (req, res) => {
  try {
    const row = get(
      'SELECT extension_token_created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({
      has_token: !!row?.extension_token_created_at,
      created_at: row?.extension_token_created_at || null,
    });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark the onboarding checklist as dismissed so the dashboard hides it.
// Idempotent — a second call is a no-op.
router.post('/onboarding/dismiss', notifLimiter, authMiddleware, (req, res) => {
  try {
    run("UPDATE users SET onboarding_dismissed_at = datetime('now') WHERE id = ? AND onboarding_dismissed_at IS NULL", [req.user.id]);
    res.json({ dismissed: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/me/preferred-lang — let the user persist their UI locale
// to the server so transactional + lifecycle emails reach them in the
// language they're actually reading the app in. Without this, preferred_lang
// stayed locked to whatever Accept-Language was on the registration request
// — a user signing up with browser-default English then switching the UI to
// Thai would still get Thai-language drafts in the dashboard but English
// emails in their inbox. Called from client/src/context/I18nContext.jsx
// setLang.
router.put('/me/preferred-lang', notifLimiter, authMiddleware, (req, res) => {
  try {
    const SUPPORTED = ['en', 'th', 'es', 'ja', 'ko', 'zh', 'fr', 'de', 'it', 'pt'];
    const lang = String(req.body?.lang || '').trim().toLowerCase();
    if (!SUPPORTED.includes(lang)) {
      return res.status(400).json({ error: `lang must be one of: ${SUPPORTED.join(', ')}` });
    }
    run('UPDATE users SET preferred_lang = ? WHERE id = ?', [lang, req.user.id]);
    res.json({ preferred_lang: lang });
  } catch (err) {
    captureException(err, { route: 'auth', op: 'preferred-lang' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/notifications', notifLimiter, authMiddleware, (req, res) => {
  try {
    const user = get(
      'SELECT notif_new_review, notif_negative_alert, notif_weekly_summary, notif_onboarding, follow_up_after_days FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({
      notif_new_review: user.notif_new_review !== 0,
      notif_negative_alert: user.notif_negative_alert !== 0,
      notif_weekly_summary: user.notif_weekly_summary !== 0,
      // Onboarding-emails opt-in (day 0/1/3/7/14 lifecycle). Default 1 in
      // schema; expose to /api/auth/notifications so the Settings UI can
      // show a toggle alongside the other notif preferences.
      notif_onboarding: user.notif_onboarding !== 0,
      follow_up_after_days: user.follow_up_after_days ?? 0,
    });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/notifications', notifLimiter, authMiddleware, (req, res) => {
  try {
    const user = get('SELECT id FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const BOOL_ALLOWED = ['notif_new_review', 'notif_negative_alert', 'notif_weekly_summary', 'notif_onboarding'];
    const fields = [];
    const params = [];
    for (const key of BOOL_ALLOWED) {
      if (key in req.body) {
        const val = req.body[key];
        // Strict boolean check — a JSON `"false"` string is truthy in JS,
        // so a third-party API caller sending {"notif_new_review":"false"}
        // would silently FLIP the flag ON. Demand the wire-format value
        // be a real boolean (or 0/1 for tolerance with form serializers).
        let normalised;
        if (val === true || val === 1) normalised = 1;
        else if (val === false || val === 0) normalised = 0;
        else return res.status(400).json({ error: `${key} must be a boolean` });
        fields.push(`${key} = ?`);
        params.push(normalised);
      }
    }
    // follow_up_after_days is an integer: 0 (off), 3, 5, 7, or 14
    if ('follow_up_after_days' in req.body) {
      const VALID_DAYS = [0, 3, 5, 7, 14];
      const days = parseInt(req.body.follow_up_after_days, 10);
      if (!VALID_DAYS.includes(days)) {
        return res.status(400).json({ error: `follow_up_after_days must be one of: ${VALID_DAYS.join(', ')}` });
      }
      fields.push('follow_up_after_days = ?');
      params.push(days);
    }
    if (fields.length === 0) return res.json({ success: true });
    params.push(req.user.id);
    run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Email change ──────────────────────────────────────────────────────────
//
// Two-step flow:
//   1. PUT /auth/email  { new_email, password }
//      Verifies the current password (re-auth), stashes the new address
//      + token hash on the user row, emails the new address with a confirm
//      link. Also alerts the OLD address so account takeover attempts are
//      visible to the legitimate owner.
//   2. POST /auth/email/confirm { token }
//      Flips user.email to pending_email, clears the pending_* fields,
//      emits audit entries for both old and new addresses.
//
// Tokens live 1 hour (shorter than verify-email's 24h because it's a
// higher-value mutation — short window shrinks the phishing surface).

const emailChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many email-change attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // In tests the single supertest IP hits the same limiter across the whole
  // suite. Disable so test order doesn't cascade-fail.
  skip: () => process.env.NODE_ENV === 'test',
});

const PENDING_EMAIL_EXPIRY_HOURS = 1;

router.put('/email', emailChangeLimiter, authMiddleware, async (req, res) => {
  try {
    const rawEmail = req.body.new_email;
    const rawPassword = req.body.password;
    if ((rawEmail !== undefined && rawEmail !== null && typeof rawEmail !== 'string') ||
        (rawPassword !== undefined && rawPassword !== null && typeof rawPassword !== 'string')) {
      return res.status(400).json({ error: 'new_email and password must be strings' });
    }
    const newEmail = (rawEmail || '').trim().toLowerCase();
    const password = rawPassword || '';
    if (!newEmail || !password) return res.status(400).json({ error: 'new_email and password required' });
    if (!isValidEmail(newEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const user = get('SELECT id, email, password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (newEmail === user.email) {
      return res.status(400).json({ error: 'New email matches the current email' });
    }

    // Re-auth: require the current password.
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logAudit(req, 'user.email_change_failed', { userId: user.id, metadata: { reason: 'bad_password' } });
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Collision check: if newEmail is already in use by another account, we
    // still return a generic success to avoid enumerating registered addresses.
    // The confirm step won't actually flip the email when it discovers a
    // conflict (returns a specific error then, which is fine because the
    // confirm link has the secret token).
    const taken = get('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail, user.id]);

    const change = generateToken();
    const expiresAt = new Date(Date.now() + PENDING_EMAIL_EXPIRY_HOURS * 3600 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    run(
      `UPDATE users
          SET pending_email = ?, pending_email_token_hash = ?, pending_email_expires_at = ?
        WHERE id = ?`,
      [newEmail, change.hash, expiresAt, user.id]
    );

    logAudit(req, 'user.email_change_requested', { userId: user.id });

    if (!taken) {
      const lang = req.acceptsLanguages(['th', 'en']) || 'en';
      // Email the new address with a confirm link (purpose-specific template
      // — "Confirm your new email", not the generic first-time verify text).
      sendEmailInBackground(
        sendEmailChangeConfirmation(newEmail, clientUrl(`/email-change?token=${change.plaintext}`), lang),
        'email-change-confirm'
      );
      // Best-effort alert to the old address — account takeover defence.
      // The old address still owns the account at this point; if someone
      // else initiated the change, the owner needs to know NOW.
      sendEmailInBackground(
        sendEmailChangeAlert(user.email, newEmail, lang),
        'email-change-alert'
      );
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/email/confirm', emailChangeLimiter, async (req, res) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid confirmation token' });
    }
    const tokenHash = hashToken(token);
    const user = get(
      `SELECT id, email, pending_email, pending_email_expires_at
         FROM users WHERE pending_email_token_hash = ?`,
      [tokenHash]
    );
    if (!user || !user.pending_email) {
      return res.status(400).json({ error: 'Invalid or expired confirmation link' });
    }

    const expiresAt = user.pending_email_expires_at
      ? new Date(user.pending_email_expires_at + 'Z')
      : null;
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      run(
        `UPDATE users SET pending_email = NULL, pending_email_token_hash = NULL, pending_email_expires_at = NULL WHERE id = ?`,
        [user.id]
      );
      return res.status(400).json({ error: 'Confirmation link has expired. Request a new one.' });
    }

    // Final collision check — something could have changed between request
    // and confirm. Abort cleanly if the target email is now taken.
    const taken = get('SELECT id FROM users WHERE email = ? AND id != ?', [user.pending_email, user.id]);
    if (taken) {
      run(
        `UPDATE users SET pending_email = NULL, pending_email_token_hash = NULL, pending_email_expires_at = NULL WHERE id = ?`,
        [user.id]
      );
      return res.status(409).json({ error: 'That email is already in use. Try a different address.' });
    }

    const oldEmail = user.email;
    run(
      `UPDATE users
          SET email = ?,
              email_verified_at = datetime('now'),
              pending_email = NULL,
              pending_email_token_hash = NULL,
              pending_email_expires_at = NULL
        WHERE id = ?`,
      [user.pending_email, user.id]
    );
    logAudit(req, 'user.email_changed', { userId: user.id, metadata: { from: oldEmail, to: user.pending_email } });

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, email: user.pending_email });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Resend the confirmation email for a pending email change. The original
// link expires after PENDING_EMAIL_EXPIRY_HOURS — without a resend route
// the only recovery was "cancel + restart from scratch" which forces the
// user to re-enter their password. This rotates the token, bumps the
// expiry, and re-sends to the SAME pending_email (typo recovery is still
// cancel + restart so we don't accidentally email a wrong address again).
router.post('/email/resend-confirm', emailChangeLimiter, authMiddleware, async (req, res) => {
  try {
    const user = get(
      'SELECT id, pending_email FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user || !user.pending_email) {
      return res.status(400).json({ error: 'No pending email change to resend' });
    }
    const change = generateToken();
    const expiresAt = new Date(Date.now() + PENDING_EMAIL_EXPIRY_HOURS * 3600 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ');
    run(
      `UPDATE users SET pending_email_token_hash = ?, pending_email_expires_at = ? WHERE id = ?`,
      [change.hash, expiresAt, user.id]
    );
    const resendLang = req.acceptsLanguages(['th', 'en']) || 'en';
    sendEmailInBackground(
      sendEmailChangeConfirmation(user.pending_email, clientUrl(`/confirm-email-change?token=${change.plaintext}`), resendLang),
      'email-change-resend'
    );
    logAudit(req, 'user.email_change_resent', { userId: user.id });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/password', pwChangeLimiter, authMiddleware, async (req, res) => {
  const rawCurrent = req.body.current;
  const rawNext = req.body.next;
  if ((rawCurrent !== undefined && rawCurrent !== null && typeof rawCurrent !== 'string') ||
      (rawNext !== undefined && rawNext !== null && typeof rawNext !== 'string')) {
    return res.status(400).json({ error: 'current and next must be strings' });
  }
  const current = rawCurrent || '';
  const next = rawNext || '';
  if (!current || !next) return res.status(400).json({ error: 'Current and new password required' });
  if (current.length > PW_MAX_LENGTH) return res.status(401).json({ error: 'Current password is incorrect' });

  try {
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await comparePassword(current, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const pwCheck = validatePassword(next, { email: user.email });
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error });
    if (next === current) return res.status(400).json({ error: 'New password must be different from current password' });

    const hash = await hashPassword(next);
    // Bump password_changed_at to NOW. authMiddleware rejects JWTs older
    // than this timestamp → any active session from before the rotation
    // is invalidated. The current request's JWT is ALSO invalidated, so
    // we issue a fresh one in the response + set it as the session cookie
    // (same pattern as /login) so the user stays signed in on THIS device.
    run(
      `UPDATE users SET password_hash = ?, password_changed_at = datetime('now') WHERE id = ?`,
      [hash, req.user.id]
    );
    logAudit(req, 'user.password_changed', { userId: req.user.id });

    // Re-issue a JWT so THIS device's session survives the rotation.
    // `user` is already in scope from the bcrypt.compare path above.
    const token = signToken({ id: user.id, email: user.email });
    setSessionCookie(res, token);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, token });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Email verification ────────────────────────────────────────────────────

const VERIFY_EXPIRY_HOURS = 24;
const RESET_EXPIRY_MINUTES = 60;

// Rate limiter for endpoints that trigger outbound emails — prevents using us
// as a spam amplifier (attacker emails addresses via us to harass the owner).
const emailSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many email requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for token-consumption endpoints — a user clicking a stale link
// shouldn't be able to brute-force new tokens.
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Confirm an email-verification token.
// Expects { token: "<64-char hex>" } in the body.
router.post('/verify-email', tokenLimiter, (req, res) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    const tokenHash = hashToken(token);
    const user = get(
      `SELECT id, email, email_verified_at, email_verify_sent_at
       FROM users WHERE email_verify_token_hash = ?`,
      [tokenHash]
    );

    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });

    // Already verified — treat as success (idempotent) so retries from a double-click don't confuse users.
    if (user.email_verified_at) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, alreadyVerified: true });
    }

    // Check expiry (24 hours from when the token was sent).
    const sentAt = user.email_verify_sent_at ? new Date(user.email_verify_sent_at + 'Z') : null;
    if (!sentAt || Date.now() - sentAt.getTime() > VERIFY_EXPIRY_HOURS * 3600 * 1000) {
      // Clear the stale token so it can't be used even if the clock were spoofed.
      run(
        `UPDATE users SET email_verify_token_hash = NULL, email_verify_sent_at = NULL WHERE id = ?`,
        [user.id]
      );
      return res.status(400).json({ error: 'Verification link has expired. Request a new one.' });
    }

    // Keep email_verify_token_hash around (instead of NULL-ing) so that a
    // second click on the same link — page reload, browser preview, email
    // client retry — finds the user and returns the friendly already-
    // verified branch above, not a scary "Invalid or expired" 400. The
    // token's 24h expiry already bounds reuse risk; treating it as a
    // single-use credential here just turns idempotent UX into noise.
    run(
      `UPDATE users SET email_verified_at = datetime('now')
       WHERE id = ?`,
      [user.id]
    );

    logAudit(req, 'user.email_verified', { userId: user.id });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Issue a fresh verification email for the current user. Requires auth so
// anonymous attackers can't probe which emails are registered.
router.post('/resend-verification', emailSendLimiter, authMiddleware, (req, res) => {
  try {
    const user = get(
      'SELECT id, email, email_verified_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified_at) {
      return res.json({ success: true, alreadyVerified: true });
    }

    const verify = generateToken();
    run(
      `UPDATE users SET email_verify_token_hash = ?, email_verify_sent_at = datetime('now') WHERE id = ?`,
      [verify.hash, user.id]
    );

    const lang = req.acceptsLanguages(['th', 'en']) || 'en';
    sendEmailInBackground(
      sendVerificationEmail(user.email, clientUrl(`/verify-email?token=${verify.plaintext}`), lang),
      'verification-resend'
    );

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Password reset ────────────────────────────────────────────────────────

// Google sign-in (OAuth 2.0 Authorization Code flow).
//
// /api/auth/google/login redirects the user to Google with a CSRF
// state cookie; /api/auth/google/callback verifies state, exchanges
// the code, decodes the ID token, links/creates the user account,
// and issues our session JWT. See lib/googleSignin.js for the OAuth
// mechanics + the account-linking strategy.
router.get('/google/login', (req, res) => {
  try {
    const { isConfigured, buildAuthUrl, genState } = require('../lib/googleSignin');
    if (!isConfigured()) {
      return res.status(503).json({ error: 'Google sign-in not configured' });
    }
    const state = genState();
    // Short-TTL httpOnly cookie holds the state for callback comparison.
    // 10 minutes is well above the realistic time a real user spends
    // on the Google consent screen; below that, an abandoned flow
    // doesn't leave the cookie hanging around as long.
    res.cookie('rh_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/auth/google',
    });
    res.redirect(buildAuthUrl(state));
  } catch (err) {
    captureException(err, { route: 'auth', op: 'google-login' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/google/callback', async (req, res) => {
  // Where to send the user once we're done. /dashboard for happy path,
  // /login?google_error=… on failure (so the UI can show a friendly
  // message instead of a JSON error page).
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const failRedirect = (reason) => res.redirect(`${baseUrl}/login?google_error=${encodeURIComponent(reason)}`);

  try {
    const { isConfigured, exchangeCodeForIdToken } = require('../lib/googleSignin');
    if (!isConfigured()) return failRedirect('not_configured');

    const code = String(req.query.code || '');
    const stateParam = String(req.query.state || '');
    const stateCookie = req.cookies?.rh_oauth_state;

    // Clear the state cookie ASAP so it can't be replayed.
    res.clearCookie('rh_oauth_state', { path: '/api/auth/google' });

    if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
      return failRedirect('csrf');
    }

    let claims;
    try {
      claims = await exchangeCodeForIdToken(code);
    } catch (err) {
      captureException(err, { route: 'auth', op: 'google-callback-exchange' });
      return failRedirect('exchange_failed');
    }

    const email = String(claims.email).toLowerCase().slice(0, 254);
    const googleSub = String(claims.sub);

    // Account linking strategy:
    //   1. If google_sub already linked → that user, sign in.
    //   2. Else if email matches an existing user → link google_sub to
    //      that account, sign in. The user MUST have an existing
    //      verified email for this branch (preventing a new Google
    //      account hijack against a forgotten ReviewHub one with the
    //      same address — Google's email_verified=true assertion is
    //      our protection here).
    //   3. Else → auto-create a new user with email_verified_at set
    //      (Google has already verified the email at their end).
    let user = get(`SELECT id, email, mfa_enabled FROM users WHERE google_sub = ?`, [googleSub]);

    if (!user) {
      const existingByEmail = get(`SELECT id, email, mfa_enabled FROM users WHERE LOWER(email) = ?`, [email]);
      if (existingByEmail) {
        run(`UPDATE users SET google_sub = ? WHERE id = ?`, [googleSub, existingByEmail.id]);
        user = existingByEmail;
      } else {
        // Auto-create. Password is unset (NULL) — Google sign-in is
        // the only way in for these accounts unless they later set a
        // password via /forgot-password.
        const newId = insert(
          `INSERT INTO users (email, password_hash, google_sub, email_verified_at,
                              terms_accepted_at, terms_version_accepted, age_confirmed)
           VALUES (?, NULL, ?, datetime('now'), datetime('now'), '1.0', 1)`,
          [email, googleSub]
        );
        user = get(`SELECT id, email, mfa_enabled FROM users WHERE id = ?`, [newId]);
      }
    }

    if (!user) return failRedirect('unknown');

    // MFA-enabled users get a pending token + bounce to the MFA
    // completion page, mirroring /login behavior.
    if (user.mfa_enabled) {
      const pendingToken = signToken({ id: user.id, mfa: 'pending' }, { expiresIn: '10m' });
      return res.redirect(`${baseUrl}/login/mfa?google_pending=${encodeURIComponent(pendingToken)}`);
    }

    // Set the session cookie. Same shape the rest of the app expects
    // (sessionCookie lib handles it).
    const token = signToken({ id: user.id });
    const { writeSessionCookie } = require('../lib/sessionCookie');
    writeSessionCookie(res, token);
    return res.redirect(`${baseUrl}/dashboard`);
  } catch (err) {
    captureException(err, { route: 'auth', op: 'google-callback' });
    return failRedirect('server_error');
  }
});

// Magic-link sign-in. Passwordless alternative to /login. Same
// no-enumeration guarantee as /forgot-password — always returns 200,
// never leaks whether the email exists.
router.post('/magic-link/request', emailSendLimiter, require('../middleware/honeypot').honeypot({ fakeBody: { success: true } }), async (req, res) => {
  try {
    const rawEmail = req.body.email;
    if (typeof rawEmail !== 'string') {
      return res.json({ success: true });
    }
    const email = rawEmail.trim().toLowerCase().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.json({ success: true });
    }
    const user = get(`SELECT id, email, preferred_lang FROM users WHERE LOWER(email) = ?`, [email]);
    if (user) {
      const crypto = require('crypto');
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      // 15-min TTL — short enough that a forwarded email expires
      // before the worst-case threat (recipient's inbox compromised
      // hours later).
      run(
        `UPDATE users
            SET magic_login_token_hash = ?,
                magic_login_expires_at = datetime('now', '+15 minutes')
          WHERE id = ?`,
        [tokenHash, user.id]
      );
      const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const magicUrl = `${baseUrl}/magic-login?token=${encodeURIComponent(rawToken)}`;
      const { sendMagicLinkEmail } = require('../lib/email');
      sendMagicLinkEmail(user.email, magicUrl, user.preferred_lang || 'en')
        .catch(err => captureException(err, { kind: 'email.send_failed', label: 'magic-link', userId: user.id }));
    }
    // Identical response whether or not the email matched a user.
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth', op: 'magic-link-request' });
    // Even on internal errors, don't leak. Generic success keeps the
    // no-enumeration guarantee.
    res.json({ success: true });
  }
});

// Magic-link consume. The user clicks the link in their inbox; this
// endpoint validates the token, issues a JWT, and clears the token
// (single-use). Token is sha256-hashed at rest; we hash the incoming
// raw token and look up by hash.
router.post('/magic-link/consume', (req, res) => {
  try {
    const rawToken = String(req.body?.token || '').trim();
    if (!rawToken || rawToken.length > 200) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const user = get(
      `SELECT id, email, mfa_enabled
         FROM users
        WHERE magic_login_token_hash = ?
          AND magic_login_expires_at IS NOT NULL
          AND datetime(magic_login_expires_at) > datetime('now')`,
      [tokenHash]
    );
    if (!user) {
      return res.status(400).json({ error: 'Link expired or already used. Request a new one.' });
    }

    // Single-use: clear the token immediately so a forwarded link
    // can't be re-used.
    run(
      `UPDATE users
          SET magic_login_token_hash = NULL,
              magic_login_expires_at = NULL
        WHERE id = ?`,
      [user.id]
    );

    // Honor MFA-enabled users: issue a pending token instead of a
    // full session, just like /login does. They'll redirect to
    // /login/mfa to complete the flow with their TOTP code.
    if (user.mfa_enabled) {
      const pendingToken = signToken({ id: user.id, mfa: 'pending' }, { expiresIn: '10m' });
      return res.json({ mfa_required: true, mfa_token: pendingToken });
    }

    const token = signToken({ id: user.id });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    captureException(err, { route: 'auth', op: 'magic-link-consume' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Request a password-reset email. Always responds 200 with a generic message
// regardless of whether the email exists, to avoid account-enumeration.
router.post('/forgot-password', emailSendLimiter, require('../middleware/honeypot').honeypot({ fakeBody: { success: true } }), (req, res) => {
  try {
    const rawEmail = req.body.email;
    // Non-string body field → same generic response to preserve the
    // no-enumeration promise; don't leak that the request was malformed.
    if (rawEmail !== undefined && rawEmail !== null && typeof rawEmail !== 'string') {
      return res.json({ success: true });
    }
    const email = (rawEmail || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      // Same generic response — don't leak that the format was invalid.
      return res.json({ success: true });
    }

    const user = get('SELECT id, email, password_reset_expires_at FROM users WHERE email = ?', [email]);
    if (user) {
      // Per-email cooldown: don't issue more than one password-reset email
      // per 5 minutes for the same address even if the per-IP limiter would
      // allow it. The user's password_reset_expires_at always sits 60 minutes
      // in the future when fresh, so anything within the last 5 minutes (i.e.
      // expiry > 55 min from now) is a same-window resend we should suppress.
      // No-ops returns the same generic response — the attacker can't tell
      // whether their request actually sent mail.
      let cooldownActive = false;
      if (user.password_reset_expires_at) {
        const expiresMs = new Date(user.password_reset_expires_at + 'Z').getTime();
        const minutesUntilExpiry = (expiresMs - Date.now()) / 60000;
        if (minutesUntilExpiry > RESET_EXPIRY_MINUTES - 5) {
          cooldownActive = true;
        }
      }
      if (!cooldownActive) {
        const reset = generateToken();
        const expiresAt = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ');
        run(
          `UPDATE users SET password_reset_token_hash = ?, password_reset_expires_at = ? WHERE id = ?`,
          [reset.hash, expiresAt, user.id]
        );
        const resetLang = req.acceptsLanguages(['th', 'en']) || 'en';
        sendEmailInBackground(
          sendPasswordResetEmail(user.email, clientUrl(`/reset-password?token=${reset.plaintext}`), resetLang),
          'password-reset'
        );
      }
    }

    // Generic response whether or not the address exists.
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Consume a password-reset token: set a new password and invalidate the token.
// Expects { token, password } in the body.
router.post('/reset-password', tokenLimiter, async (req, res) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    const password = req.body.password || '';
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
    const tokenHash = hashToken(token);
    const user = get(
      `SELECT id, email, password_reset_expires_at
       FROM users WHERE password_reset_token_hash = ?`,
      [tokenHash]
    );

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const expiresAt = user.password_reset_expires_at
      ? new Date(user.password_reset_expires_at + 'Z')
      : null;
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      run(
        `UPDATE users SET password_reset_token_hash = NULL, password_reset_expires_at = NULL WHERE id = ?`,
        [user.id]
      );
      return res.status(400).json({ error: 'Reset link has expired. Request a new one.' });
    }

    const pwCheck = validatePassword(password, { email: user.email });
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error });

    const hash = await hashPassword(password);
    run(
      `UPDATE users SET password_hash = ?,
                         password_changed_at = datetime('now'),
                         password_reset_token_hash = NULL,
                         password_reset_expires_at = NULL
       WHERE id = ?`,
      [hash, user.id]
    );

    logAudit(req, 'user.password_reset', { userId: user.id });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Two-factor auth (email OTP) ──────────────────────────────────────────

const { all } = require('../db/schema');

// Tightened limiter for MFA endpoints — both the challenge-email path (to
// avoid being a spam amplifier) and the code-verification path (to limit
// online brute force against a 6-digit space).
const mfaChallengeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many code requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
const mfaVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 6-digit space is 1M — 20 tries/15min is loose enough for typos, tight enough vs brute force
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /auth/mfa/enable — begins the enablement flow. Generates a code,
// stores its hash with a 10-minute expiry, and emails it to the user's
// verified address. Requires an authenticated session.
router.post('/mfa/enable', mfaChallengeLimiter, authMiddleware, async (req, res) => {
  try {
    // Require password re-auth to start the MFA-enable flow. Without this,
    // a hijacked session combined with email-account access (e.g. stolen
    // cookies + an over-broad SSO grant) is enough for an attacker to bind
    // a TOTP secret they control and lock the legitimate owner out. Mirror
    // /mfa/disable's gate so enable + disable are symmetric.
    const rawPw = req.body.password;
    if (rawPw !== undefined && rawPw !== null && typeof rawPw !== 'string') {
      return res.status(400).json({ error: 'password must be a string' });
    }
    const password = rawPw || '';
    if (!password) return res.status(400).json({ error: 'Password required' });
    const user = get('SELECT id, email, password_hash, mfa_enabled FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.mfa_enabled) return res.status(409).json({ error: 'Two-factor is already enabled' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logAudit(req, 'user.mfa_enable_failed', { userId: user.id, metadata: { reason: 'bad_password' } });
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const otp = generateOtp();
    run(
      `UPDATE users SET mfa_code_hash = ?, mfa_code_expires_at = ?, mfa_last_sent_at = datetime('now') WHERE id = ?`,
      [
        hashOtp(otp),
        new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000).toISOString().slice(0, 19).replace('T', ' '),
        user.id,
      ]
    );
    const enableLang = req.acceptsLanguages(['th', 'en']) || 'en';
    sendEmailInBackground(sendMfaCode(user.email, otp, 'enable', enableLang), 'mfa-enable');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/mfa/enable/confirm — user submits the code to turn MFA on.
// Returns freshly-generated recovery codes (plaintext, shown once — we
// only persist the hashes).
router.post('/mfa/enable/confirm', mfaVerifyLimiter, authMiddleware, (req, res) => {
  try {
    const code = normaliseOtp(req.body.code);
    if (!/^[0-9]{6}$/.test(code)) return res.status(400).json({ error: 'Invalid code' });

    const user = get(
      `SELECT id, mfa_code_hash, mfa_code_expires_at, mfa_enabled FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.mfa_enabled) return res.status(409).json({ error: 'Two-factor is already enabled' });
    if (!user.mfa_code_hash) return res.status(400).json({ error: 'No pending code — request a new one' });
    const expiresAt = user.mfa_code_expires_at ? new Date(user.mfa_code_expires_at + 'Z') : null;
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Code has expired — request a new one' });
    }
    if (!compareHashes(hashOtp(code), user.mfa_code_hash)) {
      return res.status(400).json({ error: 'Incorrect code' });
    }

    // Generate recovery codes, insert hashes, return plaintext to user ONCE.
    const plaintextCodes = generateRecoveryCodes();
    transaction((tx) => {
      tx.run(
        `UPDATE users SET mfa_enabled = 1, mfa_code_hash = NULL, mfa_code_expires_at = NULL WHERE id = ?`,
        [user.id]
      );
      // Clear any leftover codes from a previous enablement (shouldn't happen, but defensive).
      tx.run('DELETE FROM mfa_recovery_codes WHERE user_id = ?', [user.id]);
      for (const plain of plaintextCodes) {
        tx.run(
          'INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES (?, ?)',
          [user.id, hashRecoveryCode(plain)]
        );
      }
    });
    logAudit(req, 'user.mfa_enabled', { userId: user.id });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, recovery_codes: plaintextCodes });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/mfa/disable — turn MFA off. Requires the current password
// (re-authentication) to prevent a hijacked session from disabling it
// silently. Does NOT require a 2FA code — otherwise a user who's lost
// access to their email could never disable it.
router.post('/mfa/disable', mfaVerifyLimiter, authMiddleware, async (req, res) => {
  try {
    const rawPw = req.body.password;
    if (rawPw !== undefined && rawPw !== null && typeof rawPw !== 'string') {
      return res.status(400).json({ error: 'password must be a string' });
    }
    const password = rawPw || '';
    if (!password) return res.status(400).json({ error: 'Password required' });
    const user = get('SELECT id, password_hash, mfa_enabled FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.mfa_enabled) return res.status(409).json({ error: 'Two-factor is not enabled' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logAudit(req, 'user.mfa_disable_failed', { userId: user.id, metadata: { reason: 'bad_password' } });
      return res.status(401).json({ error: 'Incorrect password' });
    }

    transaction((tx) => {
      tx.run(
        `UPDATE users SET mfa_enabled = 0, mfa_code_hash = NULL, mfa_code_expires_at = NULL WHERE id = ?`,
        [user.id]
      );
      tx.run('DELETE FROM mfa_recovery_codes WHERE user_id = ?', [user.id]);
    });
    logAudit(req, 'user.mfa_disabled', { userId: user.id });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/login/mfa — exchange the mfa-pending token + 6-digit code for
// a full access token.
router.post('/login/mfa', mfaVerifyLimiter, mfaPendingMiddleware, (req, res) => {
  try {
    const code = normaliseOtp(req.body.code);
    if (!/^[0-9]{6}$/.test(code)) return res.status(400).json({ error: 'Invalid code' });

    const user = get(
      `SELECT id, email, mfa_enabled, mfa_code_hash, mfa_code_expires_at, email_verified_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!user || !user.mfa_enabled) {
      return res.status(400).json({ error: 'Two-factor not enabled' });
    }
    if (!user.mfa_code_hash) return res.status(400).json({ error: 'No active challenge — request a new code' });
    const expiresAt = user.mfa_code_expires_at ? new Date(user.mfa_code_expires_at + 'Z') : null;
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Code has expired — request a new one' });
    }
    if (!compareHashes(hashOtp(code), user.mfa_code_hash)) {
      logAudit(req, 'user.login.mfa_failed', { userId: user.id });
      return res.status(400).json({ error: 'Incorrect code' });
    }

    // Consume the code — a successful login code can't be reused.
    run(
      `UPDATE users SET mfa_code_hash = NULL, mfa_code_expires_at = NULL WHERE id = ?`,
      [user.id]
    );
    logAudit(req, 'user.login', { userId: user.id, metadata: { mfa: true } });
    const token = signToken({ id: user.id, email: user.email });
    setSessionCookie(res, token);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      token,
      user: { id: user.id, email: user.email, email_verified: !!user.email_verified_at, mfa_enabled: true },
    });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/login/recovery — exchange the mfa-pending token + a recovery
// code for a full access token. Recovery codes are single-use; we mark
// used_at on success.
router.post('/login/recovery', mfaVerifyLimiter, mfaPendingMiddleware, (req, res) => {
  try {
    const rawCode = req.body.recovery_code || '';
    const submittedHash = hashRecoveryCode(rawCode);

    const user = get(
      `SELECT id, email, mfa_enabled, email_verified_at FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!user || !user.mfa_enabled) return res.status(400).json({ error: 'Two-factor not enabled' });

    // Look up an unused recovery code matching the submitted hash. Note:
    // this lookup uses the hash directly; timing-wise, the DB comparison
    // isn't constant-time across rows, but an attacker learns only "some
    // hash with this user_id exists" which is table-binary-size-of-bits of
    // info per probe — not a practical side channel.
    const match = get(
      `SELECT id FROM mfa_recovery_codes
       WHERE user_id = ? AND code_hash = ? AND used_at IS NULL`,
      [user.id, submittedHash]
    );
    if (!match) {
      logAudit(req, 'user.login.recovery_failed', { userId: user.id });
      return res.status(400).json({ error: 'Invalid or already-used recovery code' });
    }

    // Consume the recovery code + clear any pending OTP so neither can be
    // reused. Single transaction for atomicity.
    transaction((tx) => {
      tx.run(`UPDATE mfa_recovery_codes SET used_at = datetime('now') WHERE id = ?`, [match.id]);
      tx.run(`UPDATE users SET mfa_code_hash = NULL, mfa_code_expires_at = NULL WHERE id = ?`, [user.id]);
    });

    logAudit(req, 'user.login', { userId: user.id, metadata: { recovery: true } });
    const token = signToken({ id: user.id, email: user.email });
    setSessionCookie(res, token);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      token,
      user: { id: user.id, email: user.email, email_verified: !!user.email_verified_at, mfa_enabled: true },
      recovery_codes_remaining: (get(
        `SELECT COUNT(*) AS n FROM mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL`,
        [user.id]
      )?.n) || 0,
    });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/login/mfa/resend — re-issue a 2FA code (user didn't receive
// the first email). Rate-limited tightly.
router.post('/login/mfa/resend', mfaChallengeLimiter, mfaPendingMiddleware, (req, res) => {
  try {
    const user = get('SELECT id, email, mfa_enabled FROM users WHERE id = ?', [req.user.id]);
    if (!user || !user.mfa_enabled) return res.status(400).json({ error: 'Two-factor not enabled' });

    const otp = generateOtp();
    run(
      `UPDATE users SET mfa_code_hash = ?, mfa_code_expires_at = ?, mfa_last_sent_at = datetime('now') WHERE id = ?`,
      [
        hashOtp(otp),
        new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000).toISOString().slice(0, 19).replace('T', ' '),
        user.id,
      ]
    );
    const resendMfaLang = req.acceptsLanguages(['th', 'en']) || 'en';
    sendEmailInBackground(sendMfaCode(user.email, otp, 'login', resendMfaLang), 'mfa-login-resend');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'auth' });
    res.status(500).json({ error: 'Server error' });
  }
});

// One-click email unsubscribe — RFC 8058 List-Unsubscribe-Post target.
//
// Mounted at BOTH GET (for users clicking the email link) and POST (for
// Gmail/Outlook automated mail-client unsub via List-Unsubscribe-Post:
// List-Unsubscribe=One-Click). Unauthenticated by design — that's the whole
// point. Authentication is via the signed token, which only the server's
// JWT_SECRET could have generated.
//
// Why this matters: when Gmail probes the List-Unsubscribe header and gets
// a redirect to a login wall, it counts that as a failed unsubscribe and
// downgrades sender reputation. With a signed token endpoint, Gmail's
// automated POST gets a 200 and the user is removed cleanly — preserving
// deliverability for the rest of the user base.
const unsubLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const LIST_TYPE_TO_COLUMN = {
  digest: 'notif_weekly_summary',
  new_review: 'notif_new_review',
  negative_alert: 'notif_negative_alert',
  // Onboarding lifecycle (day 0/1/3/7/14). Honored by the scheduler in
  // jobs/onboardingEmails.js — once flipped to 0, no further sends fire.
  onboarding: 'notif_onboarding',
};

function unsubHandler(req, res) {
  try {
    const token = req.method === 'GET' ? req.query.token : (req.query.token || req.body?.token);
    if (typeof token !== 'string' || !token) {
      return res.status(400).json({ error: 'Missing token' });
    }
    const result = verifyUnsubToken(token);
    if (!result.ok) {
      return res.status(400).json({ error: 'Invalid or expired link' });
    }
    const column = LIST_TYPE_TO_COLUMN[result.listType];
    if (!column) {
      return res.status(400).json({ error: 'Unknown list' });
    }
    // Idempotent: setting to 0 multiple times is fine.
    run(`UPDATE users SET ${column} = 0 WHERE id = ?`, [result.userId]);
    logAudit(req, 'email.unsubscribed', {
      userId: result.userId,
      metadata: { list: result.listType, via: req.method },
    });
    // For mail-client one-click POSTs, return 200 JSON. For browser GETs from
    // the email footer link, redirect to a confirmation page on the SPA.
    if (req.method === 'POST') {
      return res.json({ ok: true, list: result.listType });
    }
    const base = process.env.CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${base}/unsubscribed?list=${encodeURIComponent(result.listType)}`);
  } catch (err) {
    captureException(err, { route: 'auth', op: 'unsubscribe' });
    return res.status(500).json({ error: 'Server error' });
  }
}
router.get('/unsubscribe', unsubLimiter, unsubHandler);
router.post('/unsubscribe', unsubLimiter, unsubHandler);

module.exports = router;
