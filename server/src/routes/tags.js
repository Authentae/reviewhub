const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all, insert, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { captureException } = require('../lib/errorReporter');

const router = express.Router();
router.use(authMiddleware);

const tagLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many tag requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Per-user cap. Tags are cheap individually, but every review's tag panel
// renders all tags and the dashboard's tag-filter dropdown has to ship
// the full list to the client, so unbounded growth degrades both UX and
// page weight. 50 is generous — most businesses categorize on a handful
// of axes (location, sentiment, topic, escalation, etc.). Matches the
// MAX_RULES precedent in autoRules.js.
const MAX_TAGS = 50;

// GET /api/tags — list all tags for this user with usage counts
router.get('/', tagLimiter, (req, res) => {
  try {
    const rows = all(
      `SELECT t.id, t.name, t.color, t.created_at,
              COUNT(rt.review_id) AS review_count
       FROM tags t
       LEFT JOIN review_tags rt ON rt.tag_id = t.id
       WHERE t.user_id = ?
       GROUP BY t.id
       ORDER BY t.name ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    captureException(err, { route: 'tags.list' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tags — create a tag
router.post('/', tagLimiter, (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const trimmedName = name.trim().slice(0, 50);
    const tagColor = color && HEX_COLOR_RE.test(color) ? color : '#6b7280';

    const countRow = get('SELECT COUNT(*) AS n FROM tags WHERE user_id = ?', [req.user.id]);
    if ((countRow?.n ?? 0) >= MAX_TAGS) {
      return res.status(400).json({ error: `Maximum ${MAX_TAGS} tags per account` });
    }

    const existing = get('SELECT id FROM tags WHERE user_id = ? AND name = ?', [req.user.id, trimmedName]);
    if (existing) return res.status(409).json({ error: 'Tag name already exists' });

    const id = insert('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)', [req.user.id, trimmedName, tagColor]);
    res.status(201).json({ id, name: trimmedName, color: tagColor, review_count: 0 });
  } catch (err) {
    captureException(err, { route: 'tags.create' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tags/:id — update name and/or color
router.put('/:id', tagLimiter, (req, res) => {
  try {
    const tag = get('SELECT * FROM tags WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });

    const name = req.body.name != null ? String(req.body.name).trim().slice(0, 50) : tag.name;
    const color = req.body.color && HEX_COLOR_RE.test(req.body.color) ? req.body.color : tag.color;

    if (!name) return res.status(400).json({ error: 'name cannot be empty' });

    // Check uniqueness if name is changing
    if (name !== tag.name) {
      const conflict = get('SELECT id FROM tags WHERE user_id = ? AND name = ? AND id != ?', [req.user.id, name, tag.id]);
      if (conflict) return res.status(409).json({ error: 'Tag name already exists' });
    }

    run('UPDATE tags SET name = ?, color = ? WHERE id = ?', [name, color, tag.id]);
    res.json({ id: tag.id, name, color });
  } catch (err) {
    captureException(err, { route: 'tags.update' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tags/:id — delete tag (review_tags cascade)
router.delete('/:id', tagLimiter, (req, res) => {
  try {
    const tag = get('SELECT id FROM tags WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    run('DELETE FROM tags WHERE id = ?', [tag.id]);
    res.json({ deleted: true });
  } catch (err) {
    captureException(err, { route: 'tags.delete' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
