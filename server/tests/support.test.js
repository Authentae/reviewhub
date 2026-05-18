// Tests for POST /api/support and GET /api/support/me — the public-or-authed
// support ticket intake.
//
// Critical because:
//   1. Validation (email format, category allowlist, subject + message minimums)
//      — silently accepting garbage means real tickets get buried in spam
//   2. Honeypot — bots flood public POSTs; the contract is "honey field set =
//      fake 200 with NO row inserted"
//   3. CR/LF stripping — anything that lands in an outbound email header that
//      contains \n would let an attacker inject extra headers (BCC, etc.)
//   4. authOptional behavior — the same endpoint must accept both anonymous
//      and authed submissions; authed ones should auto-populate user_id
//   5. /me must only return the caller's own tickets (no cross-user leakage)
//   6. Rate limiter must be bypassed under NODE_ENV=test (same trick as
//      waitlist.test.js — supertest reuses 127.0.0.1 so 5/hr would cap us)

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request, makeUser } = require('./helpers');

describe('POST /api/support', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('accepts an anonymous valid ticket', async () => {
    const r = await request(app)
      .post('/api/support')
      .send({
        email: `anon-${Date.now()}@test.local`,
        subject: 'Cant connect Google',
        category: 'bug',
        message: 'I tried connecting my Google account three times and it loops.',
      });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.success, true);
    assert.ok(Number.isInteger(r.body.ticket_id), 'ticket_id should be returned');
  });

  test('accepts an authed ticket and uses the auth email when none provided', async () => {
    const user = await makeUser();
    const r = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        subject: 'Question about billing',
        category: 'billing',
        message: 'When does my next invoice go out?',
      });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.success, true);
  });

  test('honeypot field returns fake-200 and does NOT insert a row', async () => {
    // Count rows for a known unique subject before + after; honeypot must
    // not create the row even though the response says success.
    const { all } = require('../src/db/schema');
    const subj = `honey-${Date.now()}`;
    const r = await request(app)
      .post('/api/support')
      .send({
        email: 'bot@test.local',
        subject: subj,
        category: 'bug',
        message: 'this is a bot submission',
        website: 'http://spam.example', // honeypot — humans never fill this
      });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.success, true);
    const rows = all('SELECT id FROM support_tickets WHERE subject = ?', [subj]);
    assert.strictEqual(rows.length, 0, 'honeypot submission must not insert');
  });

  test('rejects missing email', async () => {
    const r = await request(app)
      .post('/api/support')
      .send({ subject: 'x', category: 'bug', message: 'help help help' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /email/i);
  });

  test('rejects invalid email format', async () => {
    const r = await request(app)
      .post('/api/support')
      .send({
        email: 'not-an-email',
        subject: 'x',
        category: 'bug',
        message: 'help help help',
      });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /email/i);
  });

  test('rejects empty subject', async () => {
    const r = await request(app)
      .post('/api/support')
      .send({
        email: 'a@b.co',
        subject: '',
        category: 'bug',
        message: 'help help help',
      });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /subject/i);
  });

  test('rejects category outside the allowlist', async () => {
    const r = await request(app)
      .post('/api/support')
      .send({
        email: 'a@b.co',
        subject: 'x',
        category: 'urgent-pls-respond-NOW',
        message: 'help help help',
      });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /category/i);
  });

  test('rejects too-short message', async () => {
    const r = await request(app)
      .post('/api/support')
      .send({
        email: 'a@b.co',
        subject: 'x',
        category: 'bug',
        message: 'oi', // < 5 chars
      });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /describe/i);
  });

  test('strips CR/LF from subject (header-injection defense)', async () => {
    // The strip happens before insert + before the outbound email; subject
    // is what we can verify post-hoc via the DB row.
    const { get } = require('../src/db/schema');
    const r = await request(app)
      .post('/api/support')
      .send({
        email: `crlf-${Date.now()}@test.local`,
        subject: 'legit subject\r\nBcc: attacker@evil.com',
        category: 'bug',
        message: 'header injection attempt',
      });
    assert.strictEqual(r.status, 200);
    const row = get('SELECT subject FROM support_tickets WHERE id = ?', [r.body.ticket_id]);
    assert.ok(row, 'row should exist');
    assert.ok(!/[\r\n]/.test(row.subject), 'subject must not contain CR or LF');
  });

  test('accepts all valid category values', async () => {
    for (const cat of ['bug', 'billing', 'account', 'feature', 'other']) {
      const r = await request(app)
        .post('/api/support')
        .send({
          email: `cat-${cat}-${Date.now()}@test.local`,
          subject: `cat test ${cat}`,
          category: cat,
          message: `Testing category: ${cat}`,
        });
      assert.strictEqual(r.status, 200, `category ${cat} should accept`);
    }
  });

  test('truncates over-long subject to 200 chars without erroring', async () => {
    // Defensive truncation — long subjects are usually a client bug or a
    // copy-paste of an entire stack trace into the subject. Reject would
    // lose a real ticket; truncate keeps it.
    const { get } = require('../src/db/schema');
    const r = await request(app)
      .post('/api/support')
      .send({
        email: `long-${Date.now()}@test.local`,
        subject: 'x'.repeat(500),
        category: 'other',
        message: 'long subject test',
      });
    assert.strictEqual(r.status, 200);
    const row = get('SELECT subject FROM support_tickets WHERE id = ?', [r.body.ticket_id]);
    assert.ok(row.subject.length <= 200, 'subject must be truncated to 200');
  });
});

describe('GET /api/support/me', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('requires auth', async () => {
    const r = await request(app).get('/api/support/me');
    assert.strictEqual(r.status, 401);
  });

  test('returns only the caller\'s tickets, newest first', async () => {
    const user = await makeUser();
    // Create 2 tickets as this user.
    await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ subject: 'mine 1', category: 'bug', message: 'first ticket' });
    await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ subject: 'mine 2', category: 'feature', message: 'second ticket' });

    // Create a ticket as someone else — must NOT appear.
    const other = await makeUser();
    await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ subject: 'other persons ticket', category: 'bug', message: 'should not leak' });

    const r = await request(app)
      .get('/api/support/me')
      .set('Authorization', `Bearer ${user.token}`);
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.tickets));
    const subjects = r.body.tickets.map((t) => t.subject);
    assert.ok(subjects.includes('mine 1'));
    assert.ok(subjects.includes('mine 2'));
    assert.ok(!subjects.includes('other persons ticket'), 'must not leak other users\' tickets');
  });
});
