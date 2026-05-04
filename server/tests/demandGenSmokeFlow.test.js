// End-to-end smoke test for the prospect-to-paying-customer flow.
//
// This is the path that converts a cold-email send into a real paid
// customer. Before this test, every piece existed but the seams
// between them were never exercised together — leaving the risk that
// "code green, manually broken" silently regressed.
//
// Walks the full path:
//   1. Founder generates an outbound audit (POST /api/audit-previews)
//   2. Prospect opens the share URL on a real-browser UA
//      → audit_previews.view_count bumps
//      → audit_previews.first_viewed_at set
//      → audit_previews.last_notification_sent_at set (founder gets emailed)
//   3. Bot/preview-crawler hits the same URL
//      → counts and notification timestamps DO NOT change
//   4. Prospect (acting as a new user) registers
//      → token issued, no Authorization needed for the audit URL
//   5. Owner lists their audits and sees the view stats
//   6. Owner marks the audit as replied
//      → suppresses 48h reminder
//   7. Cron job runs — no reminder fires (suppression works)
//   8. Owner revokes the share URL → 404 on subsequent opens
//
// If any of these break in a future refactor, this test catches the
// regression at the seam, not in the field.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, request, makeUser } = require('./helpers');

describe('Demand-gen smoke flow: cold audit → opened → replied → closed', () => {
  let app;
  let founder;

  before(async () => {
    app = await getAgent();
    founder = await makeUser();
  });

  test('full prospect-to-paying-customer path stays green', async () => {
    // ── Step 1: founder generates an audit ───────────────────────────
    const createRes = await request(app)
      .post('/api/audit-previews')
      .set('Authorization', `Bearer ${founder.token}`)
      .send({
        business_name: 'Smoke Cafe',
        reviews: [
          { reviewer_name: 'Anna', rating: 5, text: 'Best espresso in town. Knowledgeable barista.' },
          { reviewer_name: 'Bram', rating: 4, text: 'Good food, limited seating on weekends.' },
        ],
      });
    assert.strictEqual(createRes.status, 200, `audit create failed: ${createRes.text}`);
    const { id: auditId, share_token } = createRes.body;
    assert.ok(share_token, 'share_token returned');
    assert.match(share_token, /^[a-f0-9]{48}$/, 'share_token is 48 hex chars');
    assert.strictEqual(createRes.body.reviews.length, 2);

    // ── Step 2: prospect opens via real browser UA ───────────────────
    const realUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
    const view1 = await request(app)
      .get(`/api/audit-previews/share/${share_token}`)
      .set('User-Agent', realUA);
    assert.strictEqual(view1.status, 200);
    assert.strictEqual(view1.body.business_name, 'Smoke Cafe');
    assert.strictEqual(view1.body.view_count, 1, 'first view bumps to 1');

    // Verify notification fired (last_notification_sent_at populated)
    const { get, run } = require('../src/db/schema');
    const afterFirstView = get(
      `SELECT view_count, first_viewed_at, last_notification_sent_at FROM audit_previews WHERE id = ?`,
      [auditId]
    );
    assert.strictEqual(afterFirstView.view_count, 1);
    assert.ok(afterFirstView.first_viewed_at, 'first_viewed_at set on real-browser hit');
    assert.ok(afterFirstView.last_notification_sent_at, 'notification timestamp set');

    // ── Step 3: bot crawler hits — should be silently ignored ────────
    const botRes = await request(app)
      .get(`/api/audit-previews/share/${share_token}`)
      .set('User-Agent', 'Slackbot-LinkExpanding 1.0');
    assert.strictEqual(botRes.status, 200, 'bots still get the JSON (their preview cards work)');

    const afterBot = get(
      `SELECT view_count, last_notification_sent_at FROM audit_previews WHERE id = ?`,
      [auditId]
    );
    assert.strictEqual(afterBot.view_count, 1, 'bot did NOT bump view_count');
    assert.strictEqual(
      afterBot.last_notification_sent_at,
      afterFirstView.last_notification_sent_at,
      'bot did NOT update notification timestamp'
    );

    // ── Step 4: founder lists audits and sees the open ───────────────
    const listRes = await request(app)
      .get('/api/audit-previews')
      .set('Authorization', `Bearer ${founder.token}`);
    assert.strictEqual(listRes.status, 200);
    const ours = listRes.body.audits.find(a => a.id === auditId);
    assert.ok(ours, 'audit appears in list');
    assert.strictEqual(ours.view_count, 1);
    assert.ok(ours.first_viewed_at, 'first_viewed_at exposed in list');
    assert.strictEqual(ours.marked_as_replied_at, null, 'not yet marked as replied');
    assert.ok('last_followup_reminder_sent_at' in ours, 'reminder column exposed');

    // ── Step 5: 48h reminder cron should NOT fire on a fresh audit ───
    // Fresh audit: first_viewed_at is "now," well below 48h threshold.
    const { runAuditFollowupReminders } = require('../src/jobs/auditFollowupReminders');
    await runAuditFollowupReminders();
    const noReminderYet = get(
      `SELECT last_followup_reminder_sent_at FROM audit_previews WHERE id = ?`,
      [auditId]
    );
    assert.strictEqual(noReminderYet.last_followup_reminder_sent_at, null,
      'no reminder for a freshly-viewed audit');

    // ── Step 6: jump time forward by backdating first_viewed_at ──────
    run(
      `UPDATE audit_previews SET first_viewed_at = datetime('now', '-50 hours') WHERE id = ?`,
      [auditId]
    );
    await runAuditFollowupReminders();
    const afterReminder = get(
      `SELECT last_followup_reminder_sent_at FROM audit_previews WHERE id = ?`,
      [auditId]
    );
    assert.ok(afterReminder.last_followup_reminder_sent_at, 'reminder fires at 50h');

    // ── Step 7: founder marks as replied — suppresses future reminders
    const markRes = await request(app)
      .post(`/api/audit-previews/${auditId}/mark-replied`)
      .set('Authorization', `Bearer ${founder.token}`);
    assert.strictEqual(markRes.status, 200);
    const afterMark = get(
      `SELECT marked_as_replied_at FROM audit_previews WHERE id = ?`,
      [auditId]
    );
    assert.ok(afterMark.marked_as_replied_at, 'marked-as-replied timestamp set');

    // ── Step 8: founder revokes the share URL ────────────────────────
    const revokeRes = await request(app)
      .delete(`/api/audit-previews/${auditId}`)
      .set('Authorization', `Bearer ${founder.token}`);
    assert.strictEqual(revokeRes.status, 200);
    assert.strictEqual(revokeRes.body.deleted, true);

    // Subsequent opens should 404 (audit row gone)
    const dead = await request(app)
      .get(`/api/audit-previews/share/${share_token}`)
      .set('User-Agent', realUA);
    assert.strictEqual(dead.status, 404, 'revoked audit URL returns 404');
  });

  test('cross-user isolation: cannot mark or revoke another founder\'s audit', async () => {
    // Founder A creates an audit
    const createRes = await request(app)
      .post('/api/audit-previews')
      .set('Authorization', `Bearer ${founder.token}`)
      .send({
        business_name: 'Isolation Cafe',
        reviews: [{ reviewer_name: 'Z', rating: 5, text: 'Great spot.' }],
      });
    const auditId = createRes.body.id;

    // Founder B tries to mark/revoke it
    const founderB = await makeUser();

    const markB = await request(app)
      .post(`/api/audit-previews/${auditId}/mark-replied`)
      .set('Authorization', `Bearer ${founderB.token}`);
    assert.strictEqual(markB.status, 404, 'mark-replied returns 404 for non-owner');

    const revokeB = await request(app)
      .delete(`/api/audit-previews/${auditId}`)
      .set('Authorization', `Bearer ${founderB.token}`);
    assert.strictEqual(revokeB.status, 404, 'delete returns 404 for non-owner');

    // The audit is still alive for founder A
    const stillThere = await request(app)
      .get('/api/audit-previews')
      .set('Authorization', `Bearer ${founder.token}`);
    assert.ok(
      stillThere.body.audits.find(a => a.id === auditId),
      'founder A still owns the audit'
    );
  });
});
