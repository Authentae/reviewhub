// Browser-extension API.
//
// Minimal surface for the Chrome/Firefox extension: generate an AI reply
// draft from review text the extension scraped off whatever platform the
// user is currently viewing (Yelp, Facebook, TripAdvisor, Trustpilot, etc).
//
// Auth: rh_ext_<token> bearer (handled by authMiddleware — see middleware/auth.js).
// Quota: same per-plan AI-draft limits as /api/reviews/:id/draft — a user can't
// bypass the Free-tier cap by drafting through the extension instead of the web
// dashboard.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const draftLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many draft requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const ALLOWED_PLATFORMS = ['google', 'yelp', 'facebook', 'tripadvisor', 'trustpilot', 'amazon', 'etsy', 'booking', 'airbnb', 'wongnai', 'other'];

router.post('/draft', draftLimiter, async (req, res) => {
  try {
    const { platform: platformRaw, reviewer_name, rating, review_text, business_name } = req.body || {};

    const platform = typeof platformRaw === 'string' ? platformRaw.toLowerCase().trim() : 'other';
    if (!ALLOWED_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `platform must be one of: ${ALLOWED_PLATFORMS.join(', ')}` });
    }
    if (typeof review_text !== 'string' || !review_text.trim()) {
      return res.status(400).json({ error: 'review_text is required' });
    }
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating must be 1-5' });
    }

    // Reserve a slot so concurrent extension clicks can't all read a stale
    // counter and blow past the cap. Mirrors /api/reviews/:id/draft.
    const { reserveAiDraft, refundAiDraft } = require('../lib/billing/enforcement');
    const check = reserveAiDraft(req.user.id);
    if (!check.allowed) {
      return res.status(check.status || 402).json({
        error: check.reason,
        upgradeTo: check.upgradeTo,
        quota: check.used != null ? { used: check.used, max: check.max } : undefined,
      });
    }

    // Build a synthetic review object for the existing generateDraft helper
    // — the extension doesn't know a review_id (the review lives on the
    // third-party platform), so we pass the fields directly.
    const { generateDraft } = require('../lib/aiDrafts');
    let draft, source;
    try {
      ({ draft, source } = await generateDraft({
        review: {
          platform,
          reviewer_name: (reviewer_name || '').slice(0, 200) || 'Customer',
          rating: Math.round(ratingNum),
          review_text: review_text.slice(0, 2000),
          sentiment: ratingNum >= 4 ? 'positive' : ratingNum <= 2 ? 'negative' : 'neutral',
        },
        businessName: (business_name || '').slice(0, 200) || 'our business',
      }));
    } catch (err) {
      refundAiDraft(req.user.id);
      throw err;
    }

    // Template fallback is free — refund the slot
    if (source !== 'ai') {
      refundAiDraft(req.user.id);
    }

    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ draft, source, platform });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
