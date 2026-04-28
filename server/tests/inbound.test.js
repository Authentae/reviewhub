// Inbound email forwarding pipeline tests.
//
// Two layers:
//   1. Pure parser logic (lib/inbound/parsers) — pin down field extraction
//      against representative real-world email shapes.
//   2. Endpoint behavior — auth, signature verification, secret lookup,
//      business resolution, fallthrough behavior.

const { test, describe, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');
const { get } = require('../src/db/schema');
const {
  parseInboundEmail,
  platformFromSender,
  extractRating,
  extractReviewerName,
  extractReviewText,
  stripForwardWrapper,
} = require('../src/lib/inbound/parsers');

describe('inbound parsers — sender → platform mapping', () => {
  test('booking.com', () => {
    assert.strictEqual(platformFromSender('noreply@booking.com'), 'booking');
    assert.strictEqual(platformFromSender('reviews@mail.booking.com'), 'booking');
  });
  test('agoda', () => {
    assert.strictEqual(platformFromSender('hello@agoda.com'), 'agoda');
  });
  test('traveloka', () => {
    assert.strictEqual(platformFromSender('reviews@traveloka.com'), 'traveloka');
  });
  test('wongnai', () => {
    assert.strictEqual(platformFromSender('noreply@wongnai.com'), 'wongnai');
  });
  test('tabelog', () => {
    assert.strictEqual(platformFromSender('admin@tabelog.com'), 'tabelog');
  });
  test('tripadvisor', () => {
    assert.strictEqual(platformFromSender('reviews@tripadvisor.com'), 'tripadvisor');
    assert.strictEqual(platformFromSender('mailer@tripadvisorsupport.com'), 'tripadvisor');
  });
  test('unknown sender returns null', () => {
    assert.strictEqual(platformFromSender('me@example.com'), null);
    assert.strictEqual(platformFromSender(''), null);
    assert.strictEqual(platformFromSender(null), null);
  });
});

describe('inbound parsers — rating extraction', () => {
  test('5/5 fraction', () => assert.strictEqual(extractRating('Rating: 5/5'), 5));
  test('4 out of 5', () => assert.strictEqual(extractRating('Rated 4 out of 5 stars'), 4));
  test('9/10 → 5', () => assert.strictEqual(extractRating('Score: 9/10'), 5));
  test('booking score 8.4 → 4', () => assert.strictEqual(extractRating('Score: 8.4'), 4));
  test('5 stars', () => assert.strictEqual(extractRating('She gave 5 stars!'), 5));
  test('star glyphs', () => assert.strictEqual(extractRating('★★★★☆'), 4));
  test('no rating found', () => assert.strictEqual(extractRating('great place'), null));
});

describe('inbound parsers — name extraction', () => {
  test('Reviewer: prefix', () => assert.strictEqual(extractReviewerName('Reviewer: Alice Johnson'), 'Alice Johnson'));
  test('Guest: prefix', () => assert.strictEqual(extractReviewerName('Guest: Bob'), 'Bob'));
  test('"by Alice"', () => assert.strictEqual(extractReviewerName('Review by Alice'), 'Alice'));
  test('no name', () => assert.strictEqual(extractReviewerName('Just text'), null));
});

describe('inbound parsers — body extraction', () => {
  test('strips Gmail forward wrapper', () => {
    const input = 'My note\n---------- Forwarded message ----------\nFrom: x@y.com\n\nThe actual review here.';
    const out = stripForwardWrapper(input);
    assert.match(out, /actual review here/);
  });

  test('extractReviewText picks longest paragraph', () => {
    const body = 'From: x@y.com\nSubject: Hi\n\nShort.\n\nThis is the much longer review paragraph that should be extracted as the review body. It is detailed.\n\n--\nSignature';
    const out = extractReviewText(body);
    assert.match(out, /detailed/);
    assert.ok(!out.includes('Signature'));
  });
});

describe('inbound parsers — full dispatch', () => {
  test('Booking.com forwarded review', () => {
    const result = parseInboundEmail({
      headers: { 'X-Original-Sender': 'noreply@booking.com' },
      subject: 'Booking.com Score: 8.4',
      body: 'Guest review from John Smith\n\nGreat hotel, comfortable bed, friendly staff.',
    });
    assert.strictEqual(result.platform, 'booking');
    assert.strictEqual(result.rating, 4);
    assert.match(result.reviewer_name, /John Smith/);
  });

  test('Wongnai forwarded review with Thai content', () => {
    const result = parseInboundEmail({
      headers: { 'Reply-To': 'noreply@wongnai.com' },
      subject: 'รีวิวใหม่จากร้านของคุณ',
      body: 'คุณ สมชาย ใจดี\n\nร้านอร่อย บรรยากาศดี\n\nคะแนน: 5/5',
    });
    assert.strictEqual(result.platform, 'wongnai');
    assert.strictEqual(result.rating, 5);
  });

  test('Falls back to generic when sender unknown', () => {
    const result = parseInboundEmail({
      headers: {},
      subject: 'A review',
      body: 'From: weird@unknown.com\n\nGreat experience overall, 4 stars',
    });
    assert.strictEqual(result.platform, 'manual');
    assert.strictEqual(result.rating, 4);
  });
});

// ── Endpoint tests ──────────────────────────────────────────────────────────

function signMailgun(timestamp, token, signingKey) {
  return crypto.createHmac('sha256', signingKey).update(timestamp + token).digest('hex');
}

describe('inbound endpoint', () => {
  let app;
  let signingKey;
  before(async () => {
    app = await getAgent();
    signingKey = 'test-signing-key-' + crypto.randomBytes(8).toString('hex');
  });

  beforeEach(() => {
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = signingKey;
    process.env.INBOUND_EMAIL_DOMAIN = 'reviewhub.test';
  });
  afterEach(() => {
    delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    delete process.env.INBOUND_EMAIL_DOMAIN;
  });

  test('GET /address requires auth', async () => {
    const res = await request(app).get('/api/inbound/address');
    assert.strictEqual(res.status, 401);
  });

  test('GET /address returns the user-specific forwarding address', async () => {
    const u = await makeUserWithBusiness('Inbound Co');
    const res = await request(app)
      .get('/api/inbound/address')
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.match(res.body.address, /^reviews\+[a-f0-9]{32}@reviewhub\.test$/);
    assert.strictEqual(res.body.mailgun_configured, true);
  });

  test('GET /address is idempotent — same secret on repeated calls', async () => {
    const u = await makeUserWithBusiness();
    const r1 = await request(app).get('/api/inbound/address').set('Authorization', `Bearer ${u.token}`);
    const r2 = await request(app).get('/api/inbound/address').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(r1.body.address, r2.body.address);
  });

  test('POST /regenerate produces a new secret', async () => {
    const u = await makeUserWithBusiness();
    const r1 = await request(app).get('/api/inbound/address').set('Authorization', `Bearer ${u.token}`);
    const r2 = await request(app).post('/api/inbound/regenerate').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(r2.status, 200);
    assert.notStrictEqual(r1.body.address, r2.body.address);
  });

  test('POST /email rejects requests without signature', async () => {
    const res = await request(app)
      .post('/api/inbound/email')
      .send({ recipient: 'reviews+abc@x.com', subject: 'test', 'body-plain': 'hi' });
    assert.strictEqual(res.status, 401);
  });

  test('POST /email rejects bad signature', async () => {
    const res = await request(app)
      .post('/api/inbound/email')
      .send({
        timestamp: String(Math.floor(Date.now() / 1000)),
        token: 'token',
        signature: 'deadbeef',
        recipient: 'reviews+abc@x.com',
        subject: 'test',
        'body-plain': 'hi',
      });
    assert.strictEqual(res.status, 401);
  });

  test('POST /email accepts valid signature, parses, and inserts a review', async () => {
    const u = await makeUserWithBusiness('Inbound Test Co');
    const addrRes = await request(app).get('/api/inbound/address').set('Authorization', `Bearer ${u.token}`);
    const recipient = addrRes.body.address;

    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = 'tok' + crypto.randomBytes(8).toString('hex');
    const signature = signMailgun(timestamp, token, signingKey);

    const res = await request(app)
      .post('/api/inbound/email')
      .send({
        timestamp,
        token,
        signature,
        recipient,
        sender: 'me@gmail.com',
        subject: 'Booking.com Score: 9/10',
        'body-plain': 'Guest review from Alice Wonderland\n\nLoved the rooftop bar.',
        'Message-Headers': JSON.stringify([['X-Original-Sender', 'noreply@booking.com']]),
      });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.platform, 'booking');
    assert.strictEqual(res.body.rating, 5);

    // Verify the review actually landed in the DB
    const review = get('SELECT * FROM reviews WHERE id = ?', [res.body.review_id]);
    assert.ok(review);
    assert.strictEqual(review.platform, 'booking');
    assert.match(review.reviewer_name, /Alice/);
    assert.strictEqual(review.sentiment, 'positive');
  });

  test('POST /email returns 200 ignored for unknown secret (no Mailgun retry storm)', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = 'tok' + crypto.randomBytes(8).toString('hex');
    const signature = signMailgun(timestamp, token, signingKey);
    const res = await request(app)
      .post('/api/inbound/email')
      .send({
        timestamp, token, signature,
        recipient: 'reviews+0000000000000000000000000000ffff@reviewhub.test',
        subject: 'x', 'body-plain': 'y',
      });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ignored, true);
  });

  test('POST /email rejects malformed recipient (not reviews+<hex>)', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = 'tok' + crypto.randomBytes(8).toString('hex');
    const signature = signMailgun(timestamp, token, signingKey);
    const res = await request(app)
      .post('/api/inbound/email')
      .send({
        timestamp, token, signature,
        recipient: 'random@reviewhub.test',
        subject: 'x', 'body-plain': 'y',
      });
    assert.strictEqual(res.status, 400);
  });
});
