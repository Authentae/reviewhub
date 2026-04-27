// Tests for the RFC 8058 one-click unsubscribe endpoint.
//
// Locks down:
//   - signed token from makeUnsubToken is accepted on GET and POST
//   - bad/missing tokens are rejected
//   - the matching notification column is flipped to 0
//   - the action is recorded in audit_log (regression guard for the
//     logAudit-signature bug where the call passed an object as `req`,
//     causing every unsubscribe to silently fail audit recording)
//   - GET responds with a redirect; POST responds with JSON

const test = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, request } = require('./helpers');
const { get, all, run } = require('../src/db/schema');
const { makeUnsubToken } = require('../src/lib/tokens');

test('unsubscribe', async (t) => {
  const app = await getAgent();

  await t.test('rejects requests without a token', async () => {
    const res = await request(app).get('/api/auth/unsubscribe');
    assert.strictEqual(res.status, 400);
  });

  await t.test('rejects an obviously bad token', async () => {
    const res = await request(app).get('/api/auth/unsubscribe?token=not-a-real-token');
    assert.strictEqual(res.status, 400);
  });

  await t.test('GET with a valid token flips the column and redirects', async () => {
    const u = await makeUser();
    // notif_weekly_summary defaults to 0; opt in so we can observe the flip.
    run('UPDATE users SET notif_weekly_summary = 1 WHERE id = ?', [u.userId]);
    const before = get('SELECT notif_weekly_summary FROM users WHERE id = ?', [u.userId]);
    assert.strictEqual(before.notif_weekly_summary, 1);

    const token = makeUnsubToken(u.userId, 'digest');
    const res = await request(app).get(`/api/auth/unsubscribe?token=${encodeURIComponent(token)}`);
    assert.strictEqual(res.status, 302);
    assert.match(res.headers.location, /\/unsubscribed\?list=digest$/);

    const after = get('SELECT notif_weekly_summary FROM users WHERE id = ?', [u.userId]);
    assert.strictEqual(after.notif_weekly_summary, 0);
  });

  await t.test('POST with a valid token returns JSON for one-click mail clients', async () => {
    const u = await makeUser();
    const token = makeUnsubToken(u.userId, 'new_review');
    const res = await request(app).post('/api/auth/unsubscribe').send({ token });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.list, 'new_review');

    const after = get('SELECT notif_new_review FROM users WHERE id = ?', [u.userId]);
    assert.strictEqual(after.notif_new_review, 0);
  });

  await t.test('writes an audit_log row for the unsubscribe action', async () => {
    // Regression guard: previously logAudit was called with a single object
    // argument (wrong signature) — the call silently failed and no row was
    // ever recorded for unsubscribe events. This test enforces the row
    // actually lands.
    const u = await makeUser();
    const token = makeUnsubToken(u.userId, 'negative_alert');
    await request(app).post('/api/auth/unsubscribe').send({ token });

    const rows = all(
      `SELECT event, user_id, metadata FROM audit_log
       WHERE user_id = ? AND event = 'email.unsubscribed'`,
      [u.userId]
    );
    assert.strictEqual(rows.length, 1, 'expected one audit_log row for the unsubscribe');
    const meta = JSON.parse(rows[0].metadata);
    assert.strictEqual(meta.list, 'negative_alert');
    assert.strictEqual(meta.via, 'POST');
  });

  await t.test('is idempotent — second unsubscribe does not error', async () => {
    const u = await makeUser();
    const token = makeUnsubToken(u.userId, 'digest');
    const a = await request(app).post('/api/auth/unsubscribe').send({ token });
    const b = await request(app).post('/api/auth/unsubscribe').send({ token });
    assert.strictEqual(a.status, 200);
    assert.strictEqual(b.status, 200);
  });
});
