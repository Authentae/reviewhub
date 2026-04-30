const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all, insert, run, transaction } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { seedDemoData, analyzeSentiment } = require('../db/seed');
const { sendNewReviewNotification } = require('../lib/email');
const { substituteVars, hasVars } = require('../lib/templateVars');
const { fireWebhooks } = require('../lib/webhookDelivery');
const { getPlan } = require('../lib/billing/plans');

const { captureException } = require('../lib/errorReporter');
const router = express.Router();
router.use(authMiddleware);

const reviewCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many reviews submitted, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

const seedLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many seed requests' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const draftLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many draft requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

const respondLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: { error: 'Too many response requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

const deleteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many delete requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

const bulkRespondLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many bulk requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many export requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

const summaryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // ~2 req/s — frequent polling from Navbar badge
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200, // generous for a dashboard UI
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Platform whitelist for review CRUD + filters. Must include every provider
// in lib/providers/index.js plus any legacy ones users may have reviews
// against. Adding a new platform: add to this list and the provider registry.
const { VALID_PLATFORMS } = require('../lib/platforms');
const VALID_REVIEW_STATUSES = ['follow_up', 'resolved', 'escalated'];
const ORDER_MAP = {
  newest: 'created_at DESC',
  oldest: 'created_at ASC',
  rating_asc: 'rating ASC',
  rating_desc: 'rating DESC',
  // Unresponded reviews first, then newest — ideal for daily triage
  unresponded_first: "(response_text IS NULL OR response_text = '') DESC, created_at DESC",
  pinned_first: 'pinned DESC, created_at DESC',
};

const STATS_SELECT = `
  SELECT COUNT(*) as total, ROUND(AVG(rating),1) as avg_rating,
    SUM(CASE WHEN sentiment='positive' THEN 1 ELSE 0 END) as positive,
    SUM(CASE WHEN sentiment='negative' THEN 1 ELSE 0 END) as negative,
    SUM(CASE WHEN sentiment='neutral' THEN 1 ELSE 0 END) as neutral,
    SUM(CASE WHEN rating=5 THEN 1 ELSE 0 END) as r5,
    SUM(CASE WHEN rating=4 THEN 1 ELSE 0 END) as r4,
    SUM(CASE WHEN rating=3 THEN 1 ELSE 0 END) as r3,
    SUM(CASE WHEN rating=2 THEN 1 ELSE 0 END) as r2,
    SUM(CASE WHEN rating=1 THEN 1 ELSE 0 END) as r1,
    SUM(CASE WHEN response_text IS NOT NULL AND response_text != '' THEN 1 ELSE 0 END) as responded,
    SUM(CASE WHEN sentiment='negative' AND (response_text IS NULL OR response_text = '') THEN 1 ELSE 0 END) as unresponded_negative
  FROM reviews`;

function getUserBusiness(userId) {
  const user = get('SELECT active_business_id FROM users WHERE id = ?', [userId]);
  if (user?.active_business_id) {
    return get('SELECT * FROM businesses WHERE id = ? AND user_id = ?', [user.active_business_id, userId]);
  }
  return get('SELECT * FROM businesses WHERE user_id = ? ORDER BY id ASC LIMIT 1', [userId]);
}

function parseId(param) {
  const n = parseInt(param, 10);
  return (isFinite(n) && n > 0 && String(n) === String(param)) ? n : null;
}

// Lightweight summary — used by Navbar badge to show unresponded count
router.get('/summary', summaryLimiter, (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.json({ unresponded: 0, demo_count: 0 });
    const row = get(
      "SELECT COUNT(*) as n FROM reviews WHERE business_id = ? AND (response_text IS NULL OR response_text = '')",
      [business.id]
    );
    // Tell the dashboard whether ANY demo-seeded rows are still present
    // so it can show a "Clear demo data" button. Cheap COUNT, runs every
    // 60s alongside the unresponded count.
    const demoRow = get(
      'SELECT COUNT(*) as n FROM reviews WHERE business_id = ? AND is_demo = 1',
      [business.id]
    );
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ unresponded: row?.n ?? 0, demo_count: demoRow?.n ?? 0 });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Review trend — last 12 weeks.
// Groups by calendar date in SQL, then aggregates into Monday-anchored weeks in JS
// for reliable matching (avoids SQLite week-number vs JS week-number mismatch).
router.get('/trend', summaryLimiter, (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.json({ weeks: [] });

    // Fetch daily counts for the last 84 days (12 * 7).
    // Use substr(created_at, 1, 10) instead of date() for robust ISO 8601 parsing
    // regardless of whether created_at has a T/Z suffix or milliseconds.
    const rows = all(
      `SELECT substr(created_at, 1, 10) as day, COUNT(*) as count
       FROM reviews
       WHERE business_id = ? AND substr(created_at, 1, 10) >= date('now', '-84 days')
       GROUP BY day
       ORDER BY day ASC`,
      [business.id]
    );

    // Format a Date as local YYYY-MM-DD (avoids toISOString() UTC drift in non-UTC timezones)
    function toLocalStr(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    // Get the Monday of the week containing d (all local-time arithmetic)
    function getMondayKey(d) {
      const dow = d.getDay(); // 0=Sun
      const offset = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
      return toLocalStr(monday);
    }

    // Aggregate daily counts into Monday-anchored weeks
    const weekMap = {};
    for (const row of rows) {
      // row.day is YYYY-MM-DD string; parse at noon local time to avoid DST boundary issues
      const parts = row.day.split('-');
      const d = new Date(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0);
      const key = getMondayKey(d);
      weekMap[key] = (weekMap[key] || 0) + (Number(row.count) || 0);
    }

    // Build a full 12-week grid (oldest → newest)
    const weeks = [];
    const today = new Date();
    const thisMondayStr = getMondayKey(today);
    const [by, bm, bd] = thisMondayStr.split('-').map(Number);
    const base = new Date(by, bm - 1, bd, 12, 0, 0); // noon local

    for (let i = 11; i >= 0; i--) {
      const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i * 7);
      const key = toLocalStr(monday);
      // No server-side label formatting — the client localises dates using the app's language
      weeks.push({ week: key, count: weekMap[key] || 0 });
    }

    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ weeks });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Analytics — richer weekly breakdown for the Analytics page.
// Returns weekly stats (count, avg_rating, sentiment split, response rate) for the
// last 12 weeks, plus platform breakdown and top reviewers.
router.get('/analytics', summaryLimiter, (req, res) => {
  try {
    const sub = get('SELECT plan FROM subscriptions WHERE user_id = ?', [req.user.id]);
    if (!getPlan(sub?.plan || 'free').features.trend_analytics) {
      return res.status(403).json({ error: 'Trend analytics requires the Pro plan or higher', upgrade: true });
    }
    const business = getUserBusiness(req.user.id);
    if (!business) {
      return res.json({ weeks: [], platforms: [], topReviewers: [], overview: null });
    }

    // Shared date helpers (duplicated from /trend to keep routes self-contained)
    function toLocalStr(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function getMondayKey(d) {
      const offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
      return toLocalStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset));
    }

    // Daily breakdown with sentiment + response for the last 168 days (24 weeks).
    // The extra 12 weeks give us a "prior period" to compare against for delta badges.
    const dailyRows = all(
      `SELECT substr(created_at, 1, 10) as day,
              COUNT(*) as count,
              ROUND(AVG(CAST(rating AS REAL)), 2) as avg_rating,
              SUM(CASE WHEN sentiment='positive' THEN 1 ELSE 0 END) as positive,
              SUM(CASE WHEN sentiment='negative' THEN 1 ELSE 0 END) as negative,
              SUM(CASE WHEN sentiment='neutral'  THEN 1 ELSE 0 END) as neutral,
              SUM(CASE WHEN response_text IS NOT NULL AND response_text != '' THEN 1 ELSE 0 END) as responded
       FROM reviews
       WHERE business_id = ? AND substr(created_at, 1, 10) >= date('now', '-168 days')
       GROUP BY day
       ORDER BY day ASC`,
      [business.id]
    );

    // Aggregate daily rows into Monday-anchored weeks
    const weekMap = {};
    for (const row of dailyRows) {
      const parts = row.day.split('-');
      const d = new Date(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0);
      const key = getMondayKey(d);
      if (!weekMap[key]) weekMap[key] = { count: 0, rating_sum: 0, positive: 0, negative: 0, neutral: 0, responded: 0 };
      const w = weekMap[key];
      w.count     += Number(row.count)     || 0;
      w.rating_sum += (Number(row.avg_rating) || 0) * (Number(row.count) || 0);
      w.positive  += Number(row.positive)  || 0;
      w.negative  += Number(row.negative)  || 0;
      w.neutral   += Number(row.neutral)   || 0;
      w.responded += Number(row.responded) || 0;
    }

    const today = new Date();
    const base = (() => {
      const [by, bm, bd] = getMondayKey(today).split('-').map(Number);
      return new Date(by, bm - 1, bd, 12, 0, 0);
    })();

    const weeks = [];
    for (let i = 23; i >= 0; i--) {
      const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i * 7);
      const key = toLocalStr(monday);
      const w = weekMap[key] || {};
      const count = w.count || 0;
      weeks.push({
        week: key,
        count,
        avg_rating: count > 0 ? Math.round((w.rating_sum / count) * 10) / 10 : null,
        positive:   w.positive  || 0,
        negative:   w.negative  || 0,
        neutral:    w.neutral   || 0,
        responded:  w.responded || 0,
      });
    }

    // Per-platform breakdown (all-time)
    const platformRows = all(
      `SELECT platform,
              COUNT(*) as count,
              ROUND(AVG(CAST(rating AS REAL)), 1) as avg_rating,
              SUM(CASE WHEN response_text IS NOT NULL AND response_text != '' THEN 1 ELSE 0 END) as responded
       FROM reviews WHERE business_id = ?
       GROUP BY platform ORDER BY count DESC`,
      [business.id]
    );
    const platforms = platformRows.map(r => ({
      platform: r.platform,
      count: Number(r.count),
      avg_rating: r.avg_rating ? Number(r.avg_rating) : null,
      response_rate: r.count > 0 ? Math.round((Number(r.responded) / Number(r.count)) * 100) : 0,
    }));

    // Top reviewers by review count
    const topReviewers = all(
      `SELECT reviewer_name, COUNT(*) as count, ROUND(AVG(CAST(rating AS REAL)), 1) as avg_rating
       FROM reviews WHERE business_id = ?
       GROUP BY reviewer_name ORDER BY count DESC LIMIT 10`,
      [business.id]
    );

    // All-time overview
    const ov = get(`${STATS_SELECT} WHERE business_id = ?`, [business.id]);
    const overview = ov ? {
      total:         Number(ov.total)    || 0,
      avg_rating:    ov.avg_rating       ? Number(ov.avg_rating) : null,
      positive:      Number(ov.positive) || 0,
      negative:      Number(ov.negative) || 0,
      neutral:       Number(ov.neutral)  || 0,
      responded:     Number(ov.responded) || 0,
      response_rate: ov.total > 0 ? Math.round((Number(ov.responded) / Number(ov.total)) * 100) : 0,
    } : null;

    // Tag distribution — count how many reviews carry each tag
    const tagRows = all(
      `SELECT t.id, t.name, t.color, COUNT(rt.review_id) as count
       FROM tags t
       JOIN review_tags rt ON t.id = rt.tag_id
       JOIN reviews r ON rt.review_id = r.id
       WHERE t.user_id = ? AND r.business_id = ?
       GROUP BY t.id
       ORDER BY count DESC`,
      [req.user.id, business.id]
    );
    const tagStats = tagRows.map(t => ({
      id: Number(t.id),
      name: t.name,
      color: t.color,
      count: Number(t.count),
    }));

    // Response time stats (only for reviews that have been responded to)
    const rtRow = get(
      `SELECT
         COUNT(*) as responded_count,
         AVG((julianday(responded_at) - julianday(created_at)) * 24) as avg_hours,
         SUM(CASE WHEN (julianday(responded_at) - julianday(created_at)) * 24 <= 24 THEN 1 ELSE 0 END) as within_24h,
         SUM(CASE WHEN (julianday(responded_at) - julianday(created_at)) * 24 <= 168 THEN 1 ELSE 0 END) as within_7d
       FROM reviews
       WHERE business_id = ? AND responded_at IS NOT NULL`,
      [business.id]
    );
    const responseTime = rtRow && Number(rtRow.responded_count) > 0 ? {
      avg_hours:       Math.round(Number(rtRow.avg_hours) * 10) / 10,
      pct_within_24h:  Math.round((Number(rtRow.within_24h) / Number(rtRow.responded_count)) * 100),
      pct_within_7d:   Math.round((Number(rtRow.within_7d)  / Number(rtRow.responded_count)) * 100),
      responded_count: Number(rtRow.responded_count),
    } : null;

    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ weeks, platforms, topReviewers, overview, tagStats, responseTime });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Common English stop words — terms with zero analytical value in a review corpus.
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','up','about','into','through','during','before','after',
  'is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall',
  'can','need','dare','ought','used','not','no','nor','so','yet','both',
  'i','me','my','we','our','you','your','it','its','he','she','they',
  'them','their','this','that','these','those','which','who','whom',
  'what','all','each','every','more','most','very','just','also','too',
  'only','even','much','many','some','any','few','more','own','same',
  'than','then','there','when','where','here','how','if','while','as',
  'am','s','t','re','ve','ll','d','m','didn','don','isn','wasn','can',
]);

// Extract the top-N most frequent meaningful words from review texts.
// Strips punctuation, lower-cases, skips stop words and very short tokens.
function extractKeywords(texts, topN = 30) {
  const freq = {};
  for (const text of texts) {
    if (!text) continue;
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/);
    for (const raw of words) {
      const w = raw.replace(/^['-]+|['-]+$/g, ''); // strip leading/trailing apostrophes/hyphens
      if (!w || w.length < 3 || STOP_WORDS.has(w) || /^\d+$/.test(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .filter(([, n]) => n >= 2) // only words appearing at least twice
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

// GET /api/reviews/keywords — top keywords from review text, with optional filters
router.get('/keywords', summaryLimiter, (req, res) => {
  try {
    const sub = get('SELECT plan FROM subscriptions WHERE user_id = ?', [req.user.id]);
    if (!getPlan(sub?.plan || 'free').features.trend_analytics) {
      return res.status(403).json({ error: 'Keyword analytics requires the Pro plan or higher', upgrade: true });
    }
    const business = getUserBusiness(req.user.id);
    if (!business) return res.json({ keywords: [] });

    const { platform, sentiment } = req.query;
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const { date_from, date_to } = req.query;

    // Reject inverted date range — same guard as the main /api/reviews endpoint
    // so analytics tools surface a clear error instead of silently returning
    // an empty keyword list.
    if (date_from && ISO_DATE_RE.test(date_from)
        && date_to && ISO_DATE_RE.test(date_to)
        && date_from > date_to) {
      return res.status(400).json({ error: 'date_from must be on or before date_to' });
    }

    let where = 'WHERE business_id = ? AND review_text IS NOT NULL AND review_text != \'\'';
    const params = [business.id];

    if (platform && VALID_PLATFORMS.includes(platform)) { where += ' AND platform = ?'; params.push(platform); }
    if (sentiment && ['positive', 'negative', 'neutral'].includes(sentiment)) { where += ' AND sentiment = ?'; params.push(sentiment); }
    if (date_from && ISO_DATE_RE.test(date_from)) { where += ' AND created_at >= ?'; params.push(date_from); }
    if (date_to   && ISO_DATE_RE.test(date_to))   { where += ' AND created_at < ?';  params.push(date_to + 'T23:59:59'); }

    const rows = all(`SELECT review_text FROM reviews ${where} LIMIT 2000`, params);
    const keywords = extractKeywords(rows.map(r => r.review_text));

    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ keywords });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', readLimiter, (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.json({ reviews: [], business: null, stats: null, filteredStats: null, total: 0 });

    const { platform, sentiment, responded, search, pinned, flagged, date_from, date_to, status } = req.query;
    const sort = ORDER_MAP[req.query.sort] ? req.query.sort : 'newest';
    // Radix 10 explicit — see reviewRequests.js note about hex coercion.
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let where = 'WHERE business_id = ?';
    const params = [business.id];

    if (platform && VALID_PLATFORMS.includes(platform)) { where += ' AND platform = ?'; params.push(platform); }
    if (sentiment && ['positive', 'negative', 'neutral'].includes(sentiment)) { where += ' AND sentiment = ?'; params.push(sentiment); }
    if (responded === 'yes') { where += " AND response_text IS NOT NULL AND response_text != ''"; }
    if (responded === 'no') { where += " AND (response_text IS NULL OR response_text = '')"; }
    const ratingFilterRaw = Number(req.query.rating);
    const ratingFilter = Number.isInteger(ratingFilterRaw) && ratingFilterRaw >= 1 && ratingFilterRaw <= 5 ? ratingFilterRaw : null;
    if (ratingFilter) { where += ' AND rating = ?'; params.push(ratingFilter); }
    if (pinned === 'true') { where += ' AND pinned = 1'; }
    if (flagged === 'true') { where += ' AND flagged = 1'; }
    if (status && VALID_REVIEW_STATUSES.includes(status)) { where += ' AND status = ?'; params.push(status); }
    // Date range: accept ISO date strings (YYYY-MM-DD) and compare against
    // created_at which is stored as 'YYYY-MM-DD HH:MM:SS' in SQLite.
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    // Reject inverted date ranges with a clear 400 — silent empty results
    // make it look like there are no reviews when the range was just typed
    // backwards. Strings compare lexicographically the same way ISO dates
    // sort, so "2026-04-21" > "2026-04-20" works without parsing to Date.
    if (date_from && ISO_DATE_RE.test(date_from)
        && date_to && ISO_DATE_RE.test(date_to)
        && date_from > date_to) {
      return res.status(400).json({ error: 'date_from must be on or before date_to' });
    }
    if (date_from && ISO_DATE_RE.test(date_from)) { where += ' AND created_at >= ?'; params.push(date_from); }
    if (date_to   && ISO_DATE_RE.test(date_to))   { where += ' AND created_at < ?';  params.push(date_to + 'T23:59:59'); }
    if (search) {
      // Escape SQL LIKE metacharacters so a customer searching for an
      // underscore name (e.g. "John_Smith") doesn't match "John Smith"
      // by accident. \\ is the chosen escape char; ESCAPE '\' tells SQLite.
      const escaped = search.trim().slice(0, 200).replace(/[\\%_]/g, '\\$&');
      const q = `%${escaped}%`;
      // Include private note in search — notes are only visible to the owner
      where += " AND (reviewer_name LIKE ? ESCAPE '\\' OR review_text LIKE ? ESCAPE '\\' OR response_text LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')";
      params.push(q, q, q, q);
    }
    // Tag filter has to live in the WHERE clause so LIMIT/OFFSET pagination
    // and the COUNT(*) total stay consistent. Doing this in JS post-fetch
    // (the previous behavior) shrunk the page after LIMIT was applied,
    // breaking page totals and producing partial pages.
    const tagIdFilter = req.query.tag_id ? parseId(req.query.tag_id) : null;
    if (tagIdFilter) {
      where += ' AND id IN (SELECT review_id FROM review_tags WHERE tag_id = ?)';
      params.push(tagIdFilter);
    }

    const reviews = all(
      `SELECT * FROM reviews ${where} ORDER BY ${ORDER_MAP[sort]} LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const totalRow = get(`SELECT COUNT(*) as total FROM reviews ${where}`, params);

    const globalStats = get(`${STATS_SELECT} WHERE business_id = ?`, [business.id]);

    // Per-platform breakdown — always global (not filtered) to give full context
    const platformRows = all(
      'SELECT platform, COUNT(*) as count FROM reviews WHERE business_id = ? GROUP BY platform',
      [business.id]
    );
    const platformCounts = Object.fromEntries(platformRows.map(r => [r.platform, Number(r.count)]));

    const hasFilters = platform || sentiment || responded || ratingFilter || search || pinned || flagged || status || date_from || date_to || tagIdFilter;
    const filteredStats = hasFilters ? get(`${STATS_SELECT} ${where}`, params) : null;

    // Batch-load tags for all reviews on this page in a single query
    let reviewsWithTags = reviews;
    if (reviews.length > 0) {
      const reviewIds = reviews.map(r => r.id);
      const ph = reviewIds.map(() => '?').join(',');
      const tagRows = all(
        `SELECT rt.review_id, t.id, t.name, t.color
         FROM review_tags rt JOIN tags t ON t.id = rt.tag_id
         WHERE rt.review_id IN (${ph}) ORDER BY t.name ASC`,
        reviewIds
      );
      const tagsByReview = {};
      for (const row of tagRows) {
        if (!tagsByReview[row.review_id]) tagsByReview[row.review_id] = [];
        tagsByReview[row.review_id].push({ id: row.id, name: row.name, color: row.color });
      }
      reviewsWithTags = reviews.map(r => ({ ...r, tags: tagsByReview[r.id] || [] }));
    }

    // tag_id is now applied in the WHERE clause above; no post-fetch trim.
    // demo_count lets the dashboard surface a "Clear demo data" affordance
    // even when the user has paged past the seeded rows or filtered them out.
    const demoRow = get(
      'SELECT COUNT(*) as n FROM reviews WHERE business_id = ? AND is_demo = 1',
      [business.id]
    );
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ reviews: reviewsWithTags, business, stats: globalStats, filteredStats, platformCounts, total: totalRow?.total ?? 0, demo_count: demoRow?.n ?? 0, page, limit, sort });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/seed', seedLimiter, (req, res) => {
  // Demo-data seed. The onboarding checklist surfaces this as the "Try with
  // demo data" shortcut — giving new users an instant-value path without
  // needing to hook up a real platform. To avoid letting an established
  // account pollute its real review history, we allow seeding only when the
  // caller's business has zero existing reviews OR the operator has opted
  // in globally via SEED_DEMO=1 (useful for demo tenants / staging sandboxes).
  try {
    const business = getUserBusiness(req.user.id);
    const existingCount = business
      ? get('SELECT COUNT(*) as n FROM reviews WHERE business_id = ?', [business.id])?.n ?? 0
      : 0;
    const onboardingCase = existingCount === 0;
    const operatorOverride = process.env.SEED_DEMO === '1';
    if (!onboardingCase && !operatorOverride) {
      return res.status(403).json({ error: 'Demo data can only be loaded on an empty account.' });
    }
    const result = seedDemoData(req.user.id);
    res.json(result);
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Clear demo data — wipe ONLY the rows the seed inserted (is_demo = 1),
// leaving any real reviews the user has imported / received untouched.
// Without this endpoint a user who clicked "Try with demo data" had no way
// to get back to a clean account; they were stuck looking at "The Corner
// Bistro" reviews on their actual business forever.
router.delete('/seed', seedLimiter, (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });
    // Count first so we can return how many were wiped — `run()` doesn't
    // surface .changes through our schema helper. FK on review_tags has
    // ON DELETE CASCADE so tag links go with the parent rows.
    const before = get(
      'SELECT COUNT(*) as n FROM reviews WHERE business_id = ? AND is_demo = 1',
      [business.id]
    );
    run(
      'DELETE FROM reviews WHERE business_id = ? AND is_demo = 1',
      [business.id]
    );
    res.json({ success: true, removed: before?.n ?? 0 });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk respond — send the same response to multiple unresponded reviews in one shot.
// Only updates reviews that have no existing response (skips already-responded ones).
// Max 50 IDs per call so the operator's DB doesn't get hammered.
router.post('/bulk-respond', bulkRespondLimiter, (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const { review_ids, response_text } = req.body;
    if (!Array.isArray(review_ids) || review_ids.length === 0) {
      return res.status(400).json({ error: 'review_ids must be a non-empty array' });
    }
    if (review_ids.length > 50) {
      return res.status(400).json({ error: 'Cannot bulk-respond to more than 50 reviews at once' });
    }
    for (const id of review_ids) {
      const n = parseInt(id, 10);
      if (!Number.isFinite(n) || n <= 0 || String(n) !== String(id)) {
        return res.status(400).json({ error: 'All review_ids must be positive integers' });
      }
    }
    if (typeof response_text !== 'string') {
      return res.status(400).json({ error: 'response_text must be a string' });
    }
    const text = response_text.trim();
    if (!text) return res.status(400).json({ error: 'response_text is required' });
    if (text.length > 1000) return res.status(400).json({ error: 'Response too long (max 1000 chars)' });

    // Target only reviews that belong to this user's business AND have no response yet.
    // Skipping already-responded reviews prevents overwriting deliberate custom replies.
    const placeholders = review_ids.map(() => '?').join(',');
    const targets = all(
      `SELECT id FROM reviews WHERE id IN (${placeholders}) AND business_id = ? AND (response_text IS NULL OR response_text = '')`,
      [...review_ids.map(Number), business.id]
    );

    if (targets.length === 0) {
      return res.json({ updated: 0, skipped: review_ids.length });
    }

    // Fetch full review rows once so we can both substitute vars (when
    // the template needs them) AND fire webhooks afterwards. Targets are
    // first-response only, so every row here is a true unanswered → answered
    // transition — exactly when review.responded should fire.
    const fullReviews = all(
      `SELECT * FROM reviews WHERE id IN (${targets.map(() => '?').join(',')})`,
      targets.map(r => r.id)
    );

    if (hasVars(text)) {
      for (const review of fullReviews) {
        const substituted = substituteVars(text, review, business);
        run(
          "UPDATE reviews SET response_text = ?, responded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
          [substituted, review.id]
        );
      }
    } else {
      const targetIds = fullReviews.map(r => r.id);
      const ph2 = targetIds.map(() => '?').join(',');
      run(
        `UPDATE reviews SET response_text = ?, responded_at = datetime('now'), updated_at = datetime('now') WHERE id IN (${ph2})`,
        [text, ...targetIds]
      );
    }

    // Fire review.responded for each newly-answered review. Single-respond
    // fires this; bulk-respond previously didn't, so Slack/Zapier integrations
    // missed every bulk reply event.
    for (const review of fullReviews) {
      fireWebhooks(req.user.id, 'review.responded', {
        id: review.id,
        platform: review.platform,
        reviewer_name: review.reviewer_name,
        rating: review.rating,
        response_text: hasVars(text) ? substituteVars(text, review, business) : text,
      });
    }

    res.json({ updated: targets.length, skipped: review_ids.length - targets.length });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk delete — permanently removes a batch of reviews in one call.
// Max 50 IDs per call. Only deletes reviews that belong to the user's business.
router.post('/bulk-delete', bulkRespondLimiter, (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const { review_ids } = req.body;
    if (!Array.isArray(review_ids) || review_ids.length === 0) {
      return res.status(400).json({ error: 'review_ids must be a non-empty array' });
    }
    if (review_ids.length > 50) {
      return res.status(400).json({ error: 'Cannot bulk-delete more than 50 reviews at once' });
    }
    for (const id of review_ids) {
      const n = parseInt(id, 10);
      if (!Number.isFinite(n) || n <= 0 || String(n) !== String(id)) {
        return res.status(400).json({ error: 'All review_ids must be positive integers' });
      }
    }

    const placeholders = review_ids.map(() => '?').join(',');
    const targets = all(
      `SELECT id FROM reviews WHERE id IN (${placeholders}) AND business_id = ?`,
      [...review_ids.map(Number), business.id]
    );
    if (targets.length === 0) return res.json({ deleted: 0 });

    const targetIds = targets.map(r => r.id);
    const ph2 = targetIds.map(() => '?').join(',');
    // Also clean up orphaned review_tags rows (FK cascade not guaranteed in SQLite)
    run(`DELETE FROM review_tags WHERE review_id IN (${ph2})`, targetIds);
    run(`DELETE FROM reviews WHERE id IN (${ph2})`, targetIds);

    res.json({ deleted: targetIds.length });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk tag — applies a single tag to a batch of reviews.
// Body: { review_ids: [...], tag_id: N }. Max 50 IDs. Uses INSERT OR IGNORE to skip duplicates.
router.post('/bulk-tag', bulkRespondLimiter, (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const { review_ids, tag_id } = req.body;
    if (!Array.isArray(review_ids) || review_ids.length === 0) {
      return res.status(400).json({ error: 'review_ids must be a non-empty array' });
    }
    if (review_ids.length > 50) {
      return res.status(400).json({ error: 'Cannot bulk-tag more than 50 reviews at once' });
    }
    for (const id of review_ids) {
      const n = parseInt(id, 10);
      if (!Number.isFinite(n) || n <= 0 || String(n) !== String(id)) {
        return res.status(400).json({ error: 'All review_ids must be positive integers' });
      }
    }
    const tagIdN = parseInt(tag_id, 10);
    if (!Number.isFinite(tagIdN) || tagIdN <= 0) {
      return res.status(400).json({ error: 'tag_id must be a positive integer' });
    }

    const tag = get('SELECT id FROM tags WHERE id = ? AND user_id = ?', [tagIdN, req.user.id]);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });

    const placeholders = review_ids.map(() => '?').join(',');
    const targets = all(
      `SELECT id FROM reviews WHERE id IN (${placeholders}) AND business_id = ?`,
      [...review_ids.map(Number), business.id]
    );
    if (targets.length === 0) return res.json({ tagged: 0 });

    const targetIds = targets.map(r => r.id);
    transaction((tx) => {
      for (const id of targetIds) {
        tx.run('INSERT OR IGNORE INTO review_tags (review_id, tag_id) VALUES (?, ?)', [id, tagIdN]);
      }
    });

    res.json({ tagged: targetIds.length });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk status — sets (or clears) a status on a batch of reviews at once.
// Body: { review_ids: [...], status: 'follow_up'|'resolved'|'escalated'|null }. Max 50 IDs.
router.post('/bulk-status', bulkRespondLimiter, (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const { review_ids, status } = req.body;
    if (!Array.isArray(review_ids) || review_ids.length === 0) {
      return res.status(400).json({ error: 'review_ids must be a non-empty array' });
    }
    if (review_ids.length > 50) {
      return res.status(400).json({ error: 'Cannot bulk-update more than 50 reviews at once' });
    }
    for (const id of review_ids) {
      const n = parseInt(id, 10);
      if (!Number.isFinite(n) || n <= 0 || String(n) !== String(id)) {
        return res.status(400).json({ error: 'All review_ids must be positive integers' });
      }
    }
    if (status !== null && status !== undefined && !VALID_REVIEW_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_REVIEW_STATUSES.join(', ')}, or null` });
    }

    const placeholders = review_ids.map(() => '?').join(',');
    const targets = all(
      `SELECT id FROM reviews WHERE id IN (${placeholders}) AND business_id = ?`,
      [...review_ids.map(Number), business.id]
    );
    if (targets.length === 0) return res.json({ updated: 0 });

    const targetIds = targets.map(r => r.id);
    const ph2 = targetIds.map(() => '?').join(',');
    const newStatus = status || null;
    run(
      `UPDATE reviews SET status = ?, updated_at = datetime('now') WHERE id IN (${ph2})`,
      [newStatus, ...targetIds]
    );

    res.json({ updated: targetIds.length });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk untag — removes a tag from a batch of reviews. Same validation as bulk-tag.
router.post('/bulk-untag', bulkRespondLimiter, (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const { review_ids, tag_id } = req.body;
    if (!Array.isArray(review_ids) || review_ids.length === 0) {
      return res.status(400).json({ error: 'review_ids must be a non-empty array' });
    }
    if (review_ids.length > 50) {
      return res.status(400).json({ error: 'Cannot bulk-untag more than 50 reviews at once' });
    }
    for (const id of review_ids) {
      const n = parseInt(id, 10);
      if (!Number.isFinite(n) || n <= 0 || String(n) !== String(id)) {
        return res.status(400).json({ error: 'All review_ids must be positive integers' });
      }
    }
    const tagIdN = parseInt(tag_id, 10);
    if (!Number.isFinite(tagIdN) || tagIdN <= 0) {
      return res.status(400).json({ error: 'tag_id must be a positive integer' });
    }

    const tag = get('SELECT id FROM tags WHERE id = ? AND user_id = ?', [tagIdN, req.user.id]);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });

    const placeholders = review_ids.map(() => '?').join(',');
    const targets = all(
      `SELECT id FROM reviews WHERE id IN (${placeholders}) AND business_id = ?`,
      [...review_ids.map(Number), business.id]
    );
    if (targets.length === 0) return res.json({ untagged: 0 });

    const targetIds = targets.map(r => r.id);
    const ph2 = targetIds.map(() => '?').join(',');
    run(
      `DELETE FROM review_tags WHERE tag_id = ? AND review_id IN (${ph2})`,
      [tagIdN, ...targetIds]
    );

    res.json({ untagged: targetIds.length });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', reviewCreateLimiter, async (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const { platform: platformRaw, reviewer_name, rating, review_text } = req.body;
    // Type-guard against non-string JSON values (arrays, objects, numbers)
    // so .trim() / .toLowerCase() can't throw on malformed input. Without
    // these, a POST with {"reviewer_name": ["x"]} hit the route's 500 path.
    if (typeof platformRaw !== 'string' || typeof reviewer_name !== 'string') {
      return res.status(400).json({ error: 'platform and reviewer_name must be strings' });
    }
    if (review_text !== undefined && review_text !== null && typeof review_text !== 'string') {
      return res.status(400).json({ error: 'review_text must be a string' });
    }
    const platform = platformRaw.trim().toLowerCase();
    if (!platform || !reviewer_name || rating == null) return res.status(400).json({ error: 'platform, reviewer_name, and rating are required' });
    if (!VALID_PLATFORMS.includes(platform)) return res.status(400).json({ error: 'unknown platform' });
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) return res.status(400).json({ error: 'rating must be an integer 1–5' });
    const nameClean = reviewer_name.trim().slice(0, 200);
    if (!nameClean) return res.status(400).json({ error: 'reviewer_name is required' });
    const textClean = (review_text || '').trim();
    if (textClean.length > 5000) return res.status(400).json({ error: 'review_text too long (max 5000 chars)' });

    const sentimentRaw = analyzeSentiment(ratingNum, textClean);
    const sentiment = ['positive', 'negative', 'neutral'].includes(sentimentRaw) ? sentimentRaw : 'neutral';
    const id = insert(
      'INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment) VALUES (?, ?, ?, ?, ?, ?)',
      [business.id, platform, nameClean, ratingNum, textClean, sentiment]
    );

    const review = get('SELECT * FROM reviews WHERE id = ?', [id]);
    const user = get(
      `SELECT u.email, u.notif_new_review, u.notif_negative_alert, s.plan
       FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (user && review) {
      const planFeatures = getPlan(user.plan || 'free').features;
      const wantsNew = user.notif_new_review !== 0 && planFeatures.email_alerts_new;
      const wantsNeg = user.notif_negative_alert !== 0 && planFeatures.email_alerts_negative && sentiment === 'negative';
      if (wantsNew || wantsNeg) {
        sendNewReviewNotification(user.email, review, business.business_name).catch((err) => {
          console.error('[EMAIL] Failed to send new review notification:', err.message);
          captureException(err, { kind: 'email.send_failed', label: 'new-review-notification', userId: user.id });
        });
        // Mirror to LINE if configured. Fire-and-forget — LINE module
        // never throws, so no .catch needed.
        const line = require('../lib/notifications/line');
        line.notifyNewReview(review, business.business_name);
      }
    }

    // Auto-respond rules: check enabled rules for this user in order (oldest first).
    // First matching rule wins. Rules with NULL criteria match any value for that field.
    const rules = all(
      `SELECT * FROM auto_rules WHERE user_id = ? AND enabled = 1 ORDER BY created_at ASC`,
      [req.user.id]
    );
    for (const rule of rules) {
      const platformMatch = rule.platform == null || rule.platform === platform;
      const ratingMinMatch = rule.min_rating == null || ratingNum >= rule.min_rating;
      const ratingMaxMatch = rule.max_rating == null || ratingNum <= rule.max_rating;
      const sentimentMatch = rule.sentiment == null || rule.sentiment === sentiment;
      // Keyword match: ALL listed keywords must appear in the review text (case-insensitive).
      // NULL match_keywords means "match any review text."
      let keywordMatch = true;
      if (rule.match_keywords) {
        try {
          const kws = JSON.parse(rule.match_keywords);
          // Defensive shape check: a corrupted match_keywords cell (or one
          // saved by an older buggy version) might be a non-array, or an
          // array of non-strings. Treat anything that doesn't validate as
          // "no keyword filter" — same as NULL — rather than throwing
          // mid-iteration and causing this auto-rule to silently fail
          // for every future review on the affected user.
          if (Array.isArray(kws) && kws.length > 0) {
            const text = (textClean || '').toLowerCase();
            keywordMatch = kws.every((kw) =>
              typeof kw === 'string' && text.includes(kw.toLowerCase())
            );
          }
        } catch { keywordMatch = true; }
      }
      if (platformMatch && ratingMinMatch && ratingMaxMatch && sentimentMatch && keywordMatch) {
        const autoText = substituteVars(rule.response_text, review, business);
        run(
          "UPDATE reviews SET response_text = ?, responded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
          [autoText, id]
        );
        if (rule.tag_id) {
          const tag = get('SELECT id FROM tags WHERE id = ? AND user_id = ?', [rule.tag_id, req.user.id]);
          if (tag) {
            const alreadyTagged = get('SELECT 1 FROM review_tags WHERE review_id = ? AND tag_id = ?', [id, tag.id]);
            if (!alreadyTagged) {
              run('INSERT INTO review_tags (review_id, tag_id) VALUES (?, ?)', [id, tag.id]);
            }
          }
        }
        break; // first match only
      }
    }

    const finalReview = get('SELECT * FROM reviews WHERE id = ?', [id]);
    // Pull the (possibly auto-applied) tags so subscribers can route on
    // them — e.g. an auto-rule that tags 1-star reviews "urgent" lets a
    // Zapier flow page the on-call from the same review.created event.
    // Without this the receiver would have to round-trip back to
    // /api/reviews/:id/tags to discover them.
    const reviewTags = all(
      `SELECT t.id, t.name, t.color
       FROM tags t JOIN review_tags rt ON rt.tag_id = t.id
       WHERE rt.review_id = ?`,
      [id]
    );
    // Fire outbound webhooks async — never blocks the response.
    fireWebhooks(req.user.id, 'review.created', {
      id: finalReview.id,
      platform: finalReview.platform,
      reviewer_name: finalReview.reviewer_name,
      rating: finalReview.rating,
      sentiment: finalReview.sentiment,
      review_text: finalReview.review_text,
      created_at: finalReview.created_at,
      tags: reviewTags,
    });
    // If an auto-rule answered this review, fire review.responded too —
    // matches single-respond and bulk-respond semantics so integrations
    // see the unanswered → answered transition regardless of source.
    if (finalReview?.response_text) {
      fireWebhooks(req.user.id, 'review.responded', {
        id: finalReview.id,
        platform: finalReview.platform,
        reviewer_name: finalReview.reviewer_name,
        rating: finalReview.rating,
        response_text: finalReview.response_text,
      });
    }
    res.status(201).json({ review: finalReview, autoResponded: finalReview?.response_text ? true : false });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reviews/:id/translate
//
// Translate a single review's text into the caller's preferred language
// (defaults to the user's locale). Doesn't store the translation — runs
// fresh on each request so users can re-translate after the underlying
// review_text changes (e.g. owner-edited).
//
// Cheap rate limiter to discourage abuse: 30 translations / 5 min.
const translateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/:id/translate', translateLimiter, async (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });
    const review = get(
      'SELECT id, review_text FROM reviews WHERE id = ? AND business_id = ?',
      [reviewId, business.id]
    );
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (!review.review_text) return res.status(400).json({ error: 'Review has no text to translate' });

    // Target language: user-preferred via ?to=, otherwise the user's locale,
    // otherwise English. Locked to known languages to avoid prompt-injection.
    const validLangs = ['en', 'th', 'ja', 'ko', 'zh', 'es', 'fr', 'de', 'pt', 'it'];
    const target = validLangs.includes(req.query.to) ? req.query.to
      : validLangs.includes(req.user.preferred_lang) ? req.user.preferred_lang
      : 'en';
    const langName = {
      en: 'English', th: 'Thai', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
      es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian',
    }[target];

    // Reuse the AI client from aiDrafts. Falls back to mock client when
    // ANTHROPIC_API_KEY is unset (returns the original text in dev).
    const Anthropic = require('@anthropic-ai/sdk');
    const { createMockClient, shouldUseMock } = require('../lib/mockAnthropic');
    let client;
    if (shouldUseMock()) {
      client = createMockClient();
    } else if (process.env.ANTHROPIC_API_KEY) {
      client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else {
      // No AI configured — return the source as-is rather than 500.
      return res.json({ translated_text: review.review_text, target, untranslated: true });
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';
    let translated;
    try {
      const out = await client.messages.create({
        model,
        max_tokens: 1500,
        system: `You are a translator. Translate the user's text into ${langName}. Return ONLY the translation — no preamble, no notes, no quotes around it. Preserve the original tone and any star/emoji glyphs.`,
        messages: [{ role: 'user', content: review.review_text }],
      });
      translated = (out?.content?.[0]?.text || '').trim();
    } catch (err) {
      captureException(err, { kind: 'anthropic.translate_failed', reviewId });
      return res.status(503).json({ error: 'Translation service unavailable' });
    }
    if (!translated) translated = review.review_text;

    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ translated_text: translated, target });
  } catch (err) {
    captureException(err, { route: 'reviews.translate' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/respond', respondLimiter, async (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const review = get('SELECT * FROM reviews WHERE id = ? AND business_id = ?', [reviewId, business.id]);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const rawResponseText = req.body.response_text;
    if (rawResponseText !== undefined && rawResponseText !== null && typeof rawResponseText !== 'string') {
      return res.status(400).json({ error: 'response_text must be a string' });
    }
    const rawTrimmed = (rawResponseText || '').trim();
    if (!rawTrimmed) return res.status(400).json({ error: 'Response text required' });
    if (rawTrimmed.length > 1000) return res.status(400).json({ error: 'Response too long (max 1000 chars)' });
    const response_text = substituteVars(rawTrimmed, review, business);

    // Save locally first (source of truth) — even if the optional external
    // post-back fails, the user's reply is preserved in our DB so the UI
    // shows it and the next export/digest captures it.
    // responded_at is set only the first time a response is saved (first reply timestamp).
    const isFirstResponse = !review.response_text || review.response_text.trim() === '';
    if (isFirstResponse) {
      run("UPDATE reviews SET response_text = ?, responded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", [response_text, review.id]);
    } else {
      run("UPDATE reviews SET response_text = ?, updated_at = datetime('now') WHERE id = ?", [response_text, review.id]);
    }

    // Optional: post the reply back to the source platform so it shows up
    // publicly. Gated by REPLY_TO_PLATFORMS env var — set it to something
    // like "google" (comma-separated) to enable per-provider. Off by default
    // because it requires the operator to have write-scope on that platform
    // AND to accept the regulatory/review-platform rules around responses.
    const enabled = (process.env.REPLY_TO_PLATFORMS || '').split(',').map(s => s.trim()).filter(Boolean);
    let posted = false;
    let postError = null;
    if (enabled.includes(review.platform) && review.external_id) {
      try {
        const conn = get(
          `SELECT * FROM platform_connections WHERE business_id = ? AND provider = ?`,
          [business.id, review.platform]
        );
        if (conn) {
          const { getProvider } = require('../lib/providers');
          const provider = getProvider(conn);
          if (provider && typeof provider.replyToReview === 'function') {
            await provider.replyToReview(review.external_id, response_text);
            posted = true;
          }
        }
      } catch (err) {
        postError = 'Failed to post reply to platform';
        // Don't fail the user's save — just surface the error alongside success.
        console.error(`[REPLY-POST] ${review.platform}:${review.external_id} failed: ${postError}`);
        captureException(err, {
          route: 'reviews',
          op: 'reply-post-back',
          platform: review.platform,
          externalId: review.external_id,
          userId: req.user.id,
        });
      }
    }

    // Fire `review.responded` only on the FIRST response. Edits to an
    // existing response shouldn't re-notify Slack/Zapier integrations —
    // the customer's review only transitions from "unanswered" to
    // "answered" once; subsequent typo fixes aren't a new event.
    if (isFirstResponse) {
      fireWebhooks(req.user.id, 'review.responded', {
        id: review.id,
        platform: review.platform,
        reviewer_name: review.reviewer_name,
        rating: review.rating,
        response_text,
      });
    }
    res.json({ success: true, response_text, posted, postError });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle pin on a review — pinned reviews float to top of the pinned filter
router.put('/:id/pin', respondLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const review = get('SELECT id, pinned FROM reviews WHERE id = ? AND business_id = ?', [reviewId, business.id]);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const newPinned = review.pinned ? 0 : 1;
    run("UPDATE reviews SET pinned = ?, updated_at = datetime('now') WHERE id = ?", [newPinned, review.id]);
    // Return the fresh updated_at so the UI's "Updated X ago" line refreshes
    // immediately on toggle, instead of waiting for a refetch.
    const fresh = get('SELECT updated_at FROM reviews WHERE id = ?', [review.id]);
    res.json({ success: true, pinned: !!newPinned, updated_at: fresh?.updated_at });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Flag / unflag a review for follow-up attention.
router.put('/:id/flag', respondLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const review = get('SELECT id, flagged FROM reviews WHERE id = ? AND business_id = ?', [reviewId, business.id]);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const newFlagged = review.flagged ? 0 : 1;
    run("UPDATE reviews SET flagged = ?, updated_at = datetime('now') WHERE id = ?", [newFlagged, review.id]);
    const fresh = get('SELECT updated_at FROM reviews WHERE id = ?', [review.id]);
    res.json({ success: true, flagged: !!newFlagged, updated_at: fresh?.updated_at });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Override sentiment on a review — lets users correct auto-classification.
// Accepts { sentiment: 'positive' | 'negative' | 'neutral' }.
router.put('/:id/sentiment', respondLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const review = get('SELECT id FROM reviews WHERE id = ? AND business_id = ?', [reviewId, business.id]);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const { sentiment } = req.body;
    if (!['positive', 'negative', 'neutral'].includes(sentiment)) {
      return res.status(400).json({ error: 'sentiment must be positive, negative, or neutral' });
    }

    run("UPDATE reviews SET sentiment = ?, sentiment_override = 1, updated_at = datetime('now') WHERE id = ?", [sentiment, review.id]);
    res.json({ success: true, sentiment });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Set a custom status on a review. Accepts { status: 'follow_up'|'resolved'|'escalated'|null }.
// Passing null clears the status back to the default (no status).
router.put('/:id/status', respondLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const review = get('SELECT id FROM reviews WHERE id = ? AND business_id = ?', [reviewId, business.id]);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const { status } = req.body;
    if (status !== null && status !== undefined && !VALID_REVIEW_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_REVIEW_STATUSES.join(', ')}, or null` });
    }

    const newStatus = status || null;
    run("UPDATE reviews SET status = ?, updated_at = datetime('now') WHERE id = ?", [newStatus, review.id]);
    res.json({ success: true, status: newStatus });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Private note on a review (only visible to the business owner, never to customers)
router.put('/:id/note', respondLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const review = get('SELECT id FROM reviews WHERE id = ? AND business_id = ?', [reviewId, business.id]);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const rawNote = req.body.note;
    if (rawNote !== undefined && rawNote !== null && typeof rawNote !== 'string') {
      return res.status(400).json({ error: 'note must be a string' });
    }
    const note = (rawNote ?? '').trim();
    if (note.length > 2000) return res.status(400).json({ error: 'Note too long (max 2000 chars)' });

    run("UPDATE reviews SET note = ?, updated_at = datetime('now') WHERE id = ?", [note || null, review.id]);
    const fresh = get('SELECT updated_at FROM reviews WHERE id = ?', [review.id]);
    res.json({ success: true, note: note || null, updated_at: fresh?.updated_at });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Replace all tags on a review (PUT replaces — POST would append)
router.put('/:id/tags', respondLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const review = get('SELECT id FROM reviews WHERE id = ? AND business_id = ?', [reviewId, business.id]);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const { tag_ids } = req.body;
    if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids must be an array' });
    if (tag_ids.length > 20) return res.status(400).json({ error: 'Max 20 tags per review' });

    // Validate each id and confirm they all belong to this user
    const ids = [];
    for (const id of tag_ids) {
      const n = parseInt(id, 10);
      if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'All tag_ids must be positive integers' });
      ids.push(n);
    }

    if (ids.length > 0) {
      const ph = ids.map(() => '?').join(',');
      const owned = all(`SELECT id FROM tags WHERE id IN (${ph}) AND user_id = ?`, [...ids, req.user.id]);
      if (owned.length !== ids.length) return res.status(400).json({ error: 'One or more tag IDs not found' });
    }

    // Atomic replace: delete existing then insert new
    run('DELETE FROM review_tags WHERE review_id = ?', [reviewId]);
    for (const tagId of ids) {
      run('INSERT INTO review_tags (review_id, tag_id) VALUES (?, ?)', [reviewId, tagId]);
    }

    const tags = all(
      `SELECT t.id, t.name, t.color FROM tags t
       JOIN review_tags rt ON rt.tag_id = t.id
       WHERE rt.review_id = ? ORDER BY t.name ASC`,
      [reviewId]
    );
    res.json({ tags });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Draft a response to a review. Uses the Anthropic API when ANTHROPIC_API_KEY
// is set, otherwise falls back to the built-in template pool. See
// lib/aiDrafts.js for the abstraction and fallback strategy.
//
// Plan enforcement: Free tier is capped at 3 AI drafts/month. When the cap
// is hit, the route returns 402 with upgrade guidance. The counter is stored
// on the subscription row and reset on first draft request of a new calendar
// month.
router.get('/:id/draft', draftLimiter, async (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const review = get('SELECT * FROM reviews WHERE id = ? AND business_id = ?', [reviewId, business.id]);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    // Plan gate: RESERVE a slot before the API call so parallel requests
    // from the same user can't all pre-check a counter that hasn't been
    // incremented yet and blow past the cap. If the AI path falls back to
    // a template (no API key configured), refund the slot below.
    const { reserveAiDraft, refundAiDraft } = require('../lib/billing/enforcement');
    const check = reserveAiDraft(req.user.id);
    if (!check.allowed) {
      res.setHeader('Cache-Control', 'no-store, private');
      return res.status(check.status || 402).json({
        error: check.reason,
        upgradeTo: check.upgradeTo,
        quota: check.used != null ? { used: check.used, max: check.max } : undefined,
      });
    }

    const { generateDraft } = require('../lib/aiDrafts');
    let draft, source;
    try {
      ({ draft, source } = await generateDraft({
        review,
        businessName: business.business_name,
      }));
    } catch (err) {
      // Unexpected throw — refund the slot so the error doesn't cost the user a draft
      refundAiDraft(req.user.id);
      throw err;
    }

    // Template fallback is free — refund the slot we reserved.
    if (source !== 'ai') {
      refundAiDraft(req.user.id);
    }

    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ draft, sentiment: review.sentiment, source });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', deleteLimiter, (req, res) => {
  try {
    const reviewId = parseId(req.params.id);
    if (!reviewId) return res.status(400).json({ error: 'Invalid review ID' });
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });
    const review = get('SELECT id FROM reviews WHERE id = ? AND business_id = ?', [reviewId, business.id]);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    run('DELETE FROM reviews WHERE id = ?', [review.id]);
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate export query date range. Returns a string error or null.
// Mirrors the inverted-range guard on GET /api/reviews so the export
// surface fails loud instead of silently returning an empty CSV.
function validateExportDateRange(query) {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  if (query.date_from && ISO.test(query.date_from)
      && query.date_to && ISO.test(query.date_to)
      && query.date_from > query.date_to) {
    return 'date_from must be on or before date_to';
  }
  return null;
}

// Shared filter builder — CSV and JSON exports stay in sync, and any filter
// added to GET / naturally ports here by editing one place.
function buildExportWhere(businessId, query) {
  const { platform, sentiment, responded, search } = query;
  let where = 'WHERE business_id = ?';
  const params = [businessId];
  if (platform && VALID_PLATFORMS.includes(platform)) { where += ' AND platform = ?'; params.push(platform); }
  if (sentiment && ['positive','negative','neutral'].includes(sentiment)) { where += ' AND sentiment = ?'; params.push(sentiment); }
  if (responded === 'yes') { where += " AND response_text IS NOT NULL AND response_text != ''"; }
  if (responded === 'no')  { where += " AND (response_text IS NULL OR response_text = '')"; }
  const ratingFilterRaw = Number(query.rating);
  const ratingFilter = Number.isInteger(ratingFilterRaw) && ratingFilterRaw >= 1 && ratingFilterRaw <= 5 ? ratingFilterRaw : null;
  if (ratingFilter) { where += ' AND rating = ?'; params.push(ratingFilter); }
  if (query.pinned === 'true')  { where += ' AND pinned = 1'; }
  if (query.flagged === 'true') { where += ' AND flagged = 1'; }
  if (query.status && VALID_REVIEW_STATUSES.includes(query.status)) { where += ' AND status = ?'; params.push(query.status); }
  // Accept BOTH `tag_id` (canonical, matches the list endpoint at line 516)
  // AND legacy `tag` (the export endpoint historically used this shorter
  // name; client still sends it). New callers should use tag_id; old
  // bookmarks / curl scripts using tag still work.
  const tagRaw = query.tag_id != null ? query.tag_id : query.tag;
  const tagIdExport = parseInt(tagRaw, 10);
  if (Number.isFinite(tagIdExport) && tagIdExport > 0) {
    where += ' AND id IN (SELECT review_id FROM review_tags WHERE tag_id = ?)';
    params.push(tagIdExport);
  }
  const ISO_DATE_RE_EXP = /^\d{4}-\d{2}-\d{2}$/;
  if (query.date_from && ISO_DATE_RE_EXP.test(query.date_from)) { where += ' AND created_at >= ?'; params.push(query.date_from); }
  if (query.date_to   && ISO_DATE_RE_EXP.test(query.date_to))   { where += ' AND created_at < ?';  params.push(query.date_to + 'T23:59:59'); }
  if (search && typeof search === 'string') {
    // Escape SQL LIKE metacharacters — same as the dashboard search path
    // so an export ?search=John_Smith doesn't pull in "John Smith" too.
    const escaped = search.trim().slice(0, 200).replace(/[\\%_]/g, '\\$&');
    const q = `%${escaped}%`;
    where += " AND (reviewer_name LIKE ? ESCAPE '\\' OR review_text LIKE ? ESCAPE '\\' OR response_text LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')";
    params.push(q, q, q, q);
  }
  return { where, params };
}

router.get('/export/csv', exportLimiter, (req, res) => {
  try {
    const sub = get('SELECT plan FROM subscriptions WHERE user_id = ?', [req.user.id]);
    if (!getPlan(sub?.plan || 'free').features.csv_export) {
      return res.status(403).json({ error: 'CSV export requires the Pro plan or higher' });
    }
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const dateErr = validateExportDateRange(req.query);
    if (dateErr) return res.status(400).json({ error: dateErr });

    const { where, params } = buildExportWhere(business.id, req.query);
    const LIMIT = 10000;
    const totalRow = get(`SELECT COUNT(*) AS n FROM reviews ${where}`, params);
    const total = totalRow?.n ?? 0;
    const reviews = all(`SELECT * FROM reviews ${where} ORDER BY created_at DESC LIMIT ${LIMIT}`, params);
    // Prefix formula-starting chars to prevent CSV injection in Excel/Sheets
    const esc = (v) => {
      let s = String(v ?? '').replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s}"`;
    };
    // Include private notes in the export since this is the owner's own data
    const header = ['ID','Platform','Reviewer','Rating','Sentiment','Review','Response','Note','Date','Updated'];
    const rows = reviews.map(r => [r.id,r.platform,r.reviewer_name,r.rating,r.sentiment,r.review_text,r.response_text??'',r.note??'',r.created_at,r.updated_at??''].map(esc).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reviews-${new Date().toISOString().slice(0,10)}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    // Surface truncation to CLI/script consumers that can't read JSON metadata
    res.setHeader('X-Total-Matching', String(total));
    res.setHeader('X-Returned-Count', String(reviews.length));
    if (total > reviews.length) res.setHeader('X-Truncated', 'true');
    res.send([header.join(','), ...rows].join('\r\n'));
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// JSON export — same filter surface as CSV, but machine-readable. Useful for
// scripting analysis, BI pipelines, or archival snapshots of a filtered view.
router.get('/export/json', exportLimiter, (req, res) => {
  try {
    const sub = get('SELECT plan FROM subscriptions WHERE user_id = ?', [req.user.id]);
    if (!getPlan(sub?.plan || 'free').features.csv_export) {
      return res.status(403).json({ error: 'JSON export requires the Pro plan or higher' });
    }
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const dateErr = validateExportDateRange(req.query);
    if (dateErr) return res.status(400).json({ error: dateErr });

    const { where, params } = buildExportWhere(business.id, req.query);
    // Count the TRUE total first so we can surface a `truncated: true` flag
    // in the payload when a business has more than 10k reviews matching the
    // filter. Consumers (BI pipelines, archival scripts) need to know to
    // paginate if the export was capped.
    const totalRow = get(`SELECT COUNT(*) AS n FROM reviews ${where}`, params);
    const total = totalRow?.n ?? 0;
    const LIMIT = 10000;
    const reviews = all(
      `SELECT id, platform, reviewer_name, rating, review_text, sentiment,
              response_text, note, external_id, created_at, updated_at
       FROM reviews ${where} ORDER BY created_at DESC LIMIT ${LIMIT}`,
      params
    );
    const payload = {
      exported_at: new Date().toISOString(),
      business: { id: business.id, name: business.business_name },
      count: reviews.length,
      total_matching: total,
      truncated: total > reviews.length,
      limit: LIMIT,
      filters: {
        platform: req.query.platform || null,
        sentiment: req.query.sentiment || null,
        responded: req.query.responded || null,
        rating: req.query.rating || null,
        search: req.query.search || null,
      },
      reviews,
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reviews-${new Date().toISOString().slice(0,10)}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reviews/import — bulk-import reviews from CSV.
// Accepts Content-Type: text/plain or text/csv; body = raw CSV text.
// Required columns: platform, reviewer_name, rating
// Optional columns: review_text, created_at (ISO-8601), response_text
// Max 500 rows per call. Returns { imported, skipped, errors }.
const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many import requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Minimal RFC-4180 CSV parser: handles quoted fields and escaped quotes ("").
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let val = '';
        i++; // skip opening quote
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { val += line[i++]; }
        }
        fields.push(val);
        if (line[i] === ',') i++;
      } else {
        const end = line.indexOf(',', i);
        if (end === -1) { fields.push(line.slice(i).trim()); i = line.length; }
        else { fields.push(line.slice(i, end).trim()); i = end + 1; }
      }
    }
    result.push(fields);
  }
  return result;
}

// GET /api/reviews/import/template — downloads a starter CSV with the
// expected headers + 3 example rows (mixing English, Thai, and Japanese
// to demonstrate UTF-8 + locale-platform support). Lowers the barrier
// for SMBs who'd otherwise have to read the docs to figure out the format.
router.get('/import/template', (req, res) => {
  // Keep in sync with SAMPLE_CSV in client/src/pages/Settings.jsx.
  const lines = [
    'platform,reviewer_name,rating,review_text,response_text,created_at',
    'google,Alice Johnson,5,"Best coffee in town! Staff super friendly.",Thanks Alice — see you next morning!,2026-04-15T09:30:00Z',
    'yelp,John Doe,4,Good food.,,2026-03-20',
    'booking,Maria Garcia,5,"Beautiful hotel, great breakfast.","Thank you Maria! Hope to see you again.",',
    'agoda,Somchai T.,4,"Room was clean. Staff helpful.",ขอบคุณครับ,',
    'wongnai,สมชาย,4,"กาแฟอร่อย แต่รอนาน",ขอบคุณค่ะ จะปรับปรุงเรื่องเวลานะคะ,',
    'tabelog,田中,3,"普通でした。場所はいい。",ご来店ありがとうございました。改善に努めます。,',
    'naver,김민,5,"맛집!",,',
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="reviewhub-import-template.csv"');
  res.send(lines.join('\r\n') + '\r\n');
});

router.post('/import', importLimiter, express.text({ type: ['text/plain', 'text/csv'], limit: '500kb' }), (req, res) => {
  try {
    const business = getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ error: 'No business found' });

    const body = typeof req.body === 'string' ? req.body : '';
    if (!body.trim()) return res.status(400).json({ error: 'Empty CSV body' });

    const rows = parseCsv(body);
    if (rows.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

    // Build header-to-index map (case-insensitive, trimmed)
    const headers = rows[0].map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
    const col = (name) => headers.indexOf(name);

    const piPlatform     = col('platform');
    const piName         = col('reviewer_name');
    const piRating       = col('rating');
    const piText         = col('review_text');
    const piResponse     = col('response_text');
    const piCreatedAt    = col('created_at');

    if (piPlatform === -1) return res.status(400).json({ error: 'Missing required column: platform' });
    if (piName === -1)     return res.status(400).json({ error: 'Missing required column: reviewer_name' });
    if (piRating === -1)   return res.status(400).json({ error: 'Missing required column: rating' });

    const dataRows = rows.slice(1);
    if (dataRows.length > 500) return res.status(400).json({ error: 'Maximum 500 rows per import' });

    let imported = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const rowNum = i + 2; // 1-indexed, +1 for header

      const platformRaw = (r[piPlatform] || '').trim().toLowerCase();
      if (!VALID_PLATFORMS.includes(platformRaw)) {
        errors.push({ row: rowNum, error: `Unknown platform: "${r[piPlatform]}"` });
        skipped++;
        continue;
      }
      const nameRaw = (r[piName] || '').trim().slice(0, 200);
      if (!nameRaw) {
        errors.push({ row: rowNum, error: 'reviewer_name is required' });
        skipped++;
        continue;
      }
      const ratingNum = parseInt(r[piRating], 10);
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        errors.push({ row: rowNum, error: `Invalid rating: "${r[piRating]}" (must be 1–5)` });
        skipped++;
        continue;
      }
      const textRaw = piText !== -1 ? (r[piText] || '').trim().slice(0, 5000) : '';
      const responseRaw = piResponse !== -1 ? (r[piResponse] || '').trim().slice(0, 1000) : null;

      let createdAt = null;
      if (piCreatedAt !== -1 && r[piCreatedAt]) {
        const d = new Date(r[piCreatedAt]);
        if (isNaN(d.getTime())) {
          errors.push({ row: rowNum, error: `Invalid date: "${r[piCreatedAt]}" — use ISO 8601 (e.g. 2026-04-15T09:30:00Z) or leave blank` });
          skipped++;
          continue;
        }
        createdAt = d.toISOString().replace('T', ' ').slice(0, 19);
      }

      const sentiment = analyzeSentiment(ratingNum, textRaw);

      // When response_text is provided, also set responded_at so the review
      // counts as responded in analytics and doesn't show in "needs response".
      //
      // For historical imports (createdAt in the past), we anchor responded_at
      // to created_at rather than now — otherwise the response-time analytics
      // ("avg_hours", "% within 24h") would treat a 2-year-old reply as if
      // it were sent today, polluting the dashboard with absurd response
      // times. Imported rows lack the true historical reply timestamp, so
      // matching created_at is the correct neutral default: counts as
      // responded, contributes 0h to the average.
      if (createdAt && responseRaw) {
        insert(
          `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, response_text, sentiment, created_at, responded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [business.id, platformRaw, nameRaw, ratingNum, textRaw, responseRaw, sentiment, createdAt, createdAt]
        );
      } else if (createdAt) {
        insert(
          'INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, response_text, sentiment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [business.id, platformRaw, nameRaw, ratingNum, textRaw, null, sentiment, createdAt]
        );
      } else if (responseRaw) {
        // No createdAt → DB default puts created_at at now, so responded_at = now
        // matches that with zero response-time skew.
        insert(
          `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, response_text, sentiment, responded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [business.id, platformRaw, nameRaw, ratingNum, textRaw, responseRaw, sentiment]
        );
      } else {
        insert(
          'INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, response_text, sentiment) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [business.id, platformRaw, nameRaw, ratingNum, textRaw, null, sentiment]
        );
      }
      imported++;
    }

    res.json({ imported, skipped, errors: errors.slice(0, 50) });
  } catch (err) {
    captureException(err, { route: 'reviews' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
