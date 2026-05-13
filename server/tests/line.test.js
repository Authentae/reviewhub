// Tests for LINE OA integration:
// - Messenger helper feature-flag behavior + payload shape
// - Flex message builder for review notifications
// - Webhook signature verification
// - Webhook link-token flow (DB roundtrip)
//
// Live LINE API calls are stubbed via global.fetch override; nothing
// hits api.line.me during tests.

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const {
  isEnabled,
  pushText,
  pushFlex,
  buildReviewNotificationFlex,
} = require('../src/lib/line/messenger');
const { verifySignature, webhookHandler } = require('../src/routes/lineWebhook');
const { run, get, insert } = require('../src/db/schema');
const { makeUser, getAgent } = require('./helpers');

// Stub fetch globally for LINE-API-touching tests.
let fetchCalls = [];
const realFetch = global.fetch;
function stubFetch(responder) {
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return responder(url, opts);
  };
}
function restoreFetch() {
  global.fetch = realFetch;
  fetchCalls = [];
}

describe('LINE messenger — feature flag behavior', () => {
  beforeEach(() => {
    fetchCalls = [];
    delete process.env.LINE_OA_ENABLED;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
  });

  after(restoreFetch);

  test('isEnabled returns false when env vars missing', () => {
    assert.strictEqual(isEnabled(), false);
  });

  test('isEnabled returns false when ENABLED=true but no access token', () => {
    process.env.LINE_OA_ENABLED = 'true';
    assert.strictEqual(isEnabled(), false);
  });

  test('isEnabled returns true when both env vars present', () => {
    process.env.LINE_OA_ENABLED = 'true';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    assert.strictEqual(isEnabled(), true);
  });

  test('pushText is a no-op when disabled (returns skipped: true)', async () => {
    stubFetch(async () => new Response('{}', { status: 200 }));
    const result = await pushText('Uabc', 'hello');
    assert.deepStrictEqual(result, { ok: true, skipped: true });
    assert.strictEqual(fetchCalls.length, 0, 'no API call should fire when disabled');
    restoreFetch();
  });

  test('pushText hits the LINE API when enabled', async () => {
    process.env.LINE_OA_ENABLED = 'true';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    stubFetch(async () => new Response('{}', { status: 200 }));
    const result = await pushText('Uabc', 'hello');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /api\.line\.me/);
    const body = JSON.parse(fetchCalls[0].opts.body);
    assert.strictEqual(body.to, 'Uabc');
    assert.strictEqual(body.messages[0].text, 'hello');
    assert.match(fetchCalls[0].opts.headers.Authorization, /Bearer test-token/);
    restoreFetch();
  });

  test('pushText truncates messages over 5000 chars', async () => {
    process.env.LINE_OA_ENABLED = 'true';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    stubFetch(async () => new Response('{}', { status: 200 }));
    const long = 'a'.repeat(6000);
    await pushText('Uabc', long);
    const body = JSON.parse(fetchCalls[0].opts.body);
    assert.ok(body.messages[0].text.length <= 5000);
    assert.ok(body.messages[0].text.endsWith('...'));
    restoreFetch();
  });

  test('pushText returns ok:false on non-2xx response', async () => {
    process.env.LINE_OA_ENABLED = 'true';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    stubFetch(async () => new Response('rate limited', { status: 429 }));
    const result = await pushText('Uabc', 'hello');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 429);
    restoreFetch();
  });
});

describe('LINE messenger — flex builder', () => {
  test('buildReviewNotificationFlex produces a valid bubble structure', () => {
    const flex = buildReviewNotificationFlex({
      businessName: 'Old Capital Bike Inn',
      reviewerName: 'Jane',
      rating: 4,
      reviewText: 'Friendly staff but room was small.',
      draftText: 'Thanks Jane! We appreciate your honest feedback.',
      approveUrl: 'https://reviewhub.review/approve?token=abc',
      editUrl: 'https://reviewhub.review/dashboard/reviews/1',
    });
    assert.strictEqual(flex.type, 'bubble');
    assert.strictEqual(flex.size, 'mega');
    assert.ok(flex.header);
    assert.ok(flex.body);
    assert.ok(flex.footer);
    // Header should mention the business name (case-insensitive — the
    // eyebrow uppercases it for editorial weight, but the original
    // casing flows through too).
    const headerTexts = JSON.stringify(flex.header.contents).toLowerCase();
    assert.ok(headerTexts.includes('old capital bike inn'));
    // Footer should have a primary action button (approve / reply-on-google)
    // + an edit-in-dashboard link button. Exact button count depends on
    // which URLs were passed.
    assert.ok(flex.footer.contents.length >= 1);
    // First button should target the primary URL we passed (approveUrl
    // when no replyOnGoogleUrl is provided).
    assert.strictEqual(flex.footer.contents[0].action.uri, 'https://reviewhub.review/approve?token=abc');
  });

  test('buildReviewNotificationFlex handles missing/empty fields gracefully', () => {
    const flex = buildReviewNotificationFlex({
      businessName: '',
      reviewerName: '',
      rating: null,
      reviewText: '',
      draftText: '',
      approveUrl: '',
      editUrl: '',
    });
    // Should not throw + structure should still be valid
    assert.strictEqual(flex.type, 'bubble');
    assert.ok(Array.isArray(flex.body.contents));
  });

  test('rating renders as star string', () => {
    const flex = buildReviewNotificationFlex({
      businessName: 'X',
      reviewerName: 'Y',
      rating: 3,
      reviewText: 'ok',
      draftText: 'thanks',
      approveUrl: 'https://x',
      editUrl: 'https://y',
    });
    // Stars live in the header alongside the reviewer name (editorial
    // restructure 2026-05-14). Search the full flex JSON for the star
    // string so this test isn't coupled to exact layout indexes.
    const allText = JSON.stringify(flex);
    assert.ok(allText.includes('★★★☆☆'), `expected star string to appear somewhere in flex: ${allText}`);
  });
});

describe('LINE webhook — signature verification', () => {
  beforeEach(() => {
    delete process.env.LINE_CHANNEL_SECRET;
  });

  test('verifySignature returns false when secret is missing', () => {
    assert.strictEqual(verifySignature('body', 'sig'), false);
  });

  test('verifySignature returns false when signature is missing', () => {
    process.env.LINE_CHANNEL_SECRET = 'shh';
    assert.strictEqual(verifySignature('body', null), false);
    assert.strictEqual(verifySignature('body', ''), false);
  });

  test('verifySignature returns true for a valid HMAC', () => {
    process.env.LINE_CHANNEL_SECRET = 'shh';
    const body = '{"events":[]}';
    const sig = crypto.createHmac('sha256', 'shh').update(body).digest('base64');
    assert.strictEqual(verifySignature(body, sig), true);
  });

  test('verifySignature returns false for a forged HMAC', () => {
    process.env.LINE_CHANNEL_SECRET = 'shh';
    const body = '{"events":[]}';
    const wrong = crypto.createHmac('sha256', 'wrong-secret').update(body).digest('base64');
    assert.strictEqual(verifySignature(body, wrong), false);
  });
});

describe('LINE webhook — request handler behavior', () => {
  beforeEach(() => {
    fetchCalls = [];
    delete process.env.LINE_OA_ENABLED;
    delete process.env.LINE_CHANNEL_SECRET;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
  });

  after(restoreFetch);

  function makeReq(rawBody, sig) {
    return {
      body: Buffer.from(rawBody, 'utf8'),
      headers: sig ? { 'x-line-signature': sig } : {},
    };
  }

  function makeRes() {
    const res = {
      _status: 200,
      _body: null,
      status(code) { this._status = code; return this; },
      json(body) { this._body = body; return this; },
    };
    return res;
  }

  test('returns 200 + skipped:true when feature flag is off', async () => {
    const req = makeReq('{"events":[]}');
    const res = makeRes();
    await webhookHandler(req, res);
    assert.strictEqual(res._status, 200);
    assert.deepStrictEqual(res._body, { ok: true, skipped: true });
  });

  test('returns 401 when signature is invalid + feature is enabled', async () => {
    process.env.LINE_OA_ENABLED = 'true';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    process.env.LINE_CHANNEL_SECRET = 'shh';
    const req = makeReq('{"events":[]}', 'wrong-signature');
    const res = makeRes();
    await webhookHandler(req, res);
    assert.strictEqual(res._status, 401);
  });

  test('returns 200 for empty events array (LINE platform handshake)', async () => {
    process.env.LINE_OA_ENABLED = 'true';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    process.env.LINE_CHANNEL_SECRET = 'shh';
    const body = '{"events":[]}';
    const sig = crypto.createHmac('sha256', 'shh').update(body).digest('base64');
    const req = makeReq(body, sig);
    const res = makeRes();
    await webhookHandler(req, res);
    assert.strictEqual(res._status, 200);
  });
});

describe('LINE webhook — link-token flow (DB roundtrip)', () => {
  let owner;

  before(async () => {
    await getAgent(); // ensures DB is initialized
    owner = await makeUser();
    process.env.LINE_OA_ENABLED = 'true';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    delete process.env.LINE_CHANNEL_SECRET; // skip signature check for this DB-roundtrip test
    stubFetch(async () => new Response('{}', { status: 200 }));
  });

  after(() => {
    delete process.env.LINE_OA_ENABLED;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    restoreFetch();
  });

  test('valid /link <token> activates the link', async () => {
    const token = 'test-token-' + crypto.randomBytes(8).toString('hex');
    insert(
      `INSERT INTO line_oa_links (user_id, line_user_id, link_token, link_token_expires_at, created_at)
       VALUES (?, NULL, ?, datetime('now', '+15 minutes'), datetime('now'))`,
      [owner.userId, token]
    );
    const lineUserId = 'Utest' + crypto.randomBytes(8).toString('hex');
    const event = {
      type: 'message',
      source: { userId: lineUserId },
      message: { type: 'text', text: `/link ${token}` },
    };
    const req = {
      body: Buffer.from(JSON.stringify({ events: [event] }), 'utf8'),
      headers: {},
    };
    const res = {
      _status: 200,
      status(c) { this._status = c; return this; },
      json(b) { this._body = b; return this; },
    };
    await webhookHandler(req, res);
    assert.strictEqual(res._status, 200);
    const linked = get(
      `SELECT line_user_id, link_token, linked_at FROM line_oa_links WHERE user_id = ?`,
      [owner.userId]
    );
    assert.strictEqual(linked.line_user_id, lineUserId, 'line_user_id should be stored');
    assert.strictEqual(linked.link_token, null, 'token should be cleared after use');
    assert.ok(linked.linked_at, 'linked_at should be populated');
  });

  test('expired link token is rejected', async () => {
    const u2 = await makeUser();
    const token = 'expired-' + crypto.randomBytes(8).toString('hex');
    insert(
      `INSERT INTO line_oa_links (user_id, line_user_id, link_token, link_token_expires_at, created_at)
       VALUES (?, NULL, ?, datetime('now', '-1 hour'), datetime('now'))`,
      [u2.userId, token]
    );
    const event = {
      type: 'message',
      source: { userId: 'Uexpired' + crypto.randomBytes(4).toString('hex') },
      message: { type: 'text', text: `/link ${token}` },
    };
    const req = {
      body: Buffer.from(JSON.stringify({ events: [event] }), 'utf8'),
      headers: {},
    };
    const res = {
      _status: 200,
      status(c) { this._status = c; return this; },
      json(b) { this._body = b; return this; },
    };
    await webhookHandler(req, res);
    const linked = get(
      `SELECT line_user_id, linked_at FROM line_oa_links WHERE user_id = ?`,
      [u2.userId]
    );
    assert.strictEqual(linked.line_user_id, null, 'expired token should not link');
    assert.strictEqual(linked.linked_at, null);
  });
});
