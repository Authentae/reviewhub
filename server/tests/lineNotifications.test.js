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
});
