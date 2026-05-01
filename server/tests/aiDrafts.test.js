// Tests for the AI drafts lib.
//
// We don't have a vitest/jest-style mocking framework under node:test, so we
// use the client-injection path on generateDraft(): pass in a stub object that
// exposes {messages: {create: async() => ...}} and behaves however the test
// needs. This exercises the same code path production would hit, minus the
// actual network call.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const Anthropic = require('@anthropic-ai/sdk');
const { generateDraft, getTemplateDraft, _resetForTests } = require('../src/lib/aiDrafts');

const REVIEW = {
  id: 1,
  platform: 'google',
  reviewer_name: 'Alice Example',
  rating: 5,
  review_text: 'Fantastic experience.',
  sentiment: 'positive',
};

// Simple stub client factory — spreads overrides on top of a default
// always-succeeds shape.
function stubClient(overrides = {}) {
  return {
    messages: {
      create: overrides.create || (async () => ({
        content: [{ type: 'text', text: 'Stub AI response.' }],
      })),
    },
  };
}

describe('aiDrafts', () => {
  test('getTemplateDraft returns something that includes the reviewer name', () => {
    const draft = getTemplateDraft(REVIEW);
    assert.ok(typeof draft === 'string' && draft.length > 0);
    assert.ok(draft.includes(REVIEW.reviewer_name));
  });

  // Regression: when reviewer_name is null/undefined/empty, the old template
  // path produced "Thank you, null!" or "Thanks for stopping by, !" — both
  // shipped to customer-facing replies. The fix uses a name-less variant
  // so the greeting reads naturally regardless of whether a name is present.
  for (const v of [null, undefined, '', '   ']) {
    test(`getTemplateDraft handles reviewer_name = ${JSON.stringify(v)} gracefully`, () => {
      const draft = getTemplateDraft({ ...REVIEW, reviewer_name: v });
      assert.ok(typeof draft === 'string' && draft.length > 0);
      assert.ok(!/null|undefined/.test(draft), `draft must not contain "null" or "undefined": ${draft}`);
      // No stray ", !" or ", ." that would be left if we just dropped the name token
      assert.ok(!/,\s*[!?.]/.test(draft), `draft must not have orphaned comma+punctuation: ${draft}`);
    });
  }

  test('returns template when no client and no API key configured', async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    _resetForTests();
    try {
      const result = await generateDraft({ review: REVIEW, businessName: 'Test Co' });
      assert.strictEqual(result.source, 'template');
      assert.ok(result.draft.includes('Alice Example'));
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
      _resetForTests();
    }
  });

  test('uses injected client and returns source: ai on success', async () => {
    const client = stubClient({
      create: async () => ({
        content: [{ type: 'text', text: 'Thanks Alice — we appreciate it!' }],
      }),
    });
    const result = await generateDraft({ review: REVIEW, businessName: 'Test Co' }, { client });
    assert.strictEqual(result.source, 'ai');
    assert.strictEqual(result.draft, 'Thanks Alice — we appreciate it!');
  });

  test('trims whitespace from AI output', async () => {
    const client = stubClient({
      create: async () => ({
        content: [{ type: 'text', text: '   \n\nHello!  \n' }],
      }),
    });
    const result = await generateDraft({ review: REVIEW, businessName: 'Test Co' }, { client });
    assert.strictEqual(result.draft, 'Hello!');
  });

  test('falls back to template when AI returns no text block', async () => {
    const client = stubClient({
      create: async () => ({ content: [] }),
    });
    const result = await generateDraft({ review: REVIEW, businessName: 'Test Co' }, { client });
    assert.strictEqual(result.source, 'template');
    assert.ok(result.draft.includes('Alice Example'));
  });

  test('falls back to template when SDK throws a generic error', async () => {
    const client = stubClient({
      create: async () => { throw new Error('Network error'); },
    });
    const result = await generateDraft({ review: REVIEW, businessName: 'Test Co' }, { client });
    assert.strictEqual(result.source, 'template');
    assert.ok(result.draft.includes('Alice Example'));
  });

  test('falls back to template when SDK throws RateLimitError', async () => {
    const client = stubClient({
      create: async () => {
        // Construct a real SDK error instance so the instanceof checks inside
        // generateDraft categorise it correctly (even though we don't assert
        // that categorisation here — we just care about the fallback).
        const err = Object.create(Anthropic.default.RateLimitError.prototype);
        err.message = 'rate limited';
        err.status = 429;
        throw err;
      },
    });
    const result = await generateDraft({ review: REVIEW, businessName: 'Test Co' }, { client });
    assert.strictEqual(result.source, 'template');
  });

  test('passes the review text into the user message', async () => {
    let capturedRequest = null;
    const client = stubClient({
      create: async (req) => {
        capturedRequest = req;
        return { content: [{ type: 'text', text: 'ok' }] };
      },
    });
    await generateDraft({ review: REVIEW, businessName: 'Test Co' }, { client });
    assert.ok(capturedRequest, 'client.messages.create should have been called');
    const userMsg = capturedRequest.messages[0].content;
    assert.ok(userMsg.includes(REVIEW.reviewer_name));
    assert.ok(userMsg.includes(REVIEW.review_text));
    assert.ok(userMsg.includes('5 out of 5'));
    assert.ok(userMsg.includes('Test Co'));
  });

  // Language hint contract: when preferredLang is passed to generateDraft,
  // the user message should include a "Reply in: <natural language name>"
  // line that the system prompt knows to honor over auto-detection. The
  // natural-language form ("Thai (ภาษาไทย)…") is what the model handles
  // most reliably — passing the bare ISO code 'th' produces flakier results.
  test('threads preferredLang into the user message as a natural-language hint', async () => {
    let capturedRequest = null;
    const client = stubClient({
      create: async (req) => {
        capturedRequest = req;
        return { content: [{ type: 'text', text: 'ok' }] };
      },
    });
    await generateDraft(
      { review: REVIEW, businessName: 'Test Co', preferredLang: 'th' },
      { client }
    );
    const userMsg = capturedRequest.messages[0].content;
    assert.ok(userMsg.includes('Reply in:'), `expected Reply-in hint: ${userMsg}`);
    assert.ok(userMsg.includes('Thai'), `expected Thai language name: ${userMsg}`);
  });

  test('omits the Reply-in line entirely when preferredLang is not passed', async () => {
    let capturedRequest = null;
    const client = stubClient({
      create: async (req) => {
        capturedRequest = req;
        return { content: [{ type: 'text', text: 'ok' }] };
      },
    });
    await generateDraft({ review: REVIEW, businessName: 'Test Co' }, { client });
    const userMsg = capturedRequest.messages[0].content;
    assert.ok(!userMsg.includes('Reply in:'), 'no Reply-in hint should appear when lang is unspecified');
  });

  test('unknown preferredLang code is silently dropped (model auto-detects)', async () => {
    let capturedRequest = null;
    const client = stubClient({
      create: async (req) => {
        capturedRequest = req;
        return { content: [{ type: 'text', text: 'ok' }] };
      },
    });
    await generateDraft(
      { review: REVIEW, businessName: 'Test Co', preferredLang: 'xx' },
      { client }
    );
    const userMsg = capturedRequest.messages[0].content;
    // Unknown code → fall through to auto-detect rather than send a confusing
    // "Reply in: xx" line that the model can't resolve.
    assert.ok(!userMsg.includes('Reply in:'), `expected no Reply-in line for unknown lang: ${userMsg}`);
  });

  // Template fallback honors preferredLang too — the AI path is the primary
  // language switch, but when AI isn't available, Thai users shouldn't get
  // English templates. heuristic: explicit lang wins; absent that, scan for
  // Thai script in the review text.
  test('template fallback returns Thai when preferredLang=th', () => {
    const draft = getTemplateDraft(REVIEW, 'th');
    // Quick sanity: contains a Thai character (อันใดอันหนึ่ง within Thai unicode block)
    assert.ok(/[฀-๿]/.test(draft), `expected Thai characters in template: ${draft}`);
  });

  test('template fallback returns Thai when review text contains Thai script (no explicit lang)', () => {
    const thaiReview = { ...REVIEW, review_text: 'พาสต้าอร่อยมากครับ' };
    const draft = getTemplateDraft(thaiReview);
    assert.ok(/[฀-๿]/.test(draft), `auto-detect: expected Thai template for Thai review: ${draft}`);
  });

  test('template fallback stays in English when preferredLang=en even if review has Thai', () => {
    const thaiReview = { ...REVIEW, review_text: 'พาสต้าอร่อยมากครับ' };
    // Explicit 'en' should override the heuristic. Use case: a Thai customer
    // wrote a Thai review but the SHOP owner replies in English (e.g. an
    // English-language hotel staff replying to a Thai guest).
    const draft = getTemplateDraft(thaiReview, 'en');
    assert.ok(!/[฀-๿]/.test(draft), `explicit en should override auto-detect: ${draft}`);
  });

  test('system prompt is sent with cache_control for future cache activation', async () => {
    let capturedRequest = null;
    const client = stubClient({
      create: async (req) => {
        capturedRequest = req;
        return { content: [{ type: 'text', text: 'ok' }] };
      },
    });
    await generateDraft({ review: REVIEW, businessName: 'Test Co' }, { client });
    // System prompt is a structured array (not a bare string) so cache_control
    // can be attached. Opus 4.7's minimum cacheable prefix is 4096 tokens; our
    // prompt is shorter today but the marker is in place for when it grows.
    assert.ok(Array.isArray(capturedRequest.system));
    const systemBlock = capturedRequest.system[0];
    assert.strictEqual(systemBlock.type, 'text');
    assert.deepStrictEqual(systemBlock.cache_control, { type: 'ephemeral' });
  });

  test('does not request thinking (keeps latency and cost low)', async () => {
    let capturedRequest = null;
    const client = stubClient({
      create: async (req) => {
        capturedRequest = req;
        return { content: [{ type: 'text', text: 'ok' }] };
      },
    });
    await generateDraft({ review: REVIEW, businessName: 'Test Co' }, { client });
    // Drafting a review response is simple — adaptive thinking would triple
    // latency for no quality gain. Regression guard: don't accidentally enable.
    assert.ok(!('thinking' in capturedRequest));
  });

  // Regression: a rotated/invalid ANTHROPIC_API_KEY caused every draft
  // request to call Anthropic, get a 401, and trip Sentry. The breaker
  // turns subsequent calls into immediate template fallbacks until the
  // env is fixed. The direct-injection path (used in most tests here)
  // skips the breaker, so this test goes through the module-level path:
  // with no API key, the lazy init returns null and we fall to template,
  // confirming the safe-fallback contract the breaker relies on.
  test('module-level fallback returns a template draft when API key missing', async () => {
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = '';
    _resetForTests();
    try {
      const result = await generateDraft({ review: REVIEW, businessName: 'Test Co' });
      assert.strictEqual(result.source, 'template');
      assert.ok(result.draft);
    } finally {
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prevKey;
      _resetForTests();
    }
  });

  test('uses the configured model', async () => {
    let capturedRequest = null;
    const client = stubClient({
      create: async (req) => {
        capturedRequest = req;
        return { content: [{ type: 'text', text: 'ok' }] };
      },
    });
    const prev = process.env.ANTHROPIC_MODEL;
    process.env.ANTHROPIC_MODEL = 'claude-haiku-4-5';
    _resetForTests();
    try {
      // Re-require to pick up the new env var since MODEL is captured at module load.
      delete require.cache[require.resolve('../src/lib/aiDrafts')];
      const mod = require('../src/lib/aiDrafts');
      await mod.generateDraft({ review: REVIEW, businessName: 'Test Co' }, { client });
      assert.strictEqual(capturedRequest.model, 'claude-haiku-4-5');
    } finally {
      if (prev === undefined) delete process.env.ANTHROPIC_MODEL;
      else process.env.ANTHROPIC_MODEL = prev;
      delete require.cache[require.resolve('../src/lib/aiDrafts')];
    }
  });
});
