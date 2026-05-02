const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all } = require('../db/schema');
const { captureException } = require('../lib/errorReporter');

const router = express.Router();

const widgetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many widget requests',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const STAR_FILLED = '★';
const STAR_EMPTY = '☆';

function stars(rating) {
  const n = Math.round(rating);
  return STAR_FILLED.repeat(Math.max(0, Math.min(5, n))) + STAR_EMPTY.repeat(5 - Math.max(0, Math.min(5, n)));
}

function escHtml(s) {
  // Defence-in-depth: escape ' as well as the common four. Current callers
  // only render into double-quoted attributes / text content, where a bare
  // ' is harmless — but a future copy-paste into a single-quoted attribute
  // would silently regress XSS-safety. The 5-char escape costs nothing.
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// GET /api/public/widget/:id — JSON data for custom widget integrations
router.get('/widget/:id', widgetLimiter, (req, res) => {
  try {
    const bizId = parseInt(req.params.id, 10);
    if (!bizId || bizId <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const biz = get('SELECT id, business_name, widget_enabled FROM businesses WHERE id = ?', [bizId]);
    if (!biz || !biz.widget_enabled) return res.status(404).json({ error: 'Widget not found' });

    // Public surfaces must NEVER include demo-seed rows. A user who clicked
    // "Try with demo data" while exploring and then enabled the widget
    // would otherwise broadcast "Sarah M. / The Corner Bistro" 5-stars to
    // every site embedding their badge. Filter is_demo on every public read.
    const stats = get(
      `SELECT ROUND(AVG(CAST(rating AS REAL)), 1) as avg_rating, COUNT(*) as total
       FROM reviews WHERE business_id = ? AND is_demo = 0`,
      [biz.id]
    );
    const recent = all(
      `SELECT reviewer_name, rating, review_text FROM reviews
       WHERE business_id = ? AND is_demo = 0
         AND (response_text IS NOT NULL AND response_text != '') AND sentiment = 'positive'
       ORDER BY created_at DESC LIMIT 3`,
      [biz.id]
    );

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      business_name: biz.business_name,
      avg_rating: stats?.avg_rating ?? null,
      total: stats?.total ?? 0,
      recent_reviews: recent.map(r => ({
        reviewer_name: r.reviewer_name,
        rating: r.rating,
        review_text: r.review_text ? r.review_text.slice(0, 200) : null,
      })),
    });
  } catch (err) {
    captureException(err, { route: 'public.widget.json' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/public/widget/:id/badge — self-contained HTML badge for iframe embedding
router.get('/widget/:id/badge', widgetLimiter, (req, res) => {
  try {
  const bizId = parseInt(req.params.id, 10);
  if (!bizId || bizId <= 0) return res.status(400).send('Invalid ID');

  const biz = get('SELECT id, business_name, widget_enabled FROM businesses WHERE id = ?', [bizId]);
  if (!biz || !biz.widget_enabled) return res.status(404).send('Widget not found or disabled.');

  // Same demo-row exclusion as the JSON endpoint above — the badge is the
  // most user-visible public surface and a stray demo row would scream.
  const stats = get(
    `SELECT ROUND(AVG(CAST(rating AS REAL)), 1) as avg_rating, COUNT(*) as total
     FROM reviews WHERE business_id = ? AND is_demo = 0`,
    [biz.id]
  );

  const avgRating = stats?.avg_rating ?? null;
  const total = stats?.total ?? 0;
  const displayRating = avgRating != null ? Number(avgRating).toFixed(1) : '—';
  const starsHtml = avgRating != null ? escHtml(stars(avgRating)) : '—';
  const safeName = escHtml(biz.business_name);
  const appUrl = process.env.CLIENT_URL || 'https://reviewhub.review';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex,nofollow">
<title>${safeName} Reviews</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;padding:12px}
  .badge{display:inline-flex;align-items:center;gap:10px;border:1px solid #e5e7eb;border-radius:10px;padding:10px 14px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.07);max-width:280px}
  .stars{color:#f59e0b;font-size:18px;letter-spacing:1px}
  .rating{font-size:22px;font-weight:700;color:#111827;line-height:1}
  .count{font-size:11px;color:#6b7280;margin-top:2px}
  .name{font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:160px}
  .powered{display:block;font-size:9px;color:#9ca3af;text-align:right;margin-top:8px;text-decoration:none}
  .powered:hover{color:#6b7280}
</style>
</head>
<body>
<div class="badge">
  <div>
    <div class="rating">${escHtml(displayRating)}</div>
    <div class="stars" aria-label="${escHtml(displayRating)} out of 5 stars">${starsHtml}</div>
    <div class="count">${total} review${total !== 1 ? 's' : ''}</div>
  </div>
  <div style="flex:1;min-width:0">
    <div class="name" title="${safeName}">${safeName}</div>
    <div style="font-size:11px;color:#6b7280">Customer reviews</div>
  </div>
</div>
<a href="${escHtml(appUrl)}" target="_blank" rel="noopener noreferrer" class="powered">Powered by ReviewHub</a>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  // Don't index the per-business badge URLs themselves. Customer sites
  // embedding them link to /widget/123/badge, and without this header Google
  // would crawl + index thousands of low-value badge pages, diluting our
  // real page-rank for the actual content (Landing, Pricing, Blog).
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  // Allow iframe embedding from any origin — the badge is the entire
  // point of this endpoint, customers paste it on their own websites.
  // Two headers are needed because modern browsers prefer CSP's
  // frame-ancestors over the legacy X-Frame-Options. helmet sets BOTH
  // restrictively at the global level, so we need to overwrite both
  // here per-response. Without overriding the CSP, browsers refuse to
  // render the iframe even if X-Frame-Options says ALLOWALL — the
  // strictest applicable directive wins.
  res.removeHeader('X-Frame-Options');
  // Replacing helmet's CSP with only `frame-ancestors *` would also drop
  // its script-src / object-src restrictions on this response. Be explicit:
  // the badge is server-rendered HTML with zero JavaScript, so script-src
  // 'none' is the correct hardening — even if business_name escaping
  // somehow regressed, an injected <script> still wouldn't execute.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'none'; object-src 'none'; frame-ancestors *; base-uri 'none'"
  );
  res.send(html);
  } catch (err) {
    captureException(err, { route: 'public.widget.badge' });
    res.status(500).send('Server error');
  }
});

// GET /api/public/businesses/:id/reviews — public-facing review feed for the
// business page. Each review carries its `owner_response` (if any) nested
// inline so the frontend can render the response under the review without a
// second round-trip. Unlike the widget endpoints, this one does NOT require
// widget_enabled — it's the canonical public business page.
router.get('/businesses/:id/reviews', widgetLimiter, (req, res) => {
  try {
    const bizId = parseInt(req.params.id, 10);
    if (!bizId || bizId <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const biz = get('SELECT id, business_name FROM businesses WHERE id = ?', [bizId]);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    // LEFT JOIN so reviews without a response come through as well, with
    // the response_* columns NULL.
    const rows = all(
      `SELECT r.id, r.platform, r.reviewer_name, r.rating, r.review_text,
              r.sentiment, r.created_at,
              rr.id AS resp_id, rr.response_text AS resp_text,
              rr.created_at AS resp_created_at, rr.updated_at AS resp_updated_at
       FROM reviews r
       LEFT JOIN review_responses rr ON rr.review_id = r.id
       WHERE r.business_id = ?
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [biz.id, limit]
    );

    const reviews = rows.map(r => ({
      id: r.id,
      platform: r.platform,
      reviewer_name: r.reviewer_name,
      rating: r.rating,
      review_text: r.review_text,
      sentiment: r.sentiment,
      created_at: r.created_at,
      owner_response: r.resp_id ? {
        id: r.resp_id,
        response_text: r.resp_text,
        created_at: r.resp_created_at,
        updated_at: r.resp_updated_at,
      } : null,
    }));

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      business: { id: biz.id, business_name: biz.business_name },
      reviews,
      limit,
    });
  } catch (err) {
    captureException(err, { route: 'public.businesses.reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Free, no-signup AI reply generator ─────────────────────────────────
//
// PLG top-of-funnel tool. Anyone can paste a review and get a draft reply
// without creating an account. Aggressively rate-limited by IP to prevent
// abuse (no per-user quota because there's no user). Converts visitors via
// "sign up for unlimited" CTAs on the tool page.
//
// This is the single highest-leverage SEO asset because the URL ranks for
// "ai review reply generator" / "review response generator" search terms
// that existing competitors don't optimize for.

const freeToolLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,       // 1 hour
  max: 20,                         // 20 drafts per hour per IP
  message: { error: 'Free tool rate limit reached. Create a free account for more drafts.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/review-reply-generator', freeToolLimiter, require('../middleware/honeypot').honeypot({ fakeBody: { draft: 'Thanks for your review! We appreciate your feedback.', source: 'cached' } }), async (req, res) => {
  try {
    const { reviewer_name, rating, review_text, business_name, platform } = req.body || {};

    if (typeof review_text !== 'string' || !review_text.trim()) {
      return res.status(400).json({ error: 'review_text is required' });
    }
    if (review_text.length > 2000) {
      return res.status(400).json({ error: 'review_text must be 2000 characters or fewer' });
    }
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating must be 1-5' });
    }

    // Resolve preferred reply language: explicit body.lang from the public
    // tool's UI (the I18nContext on the client) wins; otherwise fall back to
    // the Accept-Language header. This is the no-auth surface, so there's no
    // stored preferred_lang to read.
    let preferredLang = null;
    const bodyLang = typeof req.body?.lang === 'string' ? req.body.lang.trim().toLowerCase() : '';
    if (/^[a-z]{2}$/.test(bodyLang)) {
      preferredLang = bodyLang;
    } else {
      const accepted = req.acceptsLanguages(['th', 'ja', 'ko', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'en']);
      if (accepted) preferredLang = accepted;
    }

    // Platform is a free-text field on the public form; cap length so an
    // attacker can't pad the AI prompt with a 50KB "platform name" to drain
    // Anthropic credits. Real platform names are <30 chars; 64 is generous.
    const safePlatform = typeof platform === 'string'
      ? platform.toLowerCase().slice(0, 64)
      : 'other';

    const { generateDraft } = require('../lib/aiDrafts');
    const { draft, source } = await generateDraft({
      review: {
        platform: safePlatform,
        reviewer_name: (reviewer_name || '').slice(0, 200) || 'Customer',
        rating: Math.round(ratingNum),
        review_text: review_text.slice(0, 2000),
        sentiment: ratingNum >= 4 ? 'positive' : ratingNum <= 2 ? 'negative' : 'neutral',
      },
      businessName: (business_name || '').slice(0, 200) || 'our business',
      preferredLang,
    });

    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ draft, source });
  } catch (err) {
    // Route via the central error reporter so this surface forwards to Sentry
    // (when configured) rather than spilling a raw stack to stdout.
    captureException(err, {
      route: 'public.review-reply-generator',
      ip: req.ip,
    });
    res.status(500).json({ error: 'Couldn\'t generate a draft right now. Please try again.' });
  }
});

// GET /api/public/platforms — public catalogue of supported review platforms.
//
// Lets external tools (chrome extension, Zapier integrations, the future
// public docs site) discover the canonical set of platform identifiers
// without scraping the client bundle. Cached at the edge for 1h since
// the registry changes rarely.
router.get('/platforms', widgetLimiter, (_req, res) => {
  try {
    const { GLOBAL, LOCAL, INTERNAL, PLATFORM_META } = require('../lib/platforms');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
      global: GLOBAL,
      local: LOCAL,
      internal: INTERNAL,
      meta: PLATFORM_META,
    });
  } catch (err) {
    captureException(err, { route: 'public.platforms' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/public/audit-request — lead capture for the "Free 10 review-reply
// audit" cold-outreach landing page. The prospect submits their Google Business
// (or any review platform) URL + email, we email the founder with the lead, and
// respond with a generic ack. No DB persistence yet — the volume is currently
// low enough that the founder's inbox IS the CRM. Promote to a leads table when
// volume justifies it.
//
// Spam defences:
//   - 5 requests/IP/hour (cold-DM funnels are bursty but not THAT bursty)
//   - Honeypot field 'website' — bots fill every input; humans never see it
//   - Length caps prevent payload-stuffing
//   - Email format validation (loose; we'd rather accept oddities than block legit)
const auditLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many audit requests from this IP. Try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/audit-request', auditLimiter, async (req, res) => {
  try {
    const { businessName, businessUrl, email, notes, website } = req.body || {};

    // Honeypot: bots that fill every form field land here. Return a fake-200
    // so they don't retry — we never email anyone, never log it as a real lead.
    if (website && String(website).trim() !== '') {
      return res.json({ success: true });
    }

    // Validation — fail-fast on missing essentials. Loose email regex
    // (anything@anything.anything) because we'd rather a typo'd lead reach
    // the founder than reject a real prospect.
    //
    // Strip CR/LF from anything that ends up in an email HEADER (Subject,
    // To, From, Reply-To). Without this, a prospect submitting a businessName
    // containing "\r\nBcc: attacker@evil.tld" could inject extra headers and
    // exfiltrate the founder's lead-notification mail to a third party. Body
    // fields can contain newlines safely, so cleanNotes is left alone.
    const stripHeaderChars = (s) => String(s ?? '').replace(/[\r\n]/g, ' ');
    const cleanEmail = stripHeaderChars(String(email || '').trim().toLowerCase().slice(0, 254));
    const cleanBizName = stripHeaderChars(String(businessName || '').trim().slice(0, 200));
    const cleanBizUrl = stripHeaderChars(String(businessUrl || '').trim().slice(0, 1000));
    const cleanNotes = String(notes || '').trim().slice(0, 2000);

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email.' });
    }
    if (!cleanBizName) {
      return res.status(400).json({ error: 'Please tell us your business name.' });
    }
    if (!cleanBizUrl) {
      return res.status(400).json({ error: 'Please share your Google Business or review-platform URL.' });
    }

    // Build the lead-notification email. Plain-text only — this goes to the
    // founder's inbox, not a customer, so design polish doesn't matter.
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || '';
    if (adminEmail) {
      const nodemailer = require('nodemailer');
      const transporter = (() => {
        if (!process.env.SMTP_HOST) return null;
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
      })();
      if (transporter) {
        const text = [
          `New audit request from ${cleanBizName}`,
          ``,
          `Email:    ${cleanEmail}`,
          `Business: ${cleanBizName}`,
          `URL:      ${cleanBizUrl}`,
          `IP:       ${req.ip || 'unknown'}`,
          `UA:       ${(req.headers['user-agent'] || '').slice(0, 200)}`,
          ``,
          cleanNotes ? `Notes:\n${cleanNotes}` : '(no notes)',
          ``,
          `Reply directly to ${cleanEmail} with the audit.`,
        ].join('\n');
        // Fire-and-forget; the prospect's UX shouldn't block on SMTP.
        transporter.sendMail({
          from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
          to: adminEmail,
          replyTo: cleanEmail,
          subject: `[Audit lead] ${cleanBizName} — ${cleanEmail}`,
          text,
        }).catch((err) => {
          captureException(err, { route: 'public.audit-request', op: 'notify-founder' });
        });
      } else {
        console.log(`[AUDIT-LEAD] ${cleanBizName} <${cleanEmail}> ${cleanBizUrl}`);
      }
    } else {
      console.log(`[AUDIT-LEAD] ${cleanBizName} <${cleanEmail}> ${cleanBizUrl}`);
    }

    return res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'public.audit-request' });
    return res.status(500).json({ error: 'Server error. Try again or email us.' });
  }
});

module.exports = router;
