// Shared test helpers.
//
// Strategy:
//   - Each test file runs with NODE_ENV=test set by node --test via the env
//     export below, and with DATABASE_PATH pointed at a unique file under the
//     OS tmp directory so parallel test files don't stomp on each other.
//   - We call getDb() + createDemoUser() once per file (lazy — first request).
//   - We use supertest in "listening" mode against the configured app, not
//     against a running port, so port conflicts are impossible.
//   - A makeUser() helper registers a random user and returns { token, email }.
//
// DO NOT import anything from ../src at module top-level until DATABASE_PATH
// has been set — the schema module reads the env var at require time.

const path = require('path');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');

// Set up per-process test DB before the schema module is ever loaded.
if (!process.env.DATABASE_PATH) {
  // Unique tmp file per worker: pid + ms timestamp + 8 bytes of randomness.
  // Two test files running in parallel can coincidentally share pid + ms;
  // the random suffix guarantees no collision.
  const rand = crypto.randomBytes(4).toString('hex');
  const file = path.join(os.tmpdir(), `reviewhub-test-${process.pid}-${Date.now()}-${rand}.db`);
  process.env.DATABASE_PATH = file;
}
process.env.NODE_ENV = 'test';
// Short-circuit CLIENT_URL for email link tests so we can easily reason about
// what goes into the outbound links.
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://test.local';

const request = require('supertest');

// Late-bind so tests that `require('./helpers')` first see the env vars applied.
let _appPromise = null;
function getAgent() {
  if (!_appPromise) {
    _appPromise = (async () => {
      const { getDb } = require('../src/db/schema');
      const { createDemoUser } = require('../src/db/seed');
      await getDb();
      await createDemoUser();
      const { createApp } = require('../src/app');
      return createApp();
    })();
  }
  return _appPromise;
}

// Register a fresh user with a random email + password. Returns the JWT and
// the email so a follow-up call (e.g. create business) can authenticate.
// All test users auto-accept Terms and confirm age — they're synthetic users
// in an isolated test DB, not real humans, so the attestations just need to
// be valid for the register endpoint's gate.
async function makeUser() {
  const app = await getAgent();
  const email = `test-${crypto.randomBytes(4).toString('hex')}@example.com`;
  const password = 'TestPass-9f2A!xQ';
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, acceptedTerms: true, ageConfirmed: true });
  if (res.status !== 200) throw new Error(`register failed: ${res.status} ${res.text}`);
  return { token: res.body.token, email, password, userId: res.body.user.id };
}

// Register a user and create their business in one shot. Returns everything.
// New registrations land on the Free tier (1 platform, 3 AI drafts/mo). Tests
// that need higher limits should call setPlan(user.userId, 'pro') after.
async function makeUserWithBusiness(name = 'Test Co', plan = 'free') {
  const user = await makeUser();
  if (plan !== 'free') setPlan(user.userId, plan);
  const app = await getAgent();
  const res = await request(app)
    .post('/api/businesses')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ business_name: name });
  if (res.status !== 200) throw new Error(`create business failed: ${res.status} ${res.text}`);
  return { ...user, businessId: res.body.id };
}

// Override the user's plan directly in the DB for tests that need specific
// feature/quota combinations. Production code never does this — plan changes
// come from the billing-provider webhook.
function setPlan(userId, plan) {
  const { run } = require('../src/db/schema');
  run('UPDATE subscriptions SET plan = ? WHERE user_id = ?', [plan, userId]);
}

// Cleanup helper used in after() — deletes the tmp DB files.
function cleanupTempDb() {
  const p = process.env.DATABASE_PATH;
  if (!p || p === ':memory:') return;
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(p + suffix); } catch { /* ignore */ }
  }
}

module.exports = { getAgent, makeUser, makeUserWithBusiness, setPlan, request, cleanupTempDb };
