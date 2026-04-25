// Public plan catalogue — no auth required. Used by the Pricing page to
// render cards from server-authoritative data, so adding a plan tier only
// needs a code change in lib/billing/plans.js, not a parallel change in the
// React component.

const express = require('express');
const router = express.Router();
const { PLANS } = require('../lib/billing/plans');

router.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300'); // plans change rarely
  res.json({ plans: Object.values(PLANS) });
});

module.exports = router;
