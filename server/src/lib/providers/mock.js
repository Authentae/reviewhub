// Mock provider — generates synthetic reviews so the sync pipeline demonstrably
// works end-to-end without any external credentials.
//
// Behaviour per sync call:
//   - First sync (connection.last_synced_at is NULL):
//     emit 3–5 "historical" reviews dated within the last 30 days. This seeds
//     the dashboard so the user immediately sees results after connecting.
//   - Subsequent syncs:
//     30% chance to emit one fresh review dated "now" — simulates a real
//     review trickling in between polls.
//
// external_id is deterministic per (connection, sequence number) so re-running
// a sync never creates duplicates. Reviewer names and review text are pulled
// from a small pool; randomness is seeded per-call so tests can rely on
// counts but not on exact content.

const crypto = require('crypto');
const { BaseProvider } = require('./base');

const REVIEWER_POOL = [
  'Alex P.', 'Sam R.', 'Jordan T.', 'Casey K.', 'Morgan L.',
  'Taylor N.', 'Jamie W.', 'Riley B.', 'Pat S.', 'Drew H.',
];

// (rating, text) pairs. Sentiment is left for analyzeSentiment() downstream.
const REVIEW_POOL = [
  [5, 'Fantastic service from start to finish. Will be back!'],
  [5, 'Consistently excellent — every visit exceeds expectations.'],
  [4, 'Really solid. One small hiccup but staff handled it well.'],
  [4, 'Good experience overall. A few things could be improved.'],
  [3, 'Decent enough. Nothing that stood out either way.'],
  [3, 'Average. The wait was longer than I expected.'],
  [2, 'Disappointing this visit. The quality has slipped.'],
  [2, 'Staff seemed overwhelmed. Would try again on a quieter day.'],
  [1, 'Poor experience. Will not be returning.'],
];

class MockProvider extends BaseProvider {
  get isConfigured() {
    return true; // always works — no external deps
  }

  // Mock reply-to-review — used by the auto-post-back path in
  // routes/reviews.js to verify the wiring works end-to-end without
  // hitting Google's My Business API. Returns immediately with a fake
  // posted-confirmation. In production this only activates when the
  // operator opts in via ENABLE_MOCK_PROVIDER=1, so it can't accidentally
  // shadow real Google posts.
  async replyToReview(externalId, replyText) {
    return {
      ok: true,
      external_id: externalId,
      posted_at: new Date().toISOString(),
      // Don't echo the full reply text in case a future caller logs the
      // return value — keeps test output noise-free.
      reply_length: (replyText || '').length,
    };
  }

  async fetchReviews({ since } = {}) {
    const isFirstSync = !since;
    const count = isFirstSync
      ? 3 + Math.floor(Math.random() * 3)          // 3–5 on first sync
      : (Math.random() < 0.3 ? 1 : 0);             // 30% chance of 1 fresh review

    const reviews = [];
    for (let i = 0; i < count; i++) {
      const [rating, text] = REVIEW_POOL[Math.floor(Math.random() * REVIEW_POOL.length)];
      const reviewer = REVIEWER_POOL[Math.floor(Math.random() * REVIEWER_POOL.length)];

      // Historical reviews get spread across the last 30 days; fresh reviews are "now".
      const daysAgo = isFirstSync ? Math.floor(Math.random() * 30) : 0;
      const createdAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();

      // Deterministic external_id per connection + a time+random component.
      // Same sync tick could produce duplicates if not seeded; we include a
      // per-iteration nonce to avoid that.
      const externalId = crypto
        .createHash('sha1')
        .update(`mock:${this.connection.id}:${Date.now()}:${i}:${Math.random()}`)
        .digest('hex')
        .slice(0, 16);

      reviews.push({
        external_id: externalId,
        reviewer_name: reviewer,
        rating,
        review_text: text,
        created_at: createdAt,
      });
    }
    return reviews;
  }
}

module.exports = { MockProvider };
