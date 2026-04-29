const express = require('express');
const rateLimit = require('express-rate-limit');
const { randomBytes } = require('crypto');
const { get, all, insert, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { VALID_EVENTS } = require('../lib/webhookDelivery');

const { captureException } = require('../lib/errorReporter');
const router = express.Router();
router.use(authMiddleware);

const MAX_WEBHOOKS = 10;
const URL_RE = /^https?:\/\/.{3,500}$/;

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

function parseId(param) {
  const n = parseInt(param, 10);
  return (isFinite(n) && n > 0 && String(n) === String(param)) ? n : null;
}

// Safe-parse: a single corrupted events JSON row would otherwise throw and
// 500 the whole webhooks list (locking the user out of the Settings webhooks
// UI). Default to ['review.created'] so the row stays usable.
function safeParseEvents(raw) {
  try { return JSON.parse(raw || '[]'); }
  catch { return ['review.created']; }
}

// GET /api/webhooks — list all webhooks for the authenticated user
// NOTE: explicitly NOT selecting `secret` — signing secrets should be
// shown to the user once at creation time and then treated as
// "shown-once" credentials. Returning them on every list call meant
// they sat in browser memory + any client-side cache forever.
router.get('/', webhookLimiter, (req, res) => {
  try {
    const rows = all(
      'SELECT id, user_id, url, events, enabled, created_at, last_triggered_at, last_status FROM webhooks WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ webhooks: rows.map(w => ({ ...w, events: safeParseEvents(w.events) })) });
  } catch (err) {
    captureException(err, { route: 'webhooks' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/webhooks — create a new webhook
router.post('/', webhookLimiter, (req, res) => {
  try {
    const count = get('SELECT COUNT(*) as n FROM webhooks WHERE user_id = ?', [req.user.id])?.n || 0;
    if (count >= MAX_WEBHOOKS) {
      return res.status(400).json({ error: `Maximum ${MAX_WEBHOOKS} webhooks per account` });
    }

    const { url, events } = req.body;
    if (!url || typeof url !== 'string' || !URL_RE.test(url.trim())) {
      return res.status(400).json({ error: 'url must be a valid http/https URL' });
    }
    const urlClean = url.trim();

    let eventList = Array.isArray(events) ? events : ['review.created'];
    eventList = eventList.filter(e => VALID_EVENTS.includes(e));
    if (eventList.length === 0) eventList = ['review.created'];

    const secret = randomBytes(24).toString('hex');
    const id = insert(
      'INSERT INTO webhooks (user_id, url, secret, events) VALUES (?, ?, ?, ?)',
      [req.user.id, urlClean, secret, JSON.stringify(eventList)]
    );
    const hook = get('SELECT * FROM webhooks WHERE id = ?', [id]);
    res.status(201).json({ ...hook, events: safeParseEvents(hook.events) });
  } catch (err) {
    captureException(err, { route: 'webhooks' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/webhooks/:id — update url, events, or enabled
router.put('/:id', webhookLimiter, (req, res) => {
  try {
    const whId = parseId(req.params.id);
    if (!whId) return res.status(400).json({ error: 'Invalid webhook ID' });
    const hook = get('SELECT * FROM webhooks WHERE id = ? AND user_id = ?', [whId, req.user.id]);
    if (!hook) return res.status(404).json({ error: 'Webhook not found' });

    const fields = [];
    const params = [];

    if (req.body.url !== undefined) {
      if (!URL_RE.test((req.body.url || '').trim())) {
        return res.status(400).json({ error: 'url must be a valid http/https URL' });
      }
      fields.push('url = ?'); params.push(req.body.url.trim());
    }
    if (req.body.events !== undefined) {
      let eventList = Array.isArray(req.body.events) ? req.body.events : [];
      eventList = eventList.filter(e => VALID_EVENTS.includes(e));
      if (eventList.length === 0) eventList = ['review.created'];
      fields.push('events = ?'); params.push(JSON.stringify(eventList));
    }
    if (req.body.enabled !== undefined) {
      fields.push('enabled = ?'); params.push(req.body.enabled ? 1 : 0);
    }

    if (fields.length === 0) {
      const current = { ...hook, events: safeParseEvents(hook.events) };
      return res.json(current);
    }
    params.push(hook.id);
    run(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = get('SELECT * FROM webhooks WHERE id = ?', [hook.id]);
    res.json({ ...updated, events: safeParseEvents(updated.events) });
  } catch (err) {
    captureException(err, { route: 'webhooks' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/webhooks/:id
router.delete('/:id', webhookLimiter, (req, res) => {
  try {
    const whId = parseId(req.params.id);
    if (!whId) return res.status(400).json({ error: 'Invalid webhook ID' });
    const hook = get('SELECT id FROM webhooks WHERE id = ? AND user_id = ?', [whId, req.user.id]);
    if (!hook) return res.status(404).json({ error: 'Webhook not found' });
    run('DELETE FROM webhooks WHERE id = ?', [hook.id]);
    res.json({ deleted: true });
  } catch (err) {
    captureException(err, { route: 'webhooks' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/webhooks/:id/deliveries — last 50 delivery attempts for this webhook
router.get('/:id/deliveries', webhookLimiter, (req, res) => {
  try {
    const whId = parseId(req.params.id);
    if (!whId) return res.status(400).json({ error: 'Invalid webhook ID' });
    const hook = get('SELECT id FROM webhooks WHERE id = ? AND user_id = ?', [whId, req.user.id]);
    if (!hook) return res.status(404).json({ error: 'Webhook not found' });

    const rows = all(
      'SELECT id, event, status, response_snippet, triggered_at FROM webhook_deliveries WHERE webhook_id = ? ORDER BY id DESC LIMIT 50',
      [whId]
    );
    res.json({ deliveries: rows });
  } catch (err) {
    captureException(err, { route: 'webhooks' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/webhooks/:id/test — send a test event to the configured URL
router.post('/:id/test', webhookLimiter, async (req, res) => {
  try {
    const whId = parseId(req.params.id);
    if (!whId) return res.status(400).json({ error: 'Invalid webhook ID' });
    const hook = get('SELECT * FROM webhooks WHERE id = ? AND user_id = ?', [whId, req.user.id]);
    if (!hook) return res.status(404).json({ error: 'Webhook not found' });

    const { sign } = require('../lib/webhookDelivery');
    const payload = {
      event: 'test',
      payload: { message: 'This is a test delivery from ReviewHub.' },
      timestamp: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);
    const sig = sign(hook.secret, body);

    let status = null;
    let ok = false;
    let responseSnippet = null;
    let errorReason = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ReviewHub-Signature': sig,
          'X-ReviewHub-Event': 'test',
          'User-Agent': 'ReviewHub-Webhooks/1.0',
        },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      status = r.status;
      ok = r.ok;
      // For the TEST endpoint specifically, capture a small slice of the
      // response body so the operator can debug "200 OK but my receiver is
      // actually broken" cases (signature version mismatch, etc.). This is
      // the user explicitly asking to see what their endpoint returned —
      // unlike the production fire-and-forget path where we drop bodies
      // to avoid PII leakage in webhook_deliveries logs.
      try {
        const text = await r.text();
        responseSnippet = text ? text.slice(0, 500) : null;
      } catch { /* ignore body read errors */ }
    } catch (err) {
      status = 0;
      errorReason = err?.name === 'AbortError' ? 'Timeout after 5s' : 'Network error (DNS/connection refused)';
    }
    res.json({ ok, status, responseSnippet, errorReason });
  } catch (err) {
    captureException(err, { route: 'webhooks' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
