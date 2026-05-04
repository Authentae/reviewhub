// Outbound audit previews — the demo-first outreach tool.
//
// Founder pastes a prospect's business name + a handful of their public
// Google reviews. Server generates AI-drafted replies for each review,
// stores the snapshot, returns a public share URL like
// /audit-preview/<share_token>. Founder DMs that URL to the prospect.
//
// The prospect opens the URL on mobile, sees their own reviews + the
// drafted replies side-by-side, and either replies "interested" or
// ignores it. Either way zero follow-up cost to the founder.
//
// Why this lives separate from the inbound /audit (AuditLanding):
//   - inbound /audit is "prospect submits → founder hand-crafts reply"
//   - outbound /audit-preview is "founder generates → prospect views"
//   The flows reverse direction; sharing a route would muddle both.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { randomBytes } = require('crypto');
const router = express.Router();
const { run, get, all, insert } = require('../db/schema');
const { captureException } = require('../lib/errorReporter');
const { authMiddleware, tryGetUserId } = require('../middleware/auth');
const { generateDraft } = require('../lib/aiDrafts');
const { reserveAiDraft, refundAiDraft } = require('../lib/billing/enforcement');
const { isLikelyBot } = require('../lib/botDetection');
const { sendAuditViewNotification } = require('../lib/email');

// How long to suppress repeat-view notifications. The first view always
// fires; subsequent views from the same prospect (refresh, share-with-
// team, re-open from email) only re-fire after this window. 24h was
// chosen because that's roughly the founder's follow-up cycle — if the
// prospect comes back tomorrow and engages, that's a fresh signal.
const NOTIFICATION_THROTTLE_HOURS = 24;

// Per-user rate limit on audit creation. Each audit costs N AI-draft
// API calls (one per pasted review), so abusive scripting could rack
// up costs. Keep at 20/hour which is well above realistic outreach
// pace (the playbook recommends ~10 outreaches/day).
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many audits this hour. Slow down — quality outreach beats volume.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Public-view rate limit — share-token URLs are unauthenticated (the
// prospect doesn't have an account) so we limit per-IP to prevent
// scraping the share-token namespace. 60/hour/IP is generous for a
// real prospect opening the URL once or twice.
const viewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Validation: each pasted review should look like an actual review,
// not whitespace or a paragraph the founder accidentally pasted twice.
const MAX_REVIEWS_PER_AUDIT = 12;
const MIN_REVIEWS_PER_AUDIT = 1;

// POST /api/audit-previews — create a new outbound audit.
// Body: { business_name, reviews: [{ reviewer_name, rating, text }, ...] }
// Returns: { id, share_token, share_url, drafts: [...] }
router.post('/', createLimiter, authMiddleware, async (req, res) => {
  try {
    const { business_name, reviews } = req.body || {};

    // Basic input validation. The founder is the only consumer of this
    // endpoint so we don't need to be friendly with the errors — they're
    // for debugging the dashboard form, not for end users.
    if (typeof business_name !== 'string' || !business_name.trim()) {
      return res.status(400).json({ error: 'business_name required' });
    }
    if (!Array.isArray(reviews) || reviews.length < MIN_REVIEWS_PER_AUDIT) {
      return res.status(400).json({ error: `Need at least ${MIN_REVIEWS_PER_AUDIT} review` });
    }
    if (reviews.length > MAX_REVIEWS_PER_AUDIT) {
      return res.status(400).json({ error: `Max ${MAX_REVIEWS_PER_AUDIT} reviews per audit` });
    }

    // Sanitise each review. We're storing this verbatim and rendering it
    // server-side as HTML on the share page — escapeHtml at render time
    // catches XSS, but trimming + length-capping at write time keeps the
    // DB tidy and stops a megabyte-paste from slipping through.
    const sanitised = [];
    for (const r of reviews) {
      const reviewer_name = String(r.reviewer_name || '').trim().slice(0, 200);
      const text = String(r.text || '').trim().slice(0, 5000);
      const ratingNum = Number(r.rating);
      const rating = Number.isFinite(ratingNum) && ratingNum >= 1 && ratingNum <= 5
        ? Math.round(ratingNum)
        : 5;
      if (!text) continue; // skip empties
      sanitised.push({ reviewer_name, rating, text });
    }
    if (sanitised.length === 0) {
      return res.status(400).json({ error: 'No valid reviews after sanitising — every review needs text' });
    }

    // Generate drafts. We reserve + refund per review to honour the AI
    // quota — outbound audits count against the founder's account quota
    // the same way dashboard drafts do. Free-tier founders trying to do
    // outreach will hit their 3/mo cap quickly; that's the upgrade
    // pressure on US, not abuse-prevention.
    const businessName = business_name.trim().slice(0, 200);
    const draftedReviews = [];
    const reservations = [];
    try {
      for (const r of sanitised) {
        const reservation = reserveAiDraft(req.user.id);
        if (!reservation.allowed) {
          // Refund any prior reservations from this same audit so we
          // don't half-charge.
          for (let i = 0; i < reservations.length; i++) refundAiDraft(req.user.id);
          return res.status(reservation.status || 402).json({
            error: reservation.reason,
            upgradeTo: reservation.upgradeTo,
            quota: reservation.used != null ? { used: reservation.used, max: reservation.max } : undefined,
          });
        }
        reservations.push(true);

        // Synthesise a minimal review row that aiDrafts.generateDraft
        // expects (it reads .review_text, .reviewer_name, .rating,
        // .platform). Platform isn't provided by the founder pasting
        // raw text; assume google because that's the prospect's
        // actual review-source 95% of the time on outbound.
        const fakeReview = {
          id: 0,
          platform: 'google',
          reviewer_name: r.reviewer_name,
          rating: r.rating,
          review_text: r.text,
          sentiment: r.rating >= 4 ? 'positive' : r.rating <= 2 ? 'negative' : 'neutral',
        };

        let draft = '';
        let source = 'template';
        try {
          const result = await generateDraft({
            review: fakeReview,
            businessName,
            // No preferredLang — let the prompt auto-detect from review text
          });
          draft = result.draft || '';
          source = result.source || 'template';
        } catch (err) {
          // If a single draft fails (rate limit, network), keep going —
          // the audit is more useful with 9 drafts than 0. Refund this
          // slot so the founder isn't charged for a failed draft.
          refundAiDraft(req.user.id);
          reservations.pop();
          captureException(err, { route: 'audit-previews', op: 'draft', reviewerName: r.reviewer_name });
        }

        if (source === 'template') {
          // Template fallback is free — refund the slot we reserved.
          refundAiDraft(req.user.id);
          reservations.pop();
        }

        draftedReviews.push({
          reviewer_name: r.reviewer_name,
          rating: r.rating,
          text: r.text,
          draft,
        });
      }
    } catch (err) {
      // Refund any outstanding reservations on unexpected throw.
      for (let i = 0; i < reservations.length; i++) refundAiDraft(req.user.id);
      throw err;
    }

    // Store the audit. share_token is 24 random bytes (192 bits) →
    // 48 hex chars. Unguessable at any practical scale; the URL is
    // safe to share publicly.
    const share_token = randomBytes(24).toString('hex');
    const id = insert(
      `INSERT INTO audit_previews
         (owner_user_id, business_name, reviews_json, share_token)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, businessName, JSON.stringify(draftedReviews), share_token]
    );

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const share_url = `${baseUrl}/audit-preview/${share_token}`;

    res.json({
      id,
      share_token,
      share_url,
      business_name: businessName,
      reviews: draftedReviews,
    });
  } catch (err) {
    captureException(err, { route: 'audit-previews', op: 'create' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/audit-previews — list the founder's recent audits, for a
// "history" view in the dashboard. Returns just metadata, not the
// review-text contents (the dashboard renders a list, the prospect-
// view URL renders the contents).
router.get('/', authMiddleware, (req, res) => {
  try {
    const rows = all(
      `SELECT id, business_name, share_token, view_count, first_viewed_at, last_viewed_at, created_at, expires_at
         FROM audit_previews
        WHERE owner_user_id = ?
          AND datetime(expires_at) > datetime('now')
        ORDER BY created_at DESC
        LIMIT 50`,
      [req.user.id]
    );
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.json({
      audits: rows.map((r) => ({
        ...r,
        share_url: `${baseUrl}/audit-preview/${r.share_token}`,
      })),
    });
  } catch (err) {
    captureException(err, { route: 'audit-previews', op: 'list' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/audit-previews/:id — let the founder revoke a share URL
// before its 30-day expiry (e.g. prospect closed; don't want the URL
// floating around).
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const auditId = parseInt(req.params.id, 10);
    if (!Number.isFinite(auditId) || auditId <= 0) {
      return res.status(400).json({ error: 'Invalid audit ID' });
    }
    const audit = get(
      `SELECT id FROM audit_previews WHERE id = ? AND owner_user_id = ?`,
      [auditId, req.user.id]
    );
    if (!audit) return res.status(404).json({ error: 'Not found' });
    run(`DELETE FROM audit_previews WHERE id = ?`, [auditId]);
    res.json({ deleted: true });
  } catch (err) {
    captureException(err, { route: 'audit-previews', op: 'delete' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/audit-previews/share/:token — public endpoint, no auth.
// Returns the audit JSON for the prospect's view-page to render.
// Increments view_count + timestamps so the founder can see in the
// dashboard whether the prospect actually opened the URL.
router.get('/share/:token', viewLimiter, (req, res) => {
  try {
    const token = String(req.params.token || '');
    // Validate shape — 48 hex chars matches randomBytes(24).toString('hex').
    // Reject anything else upfront so we don't waste a DB query on
    // garbage tokens (and don't leak which tokens are real via timing).
    if (!/^[a-f0-9]{48}$/.test(token)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const row = get(
      `SELECT id, owner_user_id, business_name, reviews_json, created_at, expires_at,
              view_count, last_notification_sent_at
         FROM audit_previews
        WHERE share_token = ?
          AND datetime(expires_at) > datetime('now')`,
      [token]
    );
    if (!row) return res.status(404).json({ error: 'Not found or expired' });

    // Bot/preview-crawler filter. Slack/Twitter/iMessage etc. fetch the
    // URL the moment it's pasted to render a preview card — those hits
    // are NOT a real human prospect engaging with the audit, so we skip
    // both view counting AND owner notification for them. False-positive
    // here just means one fewer notification; false-negative would mean
    // a noise notification that erodes founder trust in the signal.
    const ua = req.headers['user-agent'] || '';
    const isBot = isLikelyBot(ua);

    let displayViewCount = row.view_count;

    if (!isBot) {
      // Bump view count and timestamps. Don't fail the response if this
      // bookkeeping update errors — the prospect viewing the audit is the
      // important thing.
      try {
        run(
          `UPDATE audit_previews
              SET view_count = view_count + 1,
                  first_viewed_at = COALESCE(first_viewed_at, datetime('now')),
                  last_viewed_at = datetime('now')
            WHERE id = ?`,
          [row.id]
        );
        displayViewCount = row.view_count + 1;
      } catch (e) { /* swallow */ }

      // Notification gate. Two suppression rules:
      //   1. Self-view: the founder previewing their own audit URL while
      //      logged in shouldn't trigger a "prospect opened your audit"
      //      email to themselves. tryGetUserId is a soft-decode that
      //      returns null on missing/invalid token (i.e., a real prospect
      //      who isn't logged in passes through).
      //   2. Throttle: re-views within NOTIFICATION_THROTTLE_HOURS of the
      //      previous notification suppress to avoid emailing the founder
      //      on every prospect refresh. NULL last_notification_sent_at
      //      means "never notified" — always fire on first view.
      const requesterUserId = tryGetUserId(req);
      const isOwnerSelfView = requesterUserId && requesterUserId === row.owner_user_id;

      let shouldNotify = false;
      if (!isOwnerSelfView) {
        if (!row.last_notification_sent_at) {
          shouldNotify = true;
        } else {
          // Compute hours since last notification. SQLite stores ISO
          // strings; Date parsing handles both 'YYYY-MM-DD HH:MM:SS' and
          // ISO formats. If the parse fails, default to firing — better
          // a noise notification than a missed real signal.
          const last = new Date(String(row.last_notification_sent_at).replace(' ', 'T') + 'Z');
          const ageHours = (Date.now() - last.getTime()) / (1000 * 60 * 60);
          if (!Number.isFinite(ageHours) || ageHours >= NOTIFICATION_THROTTLE_HOURS) {
            shouldNotify = true;
          }
        }
      }

      if (shouldNotify) {
        try {
          // Mark the notification as sent BEFORE the SMTP call. If SMTP
          // fails the founder misses one email but doesn't get spammed
          // by every refresh; if we marked AFTER the await, a slow SMTP
          // could let a refresh slip through and double-fire.
          run(
            `UPDATE audit_previews SET last_notification_sent_at = datetime('now') WHERE id = ?`,
            [row.id]
          );

          const owner = get(
            `SELECT email, preferred_lang FROM users WHERE id = ?`,
            [row.owner_user_id]
          );
          if (owner && owner.email) {
            const created = new Date(String(row.created_at).replace(' ', 'T') + 'Z');
            const hoursSinceCreated = Math.max(0, (Date.now() - created.getTime()) / (1000 * 60 * 60));
            // Fire-and-forget. Public endpoint must not block on SMTP.
            // Errors get captured but do not propagate to the response.
            Promise.resolve(
              sendAuditViewNotification(owner.email, {
                businessName: row.business_name,
                viewCount: displayViewCount,
                hoursSinceCreated,
                lang: owner.preferred_lang || 'en',
              })
            ).catch((mailErr) => {
              captureException(mailErr, { route: 'audit-previews', op: 'view-notify' });
            });
          }
        } catch (e) {
          captureException(e, { route: 'audit-previews', op: 'view-notify-setup' });
        }
      }
    }

    let reviews;
    try {
      reviews = JSON.parse(row.reviews_json);
    } catch {
      reviews = [];
    }

    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      business_name: row.business_name,
      reviews,
      created_at: row.created_at,
      view_count: displayViewCount,
    });
  } catch (err) {
    captureException(err, { route: 'audit-previews', op: 'share-view' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
