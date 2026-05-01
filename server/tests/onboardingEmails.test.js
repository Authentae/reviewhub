// Tests for the onboarding email scheduler — idempotency, day thresholds,
// free-only days, platform-connected day-1 skip.
//
// SMTP isn't configured in tests (helpers.js clears the env), so
// sendOnboardingEmail logs to console rather than sending. The job still
// inserts into onboarding_emails on success — that's what we assert against.

const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, makeUser, setPlan } = require('./helpers');
const { runOnboardingEmails } = require('../src/jobs/onboardingEmails');
const { run, get, all } = require('../src/db/schema');

function markVerified(userId, hoursAgo = 0) {
  // Backdate email_verified_at to N hours ago so the threshold checks fire.
  const at = new Date(Date.now() - hoursAgo * 3600 * 1000)
    .toISOString().slice(0, 19).replace('T', ' ');
  run(`UPDATE users SET email_verified_at = ? WHERE id = ?`, [at, userId]);
}

describe('onboardingEmails scheduler', () => {
  before(async () => { await getAgent(); });
  beforeEach(() => {
    // Wipe the table between tests so each test starts clean. Users from
    // previous tests stay (helpers.js doesn't tear them down) but the
    // scheduler keys on (user_id, day_number) so leftover users don't
    // poison this test's assertions as long as we filter on userId.
    run(`DELETE FROM onboarding_emails`);
  });

  test('sends day-0 to a freshly verified user', async () => {
    const u = await makeUser('day0@example.com');
    markVerified(u.userId, 1); // 1h ago — past day-0 threshold (30min)

    const r = await runOnboardingEmails();
    const sent = r.details.filter(d => d.userId === u.userId);
    assert.ok(sent.find(d => d.day === 0), 'day-0 email should be sent');
  });

  test('does not re-send after running twice', async () => {
    const u = await makeUser('idemp@example.com');
    markVerified(u.userId, 1);

    await runOnboardingEmails();
    const r2 = await runOnboardingEmails();
    const sent = r2.details.filter(d => d.userId === u.userId);
    assert.strictEqual(sent.length, 0, 'second run should not re-send');

    // The row in onboarding_emails proves it WAS sent the first time.
    const row = get(`SELECT * FROM onboarding_emails WHERE user_id = ? AND day_number = 0`, [u.userId]);
    assert.ok(row, 'first send should have inserted a row');
  });

  test('respects notif_onboarding=0', async () => {
    const u = await makeUser('optout@example.com');
    markVerified(u.userId, 1);
    run(`UPDATE users SET notif_onboarding = 0 WHERE id = ?`, [u.userId]);

    const r = await runOnboardingEmails();
    const sent = r.details.filter(d => d.userId === u.userId);
    assert.strictEqual(sent.length, 0, 'opted-out user should get no emails');
  });

  test('skips day-7 for paid users but still sends day-3', async () => {
    const u = await makeUser('paid@example.com');
    markVerified(u.userId, 200); // > 168h, eligible for day 0/1/3/7
    setPlan(u.userId, 'starter');

    const r = await runOnboardingEmails();
    const sent = r.details.filter(d => d.userId === u.userId);
    const days = sent.map(d => d.day).sort();
    assert.deepStrictEqual(days, [0, 1, 3], 'paid users get 0/1/3 but not 7');
  });

  test('skips day-1 for users who connected a platform', async () => {
    const u = await makeUserWithBusiness('Connected Co');
    markVerified(u.userId, 30); // past day-1 threshold

    // Add a platform connection so the day-1 "stuck on setup" pitch doesn't fire
    const biz = get('SELECT id FROM businesses WHERE user_id = ?', [u.userId]);
    run(
      `INSERT INTO platform_connections (business_id, provider, external_account_id) VALUES (?, 'google', 'fake-acct-123')`,
      [biz.id]
    );

    const r = await runOnboardingEmails();
    const sent = r.details.filter(d => d.userId === u.userId);
    const days = sent.map(d => d.day);
    assert.ok(days.includes(0), 'day-0 still fires');
    assert.ok(!days.includes(1), 'day-1 should be suppressed');
    // But the row should still exist (so we don't re-check next tick)
    const row = get(`SELECT * FROM onboarding_emails WHERE user_id = ? AND day_number = 1`, [u.userId]);
    assert.ok(row, 'day-1 should be marked sent (skipped) so cron does not re-check');
  });

  test('does not send day-3 if only 2 hours have passed since verify', async () => {
    const u = await makeUser('early@example.com');
    markVerified(u.userId, 2); // way before day-3 threshold

    const r = await runOnboardingEmails();
    const sent = r.details.filter(d => d.userId === u.userId);
    const days = sent.map(d => d.day);
    assert.ok(days.includes(0), 'day-0 fires (30min threshold passed)');
    assert.ok(!days.includes(3), 'day-3 should NOT fire yet');
    assert.ok(!days.includes(7), 'day-7 should NOT fire yet');
  });
});
