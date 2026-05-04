const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all, insert, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { getPlan } = require('../lib/billing/plans');

const { captureException } = require('../lib/errorReporter');
function parseId(param) {
  const n = parseInt(param, 10);
  return (isFinite(n) && n > 0 && String(n) === String(param)) ? n : null;
}

const bizReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

const bizMutateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();
router.use(authMiddleware);

router.get('/', bizReadLimiter, (req, res) => {
  try {
    const user = get('SELECT active_business_id FROM users WHERE id = ?', [req.user.id]);
    // Order: alphabetical by name so a Business-plan user with 5 locations
    // sees them in a predictable list rather than database-id-creation order.
    // COLLATE NOCASE folds case so "Bangkok" and "bangkok" sort together.
    const businesses = all('SELECT * FROM businesses WHERE user_id = ? ORDER BY business_name COLLATE NOCASE ASC', [req.user.id]);
    const activeId = user?.active_business_id || (businesses[0]?.id ?? null);
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ businesses, active_business_id: activeId });
  } catch (err) {
    captureException(err, { route: 'businesses' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Coerce a body field to a trimmed string, rejecting non-string JSON values.
// Returns { ok: true, value } on success or { ok: false, error } for 400.
function asTrimmedString(value, field, { maxLen = 500, allowEmpty = false } = {}) {
  if (value === undefined || value === null) {
    return allowEmpty ? { ok: true, value: '' } : { ok: false, error: `${field} is required` };
  }
  if (typeof value !== 'string') return { ok: false, error: `${field} must be a string` };
  const trimmed = value.trim().slice(0, maxLen);
  return { ok: true, value: trimmed };
}

router.post('/', bizMutateLimiter, (req, res) => {
  try {
    const r = asTrimmedString(req.body.business_name, 'Business name', { maxLen: 200 });
    if (!r.ok) return res.status(400).json({ error: r.error });
    const business_name = r.value;
    if (!business_name) return res.status(400).json({ error: 'Business name required' });

    const sub = get('SELECT plan FROM subscriptions WHERE user_id = ?', [req.user.id]);
    const plan = getPlan(sub?.plan || 'free');
    const existingList = all('SELECT id FROM businesses WHERE user_id = ?', [req.user.id]);
    const max = plan.maxBusinesses || 1;

    if (existingList.length >= max) {
      if (max === 1) {
        return res.status(409).json({ error: 'Business already exists. Use PUT to update.' });
      }
      return res.status(403).json({
        error: `Your plan allows up to ${max} businesses. Upgrade to add more.`,
        upgrade: true,
      });
    }

    const id = insert('INSERT INTO businesses (user_id, business_name) VALUES (?, ?)', [req.user.id, business_name]);
    // First business → make it active immediately. Without this the user row
    // sits with active_business_id = NULL and every downstream call that
    // resolves "the user's active business" has to paper over it with a
    // fallback ("first business if none set"). Set the canonical value once
    // here so the DB state matches the logical state. For 2nd+ businesses
    // (Business plan), keep whatever the user's active selection is — this
    // route only creates, switching is via PUT /active.
    const isFirst = existingList.length === 0;
    if (isFirst) {
      run('UPDATE users SET active_business_id = ? WHERE id = ?', [id, req.user.id]);
    }
    res.json({
      id,
      business_name,
      user_id: req.user.id,
      ...(isFirst ? { active_business_id: id } : {}),
    });
  } catch (err) {
    captureException(err, { route: 'businesses' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/businesses/active — switch active business (must be before /:id)
router.put('/active', bizMutateLimiter, (req, res) => {
  try {
    const bizId = parseId(req.body.business_id);
    if (!bizId) return res.status(400).json({ error: 'business_id is required' });
    const biz = get('SELECT id FROM businesses WHERE id = ? AND user_id = ?', [bizId, req.user.id]);
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    run('UPDATE users SET active_business_id = ? WHERE id = ?', [biz.id, req.user.id]);
    res.json({ active_business_id: biz.id });
  } catch (err) {
    captureException(err, { route: 'businesses' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', bizMutateLimiter, (req, res) => {
  try {
    const bizId = parseId(req.params.id);
    if (!bizId) return res.status(400).json({ error: 'Invalid business ID' });
    const biz = get('SELECT * FROM businesses WHERE id = ? AND user_id = ?', [bizId, req.user.id]);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const { business_name, google_place_id, yelp_business_id, facebook_page_id, ownership_attested, widget_enabled, reply_tone } = req.body;
    const fields = [];
    const params = [];
    // Side effect tracking: when a platform id is set/cleared, mirror it in
    // platform_connections so the sync worker picks it up (or drops it).
    const platformEdits = [];

    if (business_name !== undefined) {
      const r = asTrimmedString(business_name, 'Business name', { maxLen: 200, allowEmpty: true });
      if (!r.ok) return res.status(400).json({ error: r.error });
      if (!r.value) return res.status(400).json({ error: 'Business name cannot be empty' });
      fields.push('business_name = ?'); params.push(r.value);
    }
    if (google_place_id !== undefined) {
      const r = asTrimmedString(google_place_id, 'google_place_id', { maxLen: 500, allowEmpty: true });
      if (!r.ok) return res.status(400).json({ error: r.error });
      const val = r.value || null;
      fields.push('google_place_id = ?'); params.push(val);
      platformEdits.push({ provider: 'google', id: val });
    }
    if (yelp_business_id !== undefined) {
      const r = asTrimmedString(yelp_business_id, 'yelp_business_id', { maxLen: 500, allowEmpty: true });
      if (!r.ok) return res.status(400).json({ error: r.error });
      const val = r.value || null;
      fields.push('yelp_business_id = ?'); params.push(val);
      platformEdits.push({ provider: 'yelp', id: val });
    }
    if (facebook_page_id !== undefined) {
      const r = asTrimmedString(facebook_page_id, 'facebook_page_id', { maxLen: 500, allowEmpty: true });
      if (!r.ok) return res.status(400).json({ error: r.error });
      const val = r.value || null;
      fields.push('facebook_page_id = ?'); params.push(val);
      platformEdits.push({ provider: 'facebook', id: val });
    }
    if (widget_enabled !== undefined) {
      fields.push('widget_enabled = ?');
      params.push(widget_enabled ? 1 : 0);
    }
    if (reply_tone !== undefined) {
      // Allowlist guards against arbitrary text getting injected into the AI
      // prompt steering line. Null/empty resets to the default warm voice.
      const VALID_TONES = ['casual', 'warm', 'formal'];
      if (reply_tone === null || reply_tone === '') {
        fields.push('reply_tone = ?'); params.push(null);
      } else if (typeof reply_tone === 'string' && VALID_TONES.includes(reply_tone)) {
        fields.push('reply_tone = ?'); params.push(reply_tone);
      } else {
        return res.status(400).json({ error: `reply_tone must be one of: ${VALID_TONES.join(', ')}` });
      }
    }
    if (req.body.vacation_until !== undefined) {
      // Vacation/closed-period mode. While the current date is on or
      // before this value, suppress new-review email notifications and
      // the AI auto-draft pipeline (reviews still ingest). NULL or empty
      // string clears any existing vacation. Validate ISO YYYY-MM-DD
      // shape; refuse anything else so a typo can't silently disable
      // notifications forever.
      const v = req.body.vacation_until;
      if (v === null || v === '') {
        fields.push('vacation_until = ?'); params.push(null);
      } else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        // Sanity: refuse dates in the past — that's almost certainly a
        // typo (entered last year by accident). Same-day still allowed
        // since "vacation through today" is a valid request at midnight
        // on the last day. Comparison is string-safe because YYYY-MM-DD
        // is lexicographically sortable.
        const today = new Date().toISOString().slice(0, 10);
        if (v < today) {
          return res.status(400).json({ error: 'vacation_until cannot be in the past' });
        }
        fields.push('vacation_until = ?'); params.push(v);
      } else {
        return res.status(400).json({ error: 'vacation_until must be a YYYY-MM-DD date string' });
      }
    }

    if (fields.length === 0) return res.json({ success: true });
    params.push(biz.id);
    run(`UPDATE businesses SET ${fields.join(', ')} WHERE id = ?`, params);

    // Upsert / delete platform_connections rows to match the new state.
    // Plan gate: before accepting a NEW platform connection (not an update
    // to an existing one, not a clear), check the user hasn't exceeded
    // their plan's maxPlatforms. We re-count within the loop so a single
    // PUT trying to add N platforms is stopped at the cap, not all-or-nothing.
    const { canConnectPlatform } = require('../lib/billing/enforcement');

    for (const edit of platformEdits) {
      if (edit.id) {
        const existing = get(
          'SELECT id FROM platform_connections WHERE business_id = ? AND provider = ?',
          [biz.id, edit.provider]
        );
        if (existing) {
          // Updating an existing connection's external_account_id doesn't
          // change the count — always allowed.
          run(
            'UPDATE platform_connections SET external_account_id = ? WHERE id = ?',
            [edit.id, existing.id]
          );
        } else {
          // New connection — check plan limit before inserting. We count
          // connections added so far in this request against the limit too,
          // so a single PUT that tries to add 3 platforms on a Free plan
          // (1-platform cap) is stopped on the second one.
          const inserted = get(
            'SELECT COUNT(*) AS n FROM platform_connections WHERE business_id = ?',
            [biz.id]
          )?.n || 0;
          const check = canConnectPlatform(req.user.id, inserted);
          if (!check.allowed) {
            return res.status(check.status || 402).json({
              error: check.reason,
              upgradeTo: check.upgradeTo,
              current: check.current,
              max: check.max,
            });
          }
          run(
            'INSERT INTO platform_connections (business_id, provider, external_account_id) VALUES (?, ?, ?)',
            [biz.id, edit.provider, edit.id]
          );
          // Record the ownership attestation alongside the insert — same
          // transaction, same IP/UA as the audit middleware will capture.
          // This is the evidence trail if a third-party reviewer or business
          // disputes the connection.
          const { logAudit } = require('../lib/audit');
          logAudit(req, 'platform.connected', {
            userId: req.user.id,
            metadata: {
              provider: edit.provider,
              external_account_id: edit.id,
              ownership_attested: ownership_attested === true,
            },
          });
        }
      } else {
        // Cleared → also best-effort revoke the upstream OAuth token so the
        // provider forgets our app. Happens before the DB delete so we still
        // have the refresh_token available. Fire-and-forget — if Google's
        // revoke endpoint is down, we continue with the local delete.
        if (edit.provider === 'google') {
          const existing = get(
            `SELECT refresh_token FROM platform_connections WHERE business_id = ? AND provider = ?`,
            [biz.id, edit.provider]
          );
          if (existing?.refresh_token) {
            try {
              const { revokeToken } = require('../lib/providers/googleOAuth');
              revokeToken(existing.refresh_token).catch(() => { /* best-effort */ });
            } catch { /* revokeToken might not be exported in older builds */ }
          }
        }
        run(
          'DELETE FROM platform_connections WHERE business_id = ? AND provider = ?',
          [biz.id, edit.provider]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'businesses' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
