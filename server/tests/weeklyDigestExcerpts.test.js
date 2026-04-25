// Tests the SQL that selects up to 3 recent reviews for the weekly digest.
// The ordering is load-bearing — the digest surfaces the most actionable
// items first (negative, then unresponded, then most recent). If the sort
// order regresses, users will see positive five-star reviews in their
// digest instead of the 1-star complaint that's been unanswered for 3 days.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('weeklyDigest recentReviews SQL ordering', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function addReview(u, body) {
    return request(app).post('/api/reviews').set('Authorization', `Bearer ${u.token}`).send({
      platform: 'google',
      reviewer_name: 'Tester',
      ...body,
    });
  }

  function runDigestAndGetRecent(userId) {
    const { all, get } = require('../src/db/schema');
    const business = get('SELECT id FROM businesses WHERE user_id = ?', [userId]);
    return all(
      `SELECT reviewer_name, rating, platform, review_text, response_text
       FROM reviews
       WHERE business_id = ?
         AND created_at >= datetime('now', '-7 days')
       ORDER BY rating ASC,
                (CASE WHEN response_text IS NULL OR response_text = '' THEN 0 ELSE 1 END) ASC,
                created_at DESC
       LIMIT 3`,
      [business.id]
    );
  }

  test('orders negative reviews before positive', async () => {
    const u = await makeUserWithBusiness('Order Co');
    await addReview(u, { reviewer_name: 'A', rating: 5, review_text: 'Great' });
    await addReview(u, { reviewer_name: 'B', rating: 1, review_text: 'Terrible' });
    await addReview(u, { reviewer_name: 'C', rating: 3, review_text: 'Meh' });

    const rows = runDigestAndGetRecent(u.userId);
    assert.strictEqual(rows.length, 3);
    // Negative (1) first, then neutral (3), then positive (5)
    assert.strictEqual(rows[0].rating, 1);
    assert.strictEqual(rows[1].rating, 3);
    assert.strictEqual(rows[2].rating, 5);
  });

  test('within same rating, unresponded ones come before responded ones', async () => {
    const u = await makeUserWithBusiness('Responded Co');
    const r1 = await addReview(u, { reviewer_name: 'A', rating: 3, review_text: 'Okay' });
    const r2 = await addReview(u, { reviewer_name: 'B', rating: 3, review_text: 'Also okay' });
    // Respond to r1 so r2 should come first
    await request(app).post(`/api/reviews/${r1.body.review.id}/respond`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ response_text: 'Thanks' });

    const rows = runDigestAndGetRecent(u.userId);
    assert.strictEqual(rows.length, 2);
    // Unresponded (B) first
    assert.strictEqual(rows[0].reviewer_name, 'B');
    assert.strictEqual(rows[0].response_text, null);
    assert.strictEqual(rows[1].reviewer_name, 'A');
    assert.ok(rows[1].response_text);
  });

  test('limits to 3 rows even when more match', async () => {
    const u = await makeUserWithBusiness('Many Co');
    for (let i = 0; i < 5; i++) {
      await addReview(u, { reviewer_name: `R${i}`, rating: 4, review_text: `Review ${i}` });
    }
    const rows = runDigestAndGetRecent(u.userId);
    assert.strictEqual(rows.length, 3);
  });

  test('returns empty array when no reviews exist', async () => {
    const u = await makeUserWithBusiness('Empty Co');
    const rows = runDigestAndGetRecent(u.userId);
    assert.strictEqual(rows.length, 0);
  });
});
