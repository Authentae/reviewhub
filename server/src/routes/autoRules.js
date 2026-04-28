const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all, insert, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { captureException } = require('../lib/errorReporter');

const router = express.Router();
router.use(authMiddleware);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const { VALID_PLATFORMS } = require('../lib/platforms');
const VALID_SENTIMENTS = ['positive', 'negative', 'neutral'];
const MAX_RULES = 20;

// Parse match_keywords from request body. Accepts a JSON array of strings,
// a comma-separated string, or null/undefined. Returns null (no filter) or a
// cleaned array of lowercase keyword strings. At most 10 keywords, each ≤ 50 chars.
function parseKeywords(raw) {
  if (raw == null || raw === '') return null;
  let arr;
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { arr = raw.split(','); }
  } else {
    return null;
  }
  const cleaned = arr
    .map(k => String(k).trim().toLowerCase().slice(0, 50))
    .filter(k => k.length > 0);
  return cleaned.length > 0 ? cleaned.slice(0, 10) : null;
}

function validateRule(body) {
  const { name, platform, min_rating, max_rating, sentiment, response_text, enabled } = body;
  if (!name || typeof name !== 'string' || !name.trim()) return 'name is required';
  if (platform != null && !VALID_PLATFORMS.includes(platform)) return `platform must be one of: ${VALID_PLATFORMS.join(', ')}`;
  if (sentiment != null && !VALID_SENTIMENTS.includes(sentiment)) return `sentiment must be one of: ${VALID_SENTIMENTS.join(', ')}`;
  if (min_rating != null) {
    const n = parseInt(min_rating, 10);
    if (!Number.isInteger(n) || n < 1 || n > 5) return 'min_rating must be 1–5';
  }
  if (max_rating != null) {
    const n = parseInt(max_rating, 10);
    if (!Number.isInteger(n) || n < 1 || n > 5) return 'max_rating must be 1–5';
  }
  if (min_rating != null && max_rating != null && parseInt(min_rating) > parseInt(max_rating)) {
    return 'min_rating cannot exceed max_rating';
  }
  if (!response_text || typeof response_text !== 'string' || !response_text.trim()) return 'response_text is required';
  if (response_text.trim().length > 1000) return 'response_text too long (max 1000 chars)';
  return null;
}

// GET /api/auto-rules
router.get('/', limiter, (req, res) => {
  try {
    const rules = all(
      'SELECT * FROM auto_rules WHERE user_id = ? ORDER BY created_at ASC',
      [req.user.id]
    );
    res.json(rules);
  } catch (err) {
    captureException(err, { route: 'autoRules.list' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auto-rules
router.post('/', limiter, (req, res) => {
  try {
    const count = get('SELECT COUNT(*) as n FROM auto_rules WHERE user_id = ?', [req.user.id]);
    if ((count?.n ?? 0) >= MAX_RULES) return res.status(400).json({ error: `Maximum ${MAX_RULES} rules per account` });

    const err = validateRule(req.body);
    if (err) return res.status(400).json({ error: err });

    const { name, platform, min_rating, max_rating, sentiment, response_text } = req.body;
    const enabled = req.body.enabled === false || req.body.enabled === 0 ? 0 : 1;
    const keywords = parseKeywords(req.body.match_keywords);
    const tagId = req.body.tag_id != null ? (parseInt(req.body.tag_id, 10) || null) : null;

    const id = insert(
      `INSERT INTO auto_rules (user_id, name, platform, min_rating, max_rating, sentiment, response_text, enabled, match_keywords, tag_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        name.trim().slice(0, 100),
        platform ?? null,
        min_rating != null ? parseInt(min_rating) : null,
        max_rating != null ? parseInt(max_rating) : null,
        sentiment ?? null,
        response_text.trim(),
        enabled,
        keywords ? JSON.stringify(keywords) : null,
        tagId,
      ]
    );

    res.status(201).json(get('SELECT * FROM auto_rules WHERE id = ?', [id]));
  } catch (err) {
    captureException(err, { route: 'autoRules.create' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auto-rules/:id
router.put('/:id', limiter, (req, res) => {
  try {
    const rule = get('SELECT * FROM auto_rules WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    const merged = { ...rule, ...req.body };
    const err = validateRule(merged);
    if (err) return res.status(400).json({ error: err });

    const { name, platform, min_rating, max_rating, sentiment, response_text } = merged;
    const enabled = req.body.enabled === false || req.body.enabled === 0 ? 0
      : req.body.enabled === true || req.body.enabled === 1 ? 1
      : rule.enabled;
    // Allow explicitly clearing keywords by sending null/empty; otherwise fall back to existing value.
    // Defensive: corrupted match_keywords JSON in the row would otherwise throw
    // and 500 every PUT for that rule, locking the user out of editing it.
    const safeExistingKeywords = (() => {
      if (!rule.match_keywords) return null;
      try { return JSON.parse(rule.match_keywords); }
      catch { return null; }
    })();
    const keywords = req.body.match_keywords !== undefined
      ? parseKeywords(req.body.match_keywords)
      : safeExistingKeywords;
    const tagId = req.body.tag_id !== undefined
      ? (req.body.tag_id != null ? (parseInt(req.body.tag_id, 10) || null) : null)
      : rule.tag_id;

    run(
      `UPDATE auto_rules SET name=?, platform=?, min_rating=?, max_rating=?, sentiment=?,
       response_text=?, enabled=?, match_keywords=?, tag_id=?, updated_at=datetime('now') WHERE id=?`,
      [
        name.trim().slice(0, 100),
        platform ?? null,
        min_rating != null ? parseInt(min_rating) : null,
        max_rating != null ? parseInt(max_rating) : null,
        sentiment ?? null,
        response_text.trim(),
        enabled,
        keywords ? JSON.stringify(keywords) : null,
        tagId,
        rule.id,
      ]
    );

    res.json(get('SELECT * FROM auto_rules WHERE id = ?', [rule.id]));
  } catch (err) {
    captureException(err, { route: 'autoRules.update' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/auto-rules/:id
router.delete('/:id', limiter, (req, res) => {
  try {
    const rule = get('SELECT id FROM auto_rules WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    run('DELETE FROM auto_rules WHERE id = ?', [rule.id]);
    res.json({ deleted: true });
  } catch (err) {
    captureException(err, { route: 'autoRules.delete' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
