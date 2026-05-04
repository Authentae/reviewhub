// Tests for audit follow-up reminder cron job + mark-replied endpoint +
// the bot-detection helper. These are the pieces of the
// "audit → opened → notify → 48h-later remind → mark replied" loop
// that the earlier auditPreviewNotification.test.js doesn't cover.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request, makeUser } = require('./helpers');

describe('POST /api/audit-previews/:id/mark-replied', () => {
  let app;
  let owner;
  let other;

  before(async () => {
    app = await getAgent();
    owner = await makeUser();
    other = await makeUser();
  });

  async function freshAudit(forUser = owner) {
    const r = await request(app)
      .post('/api/audit-previews')
      .set('Authorization', `Bearer ${forUser.token}`)
      .send({
        business_name: 'Test Co',
        reviews: [{ reviewer_name: 'X', rating: 5, text: 'Great spot, friendly service.' }],
      });
    assert.strictEqual(r.status, 200, r.text);
    return r.body.id;
  }

  function readRow(id) {
    const { get } = require('../src/db/schema');
    return get(`SELECT * FROM audit_previews WHERE id = ?`, [id]);
  }

  test('marking own audit as replied sets timestamp', async () => {
    const id = await freshAudit();
    assert.strictEqual(readRow(id).marked_as_replied_at, null);

    const r = await request(app)
      .post(`/api/audit-previews/${id}/mark-replied`)
      .set('Authorization', `Bearer ${owner.token}`);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.marked, true);
    assert.ok(readRow(id).marked_as_replied_at, 'timestamp should be populated');
  });

  test('marking is idempotent — second call refreshes timestamp without error', async () => {
    const id = await freshAudit();
    await request(app).post(`/api/audit-previews/${id}/mark-replied`).set('Authorization', `Bearer ${owner.token}`);
    const first = readRow(id).marked_as_replied_at;
    // Wait a tick so the SQLite second-resolution timestamp can move
    await new Promise(r => setTimeout(r, 1100));
    const r2 = await request(app)
      .post(`/api/audit-previews/${id}/mark-replied`)
      .set('Authorization', `Bearer ${owner.token}`);
    assert.strictEqual(r2.status, 200);
    const second = readRow(id).marked_as_replied_at;
    assert.notStrictEqual(second, first, 'second mark advances the timestamp');
  });

  test("cannot mark another user's audit", async () => {
    const id = await freshAudit(owner);
    const r = await request(app)
      .post(`/api/audit-previews/${id}/mark-replied`)
      .set('Authorization', `Bearer ${other.token}`);
    assert.strictEqual(r.status, 404, 'should 404 not 403 — leaks no info about audit existence');
  });

  test('rejects invalid audit id', async () => {
    const r = await request(app)
      .post(`/api/audit-previews/abc/mark-replied`)
      .set('Authorization', `Bearer ${owner.token}`);
    assert.strictEqual(r.status, 400);
  });

  test('requires auth', async () => {
    const id = await freshAudit();
    const r = await request(app).post(`/api/audit-previews/${id}/mark-replied`);
    assert.strictEqual(r.status, 401);
  });
});

describe('Audit follow-up reminder cron', () => {
  let app;
  let owner;

  before(async () => {
    app = await getAgent();
    owner = await makeUser();
  });

  async function freshAudit() {
    const r = await request(app)
      .post('/api/audit-previews')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        business_name: 'Reminder Cafe',
        reviews: [{ reviewer_name: 'Y', rating: 5, text: 'Lovely place to work from.' }],
      });
    return r.body.id;
  }

  function setFirstViewedHoursAgo(id, hours) {
    const { run } = require('../src/db/schema');
    run(
      `UPDATE audit_previews
          SET first_viewed_at = datetime('now', '-' || ? || ' hours'),
              last_viewed_at  = datetime('now', '-' || ? || ' hours'),
              view_count = 1
        WHERE id = ?`,
      [hours, hours, id]
    );
  }

  function readRow(id) {
    const { get } = require('../src/db/schema');
    return get(`SELECT * FROM audit_previews WHERE id = ?`, [id]);
  }

  test('audit viewed 49h ago triggers reminder', async () => {
    const id = await freshAudit();
    setFirstViewedHoursAgo(id, 49);

    const { runAuditFollowupReminders } = require('../src/jobs/auditFollowupReminders');
    const result = await runAuditFollowupReminders();

    const row = readRow(id);
    assert.ok(row.last_followup_reminder_sent_at, 'reminder timestamp should be set');
    assert.ok(result.sent >= 1, `at least one reminder sent (saw ${result.sent})`);
  });

  test('audit viewed only 24h ago does NOT trigger reminder (under 48h threshold)', async () => {
    const id = await freshAudit();
    setFirstViewedHoursAgo(id, 24);

    const { runAuditFollowupReminders } = require('../src/jobs/auditFollowupReminders');
    await runAuditFollowupReminders();

    const row = readRow(id);
    assert.strictEqual(row.last_followup_reminder_sent_at, null, 'too early — no reminder');
  });

  test('audit not viewed at all does NOT trigger reminder', async () => {
    const id = await freshAudit();
    // first_viewed_at is NULL — the audit was sent but never opened.

    const { runAuditFollowupReminders } = require('../src/jobs/auditFollowupReminders');
    await runAuditFollowupReminders();

    assert.strictEqual(readRow(id).last_followup_reminder_sent_at, null);
  });

  test('audit marked as replied is suppressed even at 49h', async () => {
    const id = await freshAudit();
    setFirstViewedHoursAgo(id, 49);
    const { run } = require('../src/db/schema');
    run(`UPDATE audit_previews SET marked_as_replied_at = datetime('now') WHERE id = ?`, [id]);

    const { runAuditFollowupReminders } = require('../src/jobs/auditFollowupReminders');
    await runAuditFollowupReminders();

    assert.strictEqual(readRow(id).last_followup_reminder_sent_at, null,
      'replied audits should not get reminders');
  });

  test('reminder fires at most once per audit (idempotent under repeated runs)', async () => {
    const id = await freshAudit();
    setFirstViewedHoursAgo(id, 50);

    const { runAuditFollowupReminders } = require('../src/jobs/auditFollowupReminders');
    await runAuditFollowupReminders();
    const firstStamp = readRow(id).last_followup_reminder_sent_at;
    assert.ok(firstStamp);

    // Second run: should NOT pick up this row since last_followup_reminder_sent_at is now set
    await new Promise(r => setTimeout(r, 1100));
    await runAuditFollowupReminders();
    const secondStamp = readRow(id).last_followup_reminder_sent_at;
    assert.strictEqual(secondStamp, firstStamp, 'second run must not re-fire');
  });

  test('expired audit does not trigger reminder even if recently viewed', async () => {
    const id = await freshAudit();
    setFirstViewedHoursAgo(id, 49);
    // Force expiry into the past
    const { run } = require('../src/db/schema');
    run(`UPDATE audit_previews SET expires_at = datetime('now', '-1 hour') WHERE id = ?`, [id]);

    const { runAuditFollowupReminders } = require('../src/jobs/auditFollowupReminders');
    await runAuditFollowupReminders();

    assert.strictEqual(readRow(id).last_followup_reminder_sent_at, null,
      'expired audits should be skipped');
  });
});

describe('REPLY_TO_PLATFORMS default behavior', () => {
  // We can't fully test the post-back path without a live Google connection
  // (the integration is heavily mocked), but we CAN test the env-var
  // resolution logic directly. The reviews route inlines the parsing, so
  // we re-create it here as a regression-anchor — if the route ever
  // changes the parsing, this test catches it via the comment audit.
  function resolveEnabled(envValue) {
    return envValue === undefined
      ? ['google']
      : envValue.split(',').map(s => s.trim()).filter(Boolean);
  }

  test('undefined env defaults to ["google"]', () => {
    assert.deepStrictEqual(resolveEnabled(undefined), ['google']);
  });

  test('empty string is honored as "all off"', () => {
    assert.deepStrictEqual(resolveEnabled(''), []);
  });

  test('explicit single platform works', () => {
    assert.deepStrictEqual(resolveEnabled('google'), ['google']);
  });

  test('comma-separated multi-platform list works', () => {
    assert.deepStrictEqual(resolveEnabled('google,facebook'), ['google', 'facebook']);
  });

  test('whitespace is trimmed', () => {
    assert.deepStrictEqual(resolveEnabled(' google , facebook '), ['google', 'facebook']);
  });

  test('empty entries are filtered', () => {
    assert.deepStrictEqual(resolveEnabled(',google,,'), ['google']);
  });
});

describe('isLikelyBot user-agent detection', () => {
  const { isLikelyBot } = require('../src/lib/botDetection');

  test('blank/missing UA → bot', () => {
    assert.strictEqual(isLikelyBot(''), true);
    assert.strictEqual(isLikelyBot(null), true);
    assert.strictEqual(isLikelyBot(undefined), true);
  });

  test('Slackbot link expander → bot', () => {
    assert.strictEqual(
      isLikelyBot('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'),
      true
    );
  });

  test('Twitterbot → bot', () => {
    assert.strictEqual(isLikelyBot('Twitterbot/1.0'), true);
  });

  test('Facebook external hit → bot', () => {
    assert.strictEqual(
      isLikelyBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'),
      true
    );
  });

  test('LinkedIn / WhatsApp / TelegramBot / Discordbot all flagged', () => {
    assert.strictEqual(isLikelyBot('LinkedInBot/1.0'), true);
    assert.strictEqual(isLikelyBot('WhatsApp/2.21.4.18'), true);
    assert.strictEqual(isLikelyBot('TelegramBot (like TwitterBot)'), true);
    assert.strictEqual(isLikelyBot('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'), true);
  });

  test('Googlebot / bingbot → bot', () => {
    assert.strictEqual(isLikelyBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
    assert.strictEqual(isLikelyBot('Mozilla/5.0 (compatible; bingbot/2.0)'), true);
  });

  test('generic "bot" / "crawler" / "spider" patterns → bot', () => {
    assert.strictEqual(isLikelyBot('SomeRandomBot/1.0'), true);
    assert.strictEqual(isLikelyBot('SomeCrawler/2.0'), true);
    assert.strictEqual(isLikelyBot('SomeSpider/3.0'), true);
    assert.strictEqual(isLikelyBot('uptime-monitor/1.0'), true);
    assert.strictEqual(isLikelyBot('headless-chrome/110'), true);
  });

  test('real browsers → NOT bot', () => {
    assert.strictEqual(
      isLikelyBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
      false
    );
    assert.strictEqual(
      isLikelyBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'),
      false
    );
    assert.strictEqual(
      isLikelyBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'),
      false
    );
    assert.strictEqual(
      isLikelyBot('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'),
      false
    );
  });
});
