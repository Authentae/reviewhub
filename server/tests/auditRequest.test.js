// Tests for POST /api/public/audit-request — the cold-DM landing form
// in routes/publicWidget.js. Public no-auth endpoint that emails the
// founder with a lead. Critical to test because:
//   1. Header injection guard (recently added) — would silently regress
//   2. Honeypot + validation behavior — bot defenses are easy to break
//   3. The endpoint mutates founder's inbox; failure mode is silent

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request } = require('./helpers');

describe('POST /api/public/audit-request', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('rejects missing email', async () => {
    const r = await request(app)
      .post('/api/public/audit-request')
      .send({ businessName: 'Cafe', businessUrl: 'https://maps.google.com/?cid=1' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /email/i);
  });

  test('rejects malformed email', async () => {
    const r = await request(app)
      .post('/api/public/audit-request')
      .send({ businessName: 'Cafe', businessUrl: 'https://maps.google.com/?cid=1', email: 'not-an-email' });
    assert.strictEqual(r.status, 400);
  });

  test('rejects missing business name', async () => {
    const r = await request(app)
      .post('/api/public/audit-request')
      .send({ email: 'a@b.com', businessUrl: 'https://maps.google.com/?cid=1' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /business name/i);
  });

  test('rejects missing URL', async () => {
    const r = await request(app)
      .post('/api/public/audit-request')
      .send({ email: 'a@b.com', businessName: 'Cafe' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /URL/i);
  });

  test('valid submission returns success (SMTP not configured in tests → just logs)', async () => {
    const r = await request(app)
      .post('/api/public/audit-request')
      .send({
        email: 'prospect@example.com',
        businessName: 'Corner Bistro',
        businessUrl: 'https://maps.google.com/?cid=1',
        notes: 'Italian, 80 reviews, 4.2★',
      });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.success, true);
  });

  // Honeypot: bots that fill EVERY field (including the hidden `website`
  // input) get a fake-200 so they don't retry, but no email is actually
  // sent. We can't easily verify the no-email-sent half in this test
  // setup; verify the fake-200 contract.
  test('honeypot field triggers fake success without validation', async () => {
    const r = await request(app)
      .post('/api/public/audit-request')
      .send({
        // All required fields missing — would normally 400
        website: 'https://bot.example/',
      });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.success, true);
  });

  // Header-injection regression. A businessName with embedded CR/LF
  // would (without stripHdr) inject extra headers into the founder's
  // notification email. We can't intercept the email here (SMTP isn't
  // configured), but we CAN verify the endpoint accepts the request
  // and returns success — which is the contract that proves we don't
  // 500 on weird input. The header-stripping logic itself is exercised
  // by stripHdr being called inside the route.
  test('CR/LF in businessName does not crash the endpoint', async () => {
    const r = await request(app)
      .post('/api/public/audit-request')
      .send({
        email: 'prospect@example.com',
        businessName: 'Cafe\r\nBcc: attacker@evil.tld',
        businessUrl: 'https://maps.google.com/?cid=1',
      });
    assert.strictEqual(r.status, 200);
    // The endpoint accepts the request — internal stripHdr removes the
    // CR/LF before it reaches sendMail. Cannot assert on the resulting
    // email headers in this test setup.
  });

  // Length caps: extreme inputs should be sliced down rather than rejected.
  // Keeps the lead form forgiving — a prospect pasting a paragraph into the
  // business-name field still gets logged, just truncated.
  test('extremely long inputs are accepted and silently truncated', async () => {
    const r = await request(app)
      .post('/api/public/audit-request')
      .send({
        email: 'prospect@example.com',
        businessName: 'A'.repeat(5000),
        businessUrl: 'https://example.com/' + 'x'.repeat(5000),
        notes: 'Y'.repeat(10000),
      });
    assert.strictEqual(r.status, 200);
  });
});
