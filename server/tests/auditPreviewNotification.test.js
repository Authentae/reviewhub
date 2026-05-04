// Tests for outbound-audit view-notification behavior on GET
// /api/audit-previews/share/:token. The endpoint is public (no auth),
// so we can't sit on a mailer spy directly — instead we observe the
// DB column `last_notification_sent_at` as a proxy for "would have
// fired the notification email." That column is gated by the same
// rules as the SMTP send (bot filter, owner-self skip, 24h throttle),
// so checking it is a faithful test of notification behavior.
//
// The actual SMTP transport is null in tests (helpers.js neuters
// SMTP_HOST), so the send becomes a console.log no-op. Our
// fire-and-forget code path is exercised end-to-end either way.

const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { getAgent, request, makeUser } = require('./helpers');

describe('Audit-preview view notifications', () => {
  let app;
  let owner;

  before(async () => {
    app = await getAgent();
    owner = await makeUser();
  });

  // Fresh audit per test: identical share_token would let later tests
  // observe state from earlier tests, which masks regressions.
  async function freshAudit() {
    const r = await request(app)
      .post('/api/audit-previews')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        business_name: 'Test Cafe',
        reviews: [
          { reviewer_name: 'Alice', rating: 5, text: 'Lovely staff and great coffee — would return.' },
        ],
      });
    assert.strictEqual(r.status, 200, `create audit failed: ${r.status} ${r.text}`);
    return { token: r.body.share_token, id: r.body.id };
  }

  // Read the raw audit_previews row directly. We can't use the GET /
  // list endpoint because it doesn't return last_notification_sent_at.
  function readRow(id) {
    const { get } = require('../src/db/schema');
    return get(
      `SELECT view_count, first_viewed_at, last_viewed_at, last_notification_sent_at
         FROM audit_previews WHERE id = ?`,
      [id]
    );
  }

  test('first human view bumps view_count and marks notification sent', async () => {
    const { token, id } = await freshAudit();
    const before = readRow(id);
    assert.strictEqual(before.view_count, 0);
    assert.strictEqual(before.last_notification_sent_at, null);

    const r = await request(app)
      .get(`/api/audit-previews/share/${token}`)
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    assert.strictEqual(r.status, 200);

    const after = readRow(id);
    assert.strictEqual(after.view_count, 1);
    assert.ok(after.first_viewed_at, 'first_viewed_at should be set');
    assert.ok(after.last_notification_sent_at, 'notification timestamp should be set');
  });

  test('bot user-agent does NOT bump view_count and does NOT trigger notification', async () => {
    const { token, id } = await freshAudit();

    // Slackbot prefetches every URL pasted into a Slack message — this
    // is exactly the false-positive we're filtering against.
    const r = await request(app)
      .get(`/api/audit-previews/share/${token}`)
      .set('User-Agent', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)');
    assert.strictEqual(r.status, 200);

    const row = readRow(id);
    assert.strictEqual(row.view_count, 0, 'view_count must not bump for bots');
    assert.strictEqual(row.last_notification_sent_at, null, 'no notification for bots');
  });

  test('missing user-agent treated as bot (silent)', async () => {
    const { token, id } = await freshAudit();

    // supertest defaults to setting a UA; explicitly clear it. Real
    // browsers always send one; absence is a strong bot signal.
    const r = await request(app)
      .get(`/api/audit-previews/share/${token}`)
      .unset('User-Agent');
    assert.strictEqual(r.status, 200);

    const row = readRow(id);
    assert.strictEqual(row.view_count, 0);
    assert.strictEqual(row.last_notification_sent_at, null);
  });

  test('repeat human view within 24h does NOT re-fire notification', async () => {
    const { token, id } = await freshAudit();
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

    await request(app).get(`/api/audit-previews/share/${token}`).set('User-Agent', ua);
    const after1 = readRow(id);
    const firstNotifAt = after1.last_notification_sent_at;
    assert.ok(firstNotifAt);

    // Immediately re-hit. Throttle should suppress.
    await request(app).get(`/api/audit-previews/share/${token}`).set('User-Agent', ua);
    const after2 = readRow(id);

    assert.strictEqual(after2.view_count, 2, 'view_count should still bump on refresh');
    assert.strictEqual(
      after2.last_notification_sent_at,
      firstNotifAt,
      'throttle window suppresses re-fire'
    );
  });

  test('view after throttle expires DOES re-fire notification', async () => {
    const { token, id } = await freshAudit();
    const ua = 'Mozilla/5.0 (Windows NT 10.0)';

    await request(app).get(`/api/audit-previews/share/${token}`).set('User-Agent', ua);
    const firstNotif = readRow(id).last_notification_sent_at;
    assert.ok(firstNotif);

    // Backdate the notification timestamp 25h to simulate throttle
    // expiry. We compare against the BACKDATED value, not the original
    // first-fire — the original first-fire is "now-ish" so a fast
    // re-fire would produce the same timestamp by coincidence and
    // make this test flaky.
    const { run, get } = require('../src/db/schema');
    run(
      `UPDATE audit_previews SET last_notification_sent_at = datetime('now', '-25 hours') WHERE id = ?`,
      [id]
    );
    const backdated = get(
      `SELECT last_notification_sent_at FROM audit_previews WHERE id = ?`,
      [id]
    ).last_notification_sent_at;

    await request(app).get(`/api/audit-previews/share/${token}`).set('User-Agent', ua);
    const after = readRow(id);

    assert.notStrictEqual(
      after.last_notification_sent_at,
      backdated,
      'expired throttle should let a fresh notification fire (advancing the timestamp)'
    );
    // Sanity: the new timestamp is recent (within 1 minute), proving it
    // moved forward to "now" rather than staying at the backdated value.
    const ageMs = Date.now() - new Date(String(after.last_notification_sent_at).replace(' ', 'T') + 'Z').getTime();
    assert.ok(ageMs < 60_000, `re-fired timestamp should be recent, was ${ageMs}ms ago`);
  });

  test('owner self-view (logged in with owner JWT) does NOT trigger notification', async () => {
    const { token, id } = await freshAudit();

    const r = await request(app)
      .get(`/api/audit-previews/share/${token}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('User-Agent', 'Mozilla/5.0 (Macintosh)');
    assert.strictEqual(r.status, 200);

    const row = readRow(id);
    assert.strictEqual(row.view_count, 1, 'self-view still increments count (audit truthfulness)');
    assert.strictEqual(
      row.last_notification_sent_at,
      null,
      'self-view should never email the founder'
    );
  });

  test('different (non-owner) authenticated user DOES trigger notification', async () => {
    const { token, id } = await freshAudit();
    const stranger = await makeUser();

    await request(app)
      .get(`/api/audit-previews/share/${token}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64)');

    const row = readRow(id);
    assert.strictEqual(row.view_count, 1);
    assert.ok(
      row.last_notification_sent_at,
      'a logged-in non-owner is still a real prospect signal'
    );
  });
});
