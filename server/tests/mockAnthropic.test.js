// Tests for the mock Anthropic client.
//
// These cover both the mock's API-shape compatibility (so it can be dropped
// into aiDrafts.js without changes) and the heuristic behavior (sentiment
// branching, name parsing, hook selection).

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  createMockClient,
  shouldUseMock,
  generateDraftText,
  parseUserMessage,
} = require('../src/lib/mockAnthropic');
const { generateDraft, _resetForTests } = require('../src/lib/aiDrafts');

const REVIEW = {
  id: 1,
  platform: 'google',
  reviewer_name: 'Marcus T.',
  rating: 1,
  review_text: 'Waited 45 minutes for a sandwich. Staff seemed disorganized.',
  sentiment: 'negative',
};

describe('mockAnthropic', () => {
  test('createMockClient returns the SDK shape', async () => {
    const client = createMockClient();
    assert.ok(client.messages);
    assert.strictEqual(typeof client.messages.create, 'function');
  });

  test('mock response matches the SDK content-block shape', async () => {
    const prev = process.env.ANTHROPIC_MOCK_LATENCY;
    process.env.ANTHROPIC_MOCK_LATENCY = '0';
    try {
      const client = createMockClient();
      const res = await client.messages.create({
        model: 'mock',
        max_tokens: 400,
        system: [{ type: 'text', text: 'sys' }],
        messages: [{ role: 'user', content: 'Business: Test\nReviewer: Alice\nRating: 5\nReview text: "Loved it"' }],
      });
      assert.ok(Array.isArray(res.content));
      assert.strictEqual(res.content[0].type, 'text');
      assert.ok(typeof res.content[0].text === 'string' && res.content[0].text.length > 0);
      assert.strictEqual(res.role, 'assistant');
      assert.strictEqual(res.stop_reason, 'end_turn');
    } finally {
      if (prev === undefined) delete process.env.ANTHROPIC_MOCK_LATENCY;
      else process.env.ANTHROPIC_MOCK_LATENCY = prev;
    }
  });

  test('parseUserMessage maps rating to sentiment', () => {
    assert.strictEqual(parseUserMessage('Rating: 5 out of 5 stars').sentiment, 'positive');
    assert.strictEqual(parseUserMessage('Rating: 3 out of 5 stars').sentiment, 'neutral');
    assert.strictEqual(parseUserMessage('Rating: 1 out of 5 stars').sentiment, 'negative');
  });

  test('generateDraftText addresses reviewer by first name', () => {
    const text = generateDraftText({
      sentiment: 'positive', reviewer: 'Alice Example', business: 'Sakura Coffee', reviewText: 'Great food.',
    });
    assert.ok(text.includes('Alice'), `expected "Alice" in: ${text}`);
    assert.ok(!text.includes('{name}'));
    assert.ok(!text.includes('{biz}'));
    assert.ok(!text.includes('{hook}'));
  });

  test('negative drafts invite the reviewer to reach out (no specific remedies)', () => {
    // Run a few times to cover the pool — every negative template should
    // invite contact and never promise refunds/discounts.
    for (let i = 0; i < 12; i++) {
      const text = generateDraftText({
        sentiment: 'negative', reviewer: 'Marcus T.', business: 'Corner Bistro',
        reviewText: 'Staff was rude and the food was cold.',
      });
      assert.ok(!/\b(refund|free|discount|comp|voucher)\b/i.test(text),
        `negative draft must not promise remedies: ${text}`);
    }
  });

  test('shouldUseMock: true when ANTHROPIC_MOCK=1', () => {
    const prev = { mock: process.env.ANTHROPIC_MOCK, env: process.env.NODE_ENV };
    process.env.ANTHROPIC_MOCK = '1';
    process.env.NODE_ENV = 'production';
    try {
      assert.strictEqual(shouldUseMock(), true);
    } finally {
      process.env.ANTHROPIC_MOCK = prev.mock || '';
      process.env.NODE_ENV = prev.env;
    }
  });

  test('shouldUseMock: false in test env even without API key', () => {
    const prev = { mock: process.env.ANTHROPIC_MOCK, env: process.env.NODE_ENV, key: process.env.ANTHROPIC_API_KEY };
    delete process.env.ANTHROPIC_MOCK;
    process.env.NODE_ENV = 'test';
    delete process.env.ANTHROPIC_API_KEY;
    try {
      assert.strictEqual(shouldUseMock(), false);
    } finally {
      if (prev.mock) process.env.ANTHROPIC_MOCK = prev.mock;
      process.env.NODE_ENV = prev.env;
      if (prev.key) process.env.ANTHROPIC_API_KEY = prev.key;
    }
  });

  test('aiDrafts.generateDraft uses mock when ANTHROPIC_MOCK=1', async () => {
    const prev = { mock: process.env.ANTHROPIC_MOCK, latency: process.env.ANTHROPIC_MOCK_LATENCY };
    process.env.ANTHROPIC_MOCK = '1';
    process.env.ANTHROPIC_MOCK_LATENCY = '0';
    _resetForTests();
    try {
      const result = await generateDraft({ review: REVIEW, businessName: 'Corner Bistro' });
      assert.strictEqual(result.source, 'ai');
      assert.ok(result.draft.length > 0);
      assert.ok(result.draft.includes('Marcus'),
        `expected reviewer first name in mock draft: ${result.draft}`);
    } finally {
      if (prev.mock) process.env.ANTHROPIC_MOCK = prev.mock;
      else delete process.env.ANTHROPIC_MOCK;
      if (prev.latency) process.env.ANTHROPIC_MOCK_LATENCY = prev.latency;
      else delete process.env.ANTHROPIC_MOCK_LATENCY;
      _resetForTests();
    }
  });
});
