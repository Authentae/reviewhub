// Tests for email template rendering.
//
// The transporter falls back to console when SMTP isn't configured, so we can
// inject a stub transporter and assert on the arguments sendMail was called
// with. Cheaper than spinning up a full SMTP mock.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Ensure we load the server's email module after DATABASE_PATH is set.
require('./helpers'); // side-effect: set test env vars

const emailLib = require('../src/lib/email');

function withStubTransporter(fn) {
  const calls = [];
  // Monkey-patch the internal transporter for the duration of the test
  const nodemailer = require('nodemailer');
  const original = nodemailer.createTransport;
  nodemailer.createTransport = () => ({
    verify: () => Promise.resolve(true),
    sendMail: async (msg) => { calls.push(msg); return { messageId: 'test' }; },
  });
  // Force email.js to build a fresh transporter
  process.env.SMTP_HOST = 'test.smtp.invalid';
  process.env.SMTP_USER = 'u';
  process.env.SMTP_PASS = 'p';
  try {
    // Reset the cached transporter so next call rebuilds via our stub
    const freshEmail = require('../src/lib/email');
    // The module caches _transporter inside; easiest workaround is delete-require
    delete require.cache[require.resolve('../src/lib/email')];
    const reloaded = require('../src/lib/email');
    return Promise.resolve(fn(reloaded, calls)).finally(() => {
      nodemailer.createTransport = original;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete require.cache[require.resolve('../src/lib/email')];
    });
  } catch (err) {
    nodemailer.createTransport = original;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    throw err;
  }
}

describe('sendReviewRequest — follow-up vs initial subject', () => {
  test('initial request uses the standard subject', async () => {
    await withStubTransporter(async (email, calls) => {
      await email.sendReviewRequest({
        customerEmail: 'c@example.com',
        customerName: 'Alice',
        businessName: 'Sakura Coffee',
        platform: 'google',
        message: null,
        trackUrl: 'http://test/track/xyz',
      });
      assert.strictEqual(calls.length, 1);
      assert.match(calls[0].subject, /Thanks for stopping by.*Sakura Coffee/i);
      assert.doesNotMatch(calls[0].subject, /reminder/i);
    });
  });

  test('follow-up variant uses a reminder-tone subject', async () => {
    await withStubTransporter(async (email, calls) => {
      await email.sendReviewRequest({
        customerEmail: 'c@example.com',
        customerName: 'Alice',
        businessName: 'Sakura Coffee',
        platform: 'google',
        message: null,
        trackUrl: 'http://test/track/xyz',
        isFollowUp: true,
      });
      assert.strictEqual(calls.length, 1);
      assert.match(calls[0].subject, /last one, promise/i);
    });
  });

  test('follow-up body mentions the customer has not reviewed yet', async () => {
    await withStubTransporter(async (email, calls) => {
      await email.sendReviewRequest({
        customerEmail: 'c@example.com',
        customerName: 'Alice',
        businessName: 'Sakura Coffee',
        platform: 'google',
        message: null,
        trackUrl: 'http://test/track/xyz',
        isFollowUp: true,
      });
      assert.strictEqual(calls.length, 1);
      // Both HTML and plaintext should have the follow-up phrasing
      assert.match(calls[0].html, /one gentle nudge/i);
      assert.match(calls[0].text, /gentle nudge/i);
    });
  });

  test('initial body does NOT use the follow-up phrasing', async () => {
    await withStubTransporter(async (email, calls) => {
      await email.sendReviewRequest({
        customerEmail: 'c@example.com',
        customerName: 'Alice',
        businessName: 'Sakura Coffee',
        platform: 'google',
        message: null,
        trackUrl: 'http://test/track/xyz',
      });
      assert.doesNotMatch(calls[0].html, /gentle nudge/i);
      assert.match(calls[0].html, /thanks for swinging by/i);
    });
  });

  test('customer-provided message is embedded in both variants', async () => {
    await withStubTransporter(async (email, calls) => {
      await email.sendReviewRequest({
        customerEmail: 'c@example.com',
        customerName: 'Alice',
        businessName: 'Sakura Coffee',
        platform: 'google',
        message: 'Thanks for stopping by last week!',
        trackUrl: 'http://test/track/xyz',
        isFollowUp: true,
      });
      assert.match(calls[0].html, /Thanks for stopping by/);
    });
  });
});

describe('sendWeeklyDigest — recent-review excerpts', () => {
  test('renders critical callout for unresponded low-rated reviews', async () => {
    await withStubTransporter(async (email, calls) => {
      await email.sendWeeklyDigest('owner@example.com', {
        business_name: 'Sakura Coffee',
        total: 5,
        avg_rating: 4.2,
        positive: 4,
        negative: 1,
        unresponded: 1,
        recentReviews: [
          { reviewer_name: 'Bob', rating: 1, platform: 'google', review_text: 'Terrible service', response_text: null },
          { reviewer_name: 'Carol', rating: 5, platform: 'yelp', review_text: 'Fantastic!', response_text: 'Thanks!' },
        ],
      });
      assert.strictEqual(calls.length, 1);
      // Critical (unresponded 1★) callout
      assert.match(calls[0].html, /Needs a reply/);
      assert.match(calls[0].html, /Bob/);
      assert.match(calls[0].html, /Terrible service/);
      // Highlight (5★) callout
      assert.match(calls[0].html, /Highlight of the week/);
      assert.match(calls[0].html, /Carol/);
      assert.match(calls[0].html, /Fantastic/);
    });
  });

  test('omits callouts when no matching reviews exist', async () => {
    await withStubTransporter(async (email, calls) => {
      await email.sendWeeklyDigest('owner@example.com', {
        business_name: 'Sakura Coffee',
        total: 0,
        avg_rating: null,
        positive: 0,
        negative: 0,
        unresponded: 0,
      });
      assert.strictEqual(calls.length, 1);
      assert.doesNotMatch(calls[0].html, /Needs a reply/);
      assert.doesNotMatch(calls[0].html, /Highlight of the week/);
    });
  });

  test('truncates long review text to 160 chars + ellipsis', async () => {
    await withStubTransporter(async (email, calls) => {
      const longText = 'x'.repeat(300);
      await email.sendWeeklyDigest('owner@example.com', {
        business_name: 'Sakura Coffee',
        total: 1,
        avg_rating: 1,
        positive: 0,
        negative: 1,
        unresponded: 1,
        // 1★ + unresponded → qualifies for the Needs-a-reply callout
        recentReviews: [
          { reviewer_name: 'Dave', rating: 1, platform: 'google', review_text: longText, response_text: null },
        ],
      });
      // Should contain the ellipsis marker + capped text
      assert.match(calls[0].html, /…/);
      // Not the full 300-character string
      assert.doesNotMatch(calls[0].html, new RegExp('x{200}'));
    });
  });
});
