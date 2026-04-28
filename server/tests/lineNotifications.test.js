// Smoke tests for the LINE Messaging push module. We don't actually hit
// LINE's API in CI — that would require a real channel access token and
// a real userId. Instead we verify that:
//   1. isConfigured() flips with the env vars
//   2. notifyNewReview() is a no-op when unconfigured
//   3. sendOwnerPush() never throws regardless of inputs
//
// The fetch call itself is left to integration testing once a real
// channel is provisioned in production.

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const line = require('../src/lib/notifications/line');

describe('LINE notifications', () => {
  const originalToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const originalUser = process.env.LINE_OWNER_USER_ID;

  beforeEach(() => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_OWNER_USER_ID;
  });
  afterEach(() => {
    if (originalToken) process.env.LINE_CHANNEL_ACCESS_TOKEN = originalToken;
    else delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (originalUser) process.env.LINE_OWNER_USER_ID = originalUser;
    else delete process.env.LINE_OWNER_USER_ID;
  });

  test('isConfigured returns false when neither env var is set', () => {
    assert.equal(line.isConfigured(), false);
  });

  test('isConfigured returns false when only token is set', () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    assert.equal(line.isConfigured(), false);
  });

  test('isConfigured returns false when only userId is set', () => {
    process.env.LINE_OWNER_USER_ID = 'U1234567890abcdef';
    assert.equal(line.isConfigured(), false);
  });

  test('isConfigured returns true when both env vars are set', () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    process.env.LINE_OWNER_USER_ID = 'U1234567890abcdef';
    assert.equal(line.isConfigured(), true);
  });

  test('sendOwnerPush is a silent no-op when not configured', async () => {
    // Should resolve without throwing and without making any network call.
    await assert.doesNotReject(line.sendOwnerPush('test message'));
  });

  test('notifyNewReview is a silent no-op when not configured', async () => {
    const review = { rating: 5, reviewer_name: 'Test', platform: 'google', text: 'Great!' };
    await assert.doesNotReject(line.notifyNewReview(review, 'My Business'));
  });

  test('sendOwnerPush handles falsy text gracefully', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    process.env.LINE_OWNER_USER_ID = 'U1234567890abcdef';
    // Even with token+userId set, empty text should early-return without
    // calling fetch — safe even if LINE's API is unreachable.
    await assert.doesNotReject(line.sendOwnerPush(''));
    await assert.doesNotReject(line.sendOwnerPush(null));
    await assert.doesNotReject(line.sendOwnerPush(undefined));
  });

  test('notifyNewReview formats message with snippet from review_text', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    process.env.LINE_OWNER_USER_ID = 'U1234567890abcdef';
    const originalFetch = global.fetch;
    let captured = null;
    global.fetch = async (url, opts) => {
      captured = { url, body: JSON.parse(opts.body) };
      return { ok: true, status: 200 };
    };
    try {
      await line.notifyNewReview(
        { rating: 5, reviewer_name: 'Alice', platform: 'google', review_text: 'Loved it' },
        'Coffee Shop'
      );
      assert.equal(captured.url, 'https://api.line.me/v2/bot/message/push');
      assert.equal(captured.body.to, 'U1234567890abcdef');
      const text = captured.body.messages[0].text;
      assert.match(text, /Coffee Shop/);
      assert.match(text, /Alice/);
      assert.match(text, /5\/5/);
      assert.match(text, /Loved it/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('notifyNewReview handles long text by truncating to 200 chars + ellipsis', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    process.env.LINE_OWNER_USER_ID = 'U1234567890abcdef';
    const originalFetch = global.fetch;
    let captured = null;
    global.fetch = async (url, opts) => {
      captured = JSON.parse(opts.body);
      return { ok: true };
    };
    try {
      const longText = 'x'.repeat(500);
      await line.notifyNewReview(
        { rating: 1, reviewer_name: 'Bob', platform: 'google', review_text: longText },
        'Biz'
      );
      const text = captured.messages[0].text;
      assert.match(text, /…/);
      // Should contain exactly 200 x's followed by ellipsis
      assert.ok(text.includes('x'.repeat(200) + '…'));
      assert.ok(!text.includes('x'.repeat(201)));
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('notifyNewReview shows "(no text)" when review has no body', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    process.env.LINE_OWNER_USER_ID = 'U1234567890abcdef';
    const originalFetch = global.fetch;
    let captured = null;
    global.fetch = async (url, opts) => {
      captured = JSON.parse(opts.body);
      return { ok: true };
    };
    try {
      await line.notifyNewReview(
        { rating: 4, reviewer_name: 'Eve', platform: 'google', review_text: '' },
        'Biz'
      );
      assert.match(captured.messages[0].text, /\(no text\)/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
