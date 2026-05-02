const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, all, insert, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { getPlan } = require('../lib/billing/plans');

const { captureException } = require('../lib/errorReporter');
const MAX_TEMPLATES = 10;

function parseId(param) {
  const n = parseInt(param, 10);
  return (isFinite(n) && n > 0 && String(n) === String(param)) ? n : null;
}

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

const mutateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();
router.use(authMiddleware);

// GET /api/templates — list all templates for the authenticated user
router.get('/', readLimiter, (req, res) => {
  try {
    const templates = all(
      'SELECT * FROM templates WHERE user_id = ? ORDER BY COALESCE(updated_at, created_at) DESC',
      [req.user.id]
    );
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ templates });
  } catch (err) {
    captureException(err, { route: 'templates' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/templates — create a new template
router.post('/', mutateLimiter, (req, res) => {
  try {
    const sub = get('SELECT plan FROM subscriptions WHERE user_id = ?', [req.user.id]);
    if (!getPlan(sub?.plan || 'free').features.templates) {
      return res.status(403).json({
        error: 'Response templates require the Starter plan or higher',
        upgradeTo: 'starter',
      });
    }
    const countRow = get('SELECT COUNT(*) as c FROM templates WHERE user_id = ?', [req.user.id]);
    if (countRow && countRow.c >= MAX_TEMPLATES) {
      return res.status(400).json({ error: `Maximum ${MAX_TEMPLATES} templates allowed` });
    }

    const rawTitle = req.body.title;
    const rawBody = req.body.body;
    if ((rawTitle !== undefined && rawTitle !== null && typeof rawTitle !== 'string') ||
        (rawBody !== undefined && rawBody !== null && typeof rawBody !== 'string')) {
      return res.status(400).json({ error: 'title and body must be strings' });
    }
    const title = (rawTitle || '').trim().slice(0, 100);
    const body  = (rawBody  || '').trim().slice(0, 1000);
    if (!title) return res.status(400).json({ error: 'Template title is required' });
    if (!body)  return res.status(400).json({ error: 'Template body is required' });

    const id = insert(
      'INSERT INTO templates (user_id, title, body) VALUES (?, ?, ?)',
      [req.user.id, title, body]
    );
    // Re-fetch to include created_at and any server-set defaults
    const created = get('SELECT * FROM templates WHERE id = ?', [id]);
    res.status(201).json(created || { id, user_id: req.user.id, title, body });
  } catch (err) {
    captureException(err, { route: 'templates' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/templates/:id — update an existing template
router.put('/:id', mutateLimiter, (req, res) => {
  try {
    const tmplId = parseId(req.params.id);
    if (!tmplId) return res.status(400).json({ error: 'Invalid template ID' });

    const tmpl = get('SELECT id FROM templates WHERE id = ? AND user_id = ?', [tmplId, req.user.id]);
    if (!tmpl) return res.status(404).json({ error: 'Template not found' });

    const rawTitle = req.body.title;
    const rawBody = req.body.body;
    if ((rawTitle !== undefined && rawTitle !== null && typeof rawTitle !== 'string') ||
        (rawBody !== undefined && rawBody !== null && typeof rawBody !== 'string')) {
      return res.status(400).json({ error: 'title and body must be strings' });
    }
    const title = (rawTitle || '').trim().slice(0, 100);
    const body  = (rawBody  || '').trim().slice(0, 1000);
    if (!title) return res.status(400).json({ error: 'Template title is required' });
    if (!body)  return res.status(400).json({ error: 'Template body is required' });

    run("UPDATE templates SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?", [title, body, tmplId]);
    res.json({ success: true, id: tmplId, title, body });
  } catch (err) {
    captureException(err, { route: 'templates' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/templates/:id — delete a template
router.delete('/:id', mutateLimiter, (req, res) => {
  try {
    const tmplId = parseId(req.params.id);
    if (!tmplId) return res.status(400).json({ error: 'Invalid template ID' });

    const tmpl = get('SELECT id FROM templates WHERE id = ? AND user_id = ?', [tmplId, req.user.id]);
    if (!tmpl) return res.status(404).json({ error: 'Template not found' });

    run('DELETE FROM templates WHERE id = ?', [tmplId]);
    res.json({ success: true });
  } catch (err) {
    captureException(err, { route: 'templates' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
