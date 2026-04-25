const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { get, all, run } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { getPlan } = require('../lib/billing/plans');

const router = express.Router();
router.use(authMiddleware);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const MAX_KEYS_PER_USER = 10;

function getUserPlan(userId) {
  const sub = get('SELECT plan FROM subscriptions WHERE user_id = ?', [userId]);
  return getPlan(sub?.plan || 'free');
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

// GET /api/apikeys — list caller's keys (no hashes, no full key)
router.get('/', limiter, (req, res) => {
  try {
    const rows = all(
      'SELECT id, name, key_prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ keys: rows.map(r => ({ ...r, id: Number(r.id) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/apikeys — create a new key (Business plan required)
router.post('/', limiter, (req, res) => {
  try {
    const plan = getUserPlan(req.user.id);
    if (!plan.features.api_access) {
      return res.status(403).json({ error: 'API access requires the Business plan' });
    }

    const name = req.body?.name;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'name too long (max 100 chars)' });
    }

    const count = get('SELECT COUNT(*) as n FROM api_keys WHERE user_id = ?', [req.user.id]);
    if (Number(count.n) >= MAX_KEYS_PER_USER) {
      return res.status(400).json({ error: `Maximum ${MAX_KEYS_PER_USER} API keys per account` });
    }

    // Generate: rh_ + 32 random bytes base64url = rh_ + 43 chars
    const rawKey = 'rh_' + crypto.randomBytes(32).toString('base64url');
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 10) + '…'; // "rh_xxxxxxx…"

    run(
      'INSERT INTO api_keys (user_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?)',
      [req.user.id, name.trim(), keyHash, keyPrefix]
    );
    const created = get('SELECT id, name, key_prefix, created_at FROM api_keys WHERE key_hash = ?', [keyHash]);

    // Return the full key only once — never again
    res.status(201).json({ key: rawKey, id: Number(created.id), name: created.name, key_prefix: created.key_prefix, created_at: created.created_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/apikeys/:id — revoke a key
router.delete('/:id', limiter, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid key ID' });

    const existing = get('SELECT id FROM api_keys WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    run('DELETE FROM api_keys WHERE id = ?', [id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.hashKey = hashKey;
