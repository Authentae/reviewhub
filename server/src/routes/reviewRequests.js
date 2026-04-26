const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all, insert, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { generateToken, hashToken } = require('../lib/tokens');
const { sendReviewRequest } = require('../lib/email');
const { getPlan } = require('../lib/billing/plans');

const { captureException } = require('../lib/errorReporter');
const router = express.Router();

// Click-tracking redirect — public, no auth. Must be registered BEFORE
// authMiddleware so unauthenticated customers can click the link.
router.get('/track/:token', (req, res) => {
  const hash = hashToken(req.params.token);
  const rr = get('SELECT * FROM review_requests WHERE token_hash = ?', [hash]);
  if (!rr) return res.status(404).send('Link not found or expired.');

  // Record click (idempotent — only store the first click time)
  if (!rr.clicked_at) {
    run("UPDATE review_requests SET clicked_at = datetime('now') WHERE id = ?", [rr.id]);
  }

  // Build the platform review URL from the business's stored IDs
  const biz = get('SELECT * FROM businesses WHERE id = ?', [rr.business_id]);
  const redirectUrl = buildReviewUrl(rr.platform, biz);
  if (!redirectUrl) return res.status(410).send('Review link is no longer available.');

  res.redirect(302, redirectUrl);
});

router.use(authMiddleware);

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many review requests sent, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const VALID_PLATFORMS = ['google', 'yelp', 'facebook'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getUserBusiness(userId) {
  const user = get('SELECT active_business_id FROM users WHERE id = ?', [userId]);
  if (user?.active_business_id) {
    return get('SELECT * FROM businesses WHERE id = ? AND user_id = ?', [user.active_business_id, userId]);
  }
  return get('SELECT * FROM businesses WHERE user_id = ? ORDER BY id ASC LIMIT 1', [userId]);
}

function buildReviewUrl(platform, biz) {
  if (!biz) return null;
  switch (platform) {
    case 'google':
      return biz.google_place_id
        ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(biz.google_place_id)}`
        : null;
    case 'yelp':
      return biz.yelp_business_id
        ? `https://www.yelp.com/writeareview/biz/${encodeURIComponent(biz.yelp_business_id)}`
        : null;
    case 'facebook':
      return biz.facebook_page_id
        ? `https://www.facebook.com/${encodeURIComponent(biz.facebook_page_id)}/reviews/`
        : null;
    default:
      return null;
  }
}

// GET /api/review-requests — list sent requests (paginated), with stats summary
router.get('/', readLimiter, (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.json({ requests: [], stats: null, total: 0 });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const requests = all(
      `SELECT id, customer_name, customer_email, platform, message, sent_at, clicked_at, follow_up_sent_at
       FROM review_requests WHERE business_id = ? ORDER BY sent_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [business.id]
    );
    const totalRow = get('SELECT COUNT(*) as n FROM review_requests WHERE business_id = ?', [business.id]);
    const statsRow = get(
      `SELECT COUNT(*) as sent,
              SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
              SUM(CASE WHEN follow_up_sent_at IS NOT NULL THEN 1 ELSE 0 END) as followed_up
       FROM review_requests WHERE business_id = ?`,
      [business.id]
    );

    res.setHeader('Cache-Control', 'no-store, private');
    res.json({
      requests,
      total: totalRow?.n ?? 0,
      page,
      limit,
      stats: {
        sent: Number(statsRow?.sent ?? 0),
        clicked: Number(statsRow?.clicked ?? 0),
        followed_up: Number(statsRow?.followed_up ?? 0),
      },
    });
  } catch (err) {
    captureException(err, { route: 'reviewRequests' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/review-requests — send a review request email
router.post('/', sendLimiter, async (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const { customer_name, customer_email, platform: platformRaw, message } = req.body;

    if (typeof customer_name !== 'string' || !customer_name.trim()) {
      return res.status(400).json({ error: 'customer_name is required' });
    }
    if (typeof customer_email !== 'string' || !EMAIL_RE.test(customer_email.trim())) {
      return res.status(400).json({ error: 'Valid customer_email is required' });
    }
    const platform = (platformRaw || 'google').trim().toLowerCase();
    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` });
    }
    if (message !== undefined && message !== null && typeof message !== 'string') {
      return res.status(400).json({ error: 'message must be a string' });
    }

    const reviewUrl = buildReviewUrl(platform, business);
    if (!reviewUrl) {
      return res.status(422).json({
        error: `No ${platform} ID configured for your business. Add it in Settings → Connected Platforms.`,
      });
    }

    const name = customer_name.trim().slice(0, 200);
    const email = customer_email.trim().toLowerCase().slice(0, 320);
    const msg = message ? message.trim().slice(0, 500) : null;

    const { plaintext, hash } = generateToken();
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    // The tracking URL goes through the server (not the SPA) so it can do a
    // server-side redirect after logging the click.
    const trackUrl = `${baseUrl}/api/review-requests/track/${plaintext}`;

    const id = insert(
      'INSERT INTO review_requests (business_id, customer_name, customer_email, platform, message, token_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [business.id, name, email, platform, msg, hash]
    );

    await sendReviewRequest({
      customerEmail: email,
      customerName: name,
      businessName: business.business_name,
      platform,
      message: msg,
      trackUrl,
    });

    res.status(201).json({
      id,
      customer_name: name,
      customer_email: email,
      platform,
      sent_at: new Date().toISOString(),
      clicked_at: null,
    });
  } catch (err) {
    captureException(err, { route: 'reviewRequests' });
    res.status(500).json({ error: 'Server error' });
  }
});

const { text: expressText } = require('express');

// POST /api/review-requests/bulk — send review requests from a CSV body
// Body: text/csv with header row "customer_name,customer_email" (or "name,email").
// Optional JSON fields (query params or JSON body): platform, message.
// Requires Starter plan or higher. Max 200 rows per request.
router.post('/bulk', sendLimiter, expressText({ type: ['text/csv', 'text/plain', 'application/octet-stream'], limit: '500kb' }), async (req, res) => {
  try {
    const sub = get('SELECT plan FROM subscriptions WHERE user_id = ?', [req.user.id]);
    const plan = getPlan(sub?.plan || 'free');
    if (!plan.features.templates) { // Starter+ gate (templates is the Starter feature flag)
      return res.status(403).json({
        error: 'Bulk review requests require the Starter plan or higher',
        upgrade: true,
      });
    }

    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    // express.text() sets req.body to the raw string for text/* types.
    // Fall back to req.body.csv for JSON bodies.
    const csvText = typeof req.body === 'string' ? req.body : (req.body?.csv ?? '');
    if (!csvText.trim()) {
      return res.status(400).json({ error: 'CSV data is required' });
    }

    const platform = (req.body?.platform || req.query?.platform || 'google').toString().toLowerCase();
    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` });
    }
    const messageRaw = req.body?.message || req.query?.message;
    const msg = messageRaw ? String(messageRaw).trim().slice(0, 500) : null;

    const reviewUrl = buildReviewUrl(platform, business);
    if (!reviewUrl) {
      return res.status(422).json({
        error: `No ${platform} ID configured for your business. Add it in Settings → Connected Platforms.`,
      });
    }

    const lines = csvText.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return res.status(400).json({ error: 'CSV is empty' });

    // Detect header row (contains "email" as a column name)
    const firstLower = lines[0].toLowerCase();
    const hasHeader = firstLower.includes('email') || firstLower.includes('name');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    if (dataLines.length === 0) return res.status(400).json({ error: 'No data rows found' });
    if (dataLines.length > 200) return res.status(400).json({ error: 'Maximum 200 rows per bulk request' });

    const results = { sent: 0, skipped: 0, errors: [] };
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    for (let i = 0; i < dataLines.length; i++) {
      const cols = dataLines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const [col0 = '', col1 = ''] = cols;
      let customerName, customerEmail;
      if (EMAIL_RE.test(col0)) {
        customerEmail = col0.toLowerCase().slice(0, 320);
        customerName = col1.slice(0, 200) || 'Customer';
      } else {
        customerName = col0.slice(0, 200) || 'Customer';
        customerEmail = col1.toLowerCase().slice(0, 320);
      }
      if (!EMAIL_RE.test(customerEmail)) {
        results.skipped++;
        results.errors.push({ row: i + (hasHeader ? 2 : 1), reason: `Invalid email: ${customerEmail}` });
        continue;
      }
      try {
        const { plaintext, hash } = generateToken();
        const trackUrl = `${baseUrl}/api/review-requests/track/${plaintext}`;
        insert(
          'INSERT INTO review_requests (business_id, customer_name, customer_email, platform, message, token_hash) VALUES (?, ?, ?, ?, ?, ?)',
          [business.id, customerName, customerEmail, platform, msg, hash]
        );
        await sendReviewRequest({
          customerEmail,
          customerName,
          businessName: business.business_name,
          platform,
          message: msg,
          trackUrl,
        });
        results.sent++;
      } catch {
        results.skipped++;
        results.errors.push({ row: i + (hasHeader ? 2 : 1), reason: 'Failed to send' });
      }
    }

    res.json(results);
  } catch (err) {
    captureException(err, { route: 'reviewRequests' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/review-requests/:id/resend — regenerate token and resend email
router.post('/:id/resend', sendLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) return res.status(400).json({ error: 'Invalid ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });
    const rr = get(
      'SELECT * FROM review_requests WHERE id = ? AND business_id = ?',
      [id, business.id]
    );
    if (!rr) return res.status(404).json({ error: 'Not found' });

    const reviewUrl = buildReviewUrl(rr.platform, business);
    if (!reviewUrl) {
      return res.status(422).json({
        error: `No ${rr.platform} ID configured for your business. Add it in Settings → Connected Platforms.`,
      });
    }

    const { plaintext, hash } = generateToken();
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const trackUrl = `${baseUrl}/api/review-requests/track/${plaintext}`;

    run(
      "UPDATE review_requests SET token_hash = ?, sent_at = datetime('now'), clicked_at = NULL WHERE id = ?",
      [hash, rr.id]
    );

    await sendReviewRequest({
      customerEmail: rr.customer_email,
      customerName: rr.customer_name,
      businessName: business.business_name,
      platform: rr.platform,
      message: rr.message,
      trackUrl,
    });

    res.json({ resent: true, sent_at: new Date().toISOString() });
  } catch (err) {
    captureException(err, { route: 'reviewRequests' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/review-requests/:id — remove a single record
router.delete('/:id', readLimiter, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) return res.status(400).json({ error: 'Invalid ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });
    const rr = get('SELECT id FROM review_requests WHERE id = ? AND business_id = ?', [id, business.id]);
    if (!rr) return res.status(404).json({ error: 'Not found' });
    run('DELETE FROM review_requests WHERE id = ?', [rr.id]);
    res.json({ deleted: true });
  } catch (err) {
    captureException(err, { route: 'reviewRequests' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
