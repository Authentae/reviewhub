// Owner dashboard surface.
//
// Lists businesses the caller has approved claims on, with a count of
// reviews still awaiting an owner response and total review count. Powers
// /owner on the client (OwnerDashboard.jsx).
//
// Routes:
//   GET /api/owner/businesses → { businesses: [{ id, name, total_reviews,
//                                  pending_response_count }] }
//
// Plan-gating for actually posting responses lives on reviewResponses.js;
// this route is informational and safe to expose to free users (the client
// gates the link behind the paid-plan check too, but defense in depth never
// hurts).

const express = require('express');
const rateLimit = require('express-rate-limit');
const { all } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const { captureException } = require('../lib/errorReporter');

const router = express.Router();
router.use(authMiddleware);

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.get('/businesses', readLimiter, (req, res) => {
  try {
    // One query per business would be N+1; aggregate in SQL using LEFT JOINs
    // against reviews and review_responses.
    const rows = all(
      `SELECT
         b.id,
         b.business_name AS name,
         COUNT(DISTINCT r.id) AS total_reviews,
         COUNT(DISTINCT CASE WHEN r.id IS NOT NULL AND rr.id IS NULL THEN r.id END)
           AS pending_response_count
       FROM business_claims c
       JOIN businesses b ON b.id = c.business_id
       LEFT JOIN reviews r ON r.business_id = b.id
       LEFT JOIN review_responses rr ON rr.review_id = r.id
       WHERE c.user_id = ? AND c.status = 'approved'
       GROUP BY b.id, b.business_name
       ORDER BY b.business_name COLLATE NOCASE ASC`,
      [req.user.id]
    );
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ businesses: rows });
  } catch (err) {
    captureException(err, { route: 'owner.businesses' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
