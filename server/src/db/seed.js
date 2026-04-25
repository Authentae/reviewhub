const { get, all, insert, run, transaction } = require('./schema');
const bcrypt = require('bcryptjs');

const DEMO_REVIEWS = [
  { platform: 'google', reviewer_name: 'Sarah M.', rating: 5, review_text: 'Absolutely love this place! The staff is incredibly friendly and the service is top-notch. Will definitely come back!', response_text: 'Thank you so much, Sarah! We\'re thrilled you had a great experience. We look forward to welcoming you back soon!' },
  { platform: 'google', reviewer_name: 'James T.', rating: 4, review_text: 'Great experience overall. Food was delicious and the atmosphere was cozy. Parking could be easier though.' },
  { platform: 'yelp', reviewer_name: 'Emily R.', rating: 5, review_text: 'Best in the area, hands down. Every visit has been perfect. Highly recommend to everyone!', response_text: 'We really appreciate your kind words, Emily! It means the world to our team. See you next time!' },
  { platform: 'yelp', reviewer_name: 'Marcus D.', rating: 2, review_text: 'Waited 45 minutes for our order. Staff seemed disorganized. Not impressed this time, hopefully just an off day.', response_text: 'We\'re truly sorry to hear about your experience, Marcus. This is not up to our standards. Please reach out directly so we can make it right.' },
  { platform: 'facebook', reviewer_name: 'Linda K.', rating: 5, review_text: 'Outstanding quality and amazing customer service. The owner personally thanked us for visiting. Rare these days!' },
  { platform: 'google', reviewer_name: 'Chris B.', rating: 3, review_text: 'It was okay. Nothing special but nothing bad either. Decent value for the price I guess.' },
  { platform: 'yelp', reviewer_name: 'Angela W.', rating: 1, review_text: 'Terrible experience. Rude staff, wrong order, and refused to fix it. Never returning and will warn others.' },
  { platform: 'facebook', reviewer_name: 'David P.', rating: 4, review_text: 'Really enjoyed our visit. Great selection and fair prices. The new layout is much better than before.' },
  { platform: 'google', reviewer_name: 'Michelle S.', rating: 5, review_text: 'Every single time I come here it exceeds expectations. Consistent quality is so hard to find — these guys nail it.' },
  { platform: 'yelp', reviewer_name: 'Tom H.', rating: 3, review_text: 'Mixed feelings. Some things were great, others not so much. Would consider trying again on a quieter day.' },
  { platform: 'facebook', reviewer_name: 'Rachel N.', rating: 5, review_text: 'Told all my friends about this place! The experience was wonderful from start to finish.' },
  { platform: 'google', reviewer_name: 'Kevin L.', rating: 2, review_text: 'Overpriced for what you get. The quality has gone downhill since last year. Very disappointed.' },
];

function analyzeSentiment(rating, text) {
  const positiveWords = ['love', 'great', 'excellent', 'amazing', 'wonderful', 'best', 'outstanding', 'perfect', 'fantastic', 'highly recommend', 'top-notch', 'enjoyed', 'told all', 'exceeds', 'consistent'];
  const negativeWords = ['terrible', 'awful', 'horrible', 'worst', 'never returning', 'disappointed', 'rude', 'wrong', 'bad', 'overpriced', 'downhill', 'disorganized', 'not impressed'];
  const neutralPhrases = ['okay', 'it was okay', 'nothing special', 'mixed feelings', 'decent', 'would consider', 'not so much'];
  const lowerText = (text || '').toLowerCase();
  const posCount = positiveWords.filter(w => lowerText.includes(w)).length;
  const negCount = negativeWords.filter(w => lowerText.includes(w)).length;
  const neutralCount = neutralPhrases.filter(w => lowerText.includes(w)).length;
  if (rating === 3) return 'neutral';
  if (rating >= 4 && posCount >= negCount) return 'positive';
  if (rating <= 2 || negCount > posCount) return 'negative';
  if (posCount > negCount) return 'positive';
  return 'neutral';
}

function seedDemoData(userId) {
  let business = get('SELECT id FROM businesses WHERE user_id = ?', [userId]);
  if (!business) {
    const id = insert('INSERT INTO businesses (user_id, business_name) VALUES (?, ?)', [userId, 'The Corner Bistro']);
    business = { id };
  }

  const existingCount = get('SELECT COUNT(*) as c FROM reviews WHERE business_id = ?', [business.id]);
  if (existingCount && existingCount.c > 0) {
    return { business_id: business.id, reviews_added: 0, message: 'Demo data already exists' };
  }

  // Varied time intervals: 0, 1, 3, 5, 7, 10, 14, 18, 21, 25, 30, 40 days ago
  const dayOffsets = [0, 1, 3, 5, 7, 10, 14, 18, 21, 25, 30, 40];
  const now = new Date();

  // Wrap all inserts in a single transaction → 1 disk write instead of 12
  transaction((tx) => {
    DEMO_REVIEWS.forEach((r, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (dayOffsets[i] ?? i * 3));
      const responseDate = r.response_text ? new Date(date.getTime() + 3600000) : null; // 1hr after review
      tx.run(
        'INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text, sentiment, response_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [business.id, r.platform, r.reviewer_name, r.rating, r.review_text, analyzeSentiment(r.rating, r.review_text), r.response_text || null, date.toISOString(), responseDate ? responseDate.toISOString() : date.toISOString()]
      );
    });
  });

  return { business_id: business.id, reviews_added: DEMO_REVIEWS.length };
}

async function createDemoUser() {
  // The demo user has a hard-coded, publicly-documented password. In
  // production that would be a trivial foot-gun: anyone could log in,
  // see a Pro-tier dashboard, and potentially exercise paid-feature
  // endpoints. So we ONLY create it in dev/test OR when the operator
  // explicitly opts in with SEED_DEMO=1 (e.g. for a public demo
  // deployment). `SEED_DEMO` documented in README / docker-compose.
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== '1') {
    return null;
  }

  const email = 'demo@reviewmanager.app';
  const existing = get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return existing;

  const hash = await bcrypt.hash('demo123', 10);

  // Create user + subscription atomically — avoids a state where the user exists but has no subscription.
  // Demo user is pre-verified so demo logins don't see the verification banner.
  let userId;
  transaction((tx) => {
    userId = tx.insert(
      "INSERT INTO users (email, password_hash, email_verified_at) VALUES (?, ?, datetime('now'))",
      [email, hash]
    );
    if (!userId) throw new Error('Failed to create demo user');
    // Demo user lands on Pro so reviewers / evaluators see the full feature set.
    tx.run(
      "INSERT OR IGNORE INTO subscriptions (user_id, status, plan, price, renewal_date) VALUES (?, 'active', 'pro', 29.00, date('now', '+30 days'))",
      [userId]
    );
  });

  if (!userId) return null;
  seedDemoData(userId);
  return { id: userId };
}

module.exports = { seedDemoData, createDemoUser, analyzeSentiment };
