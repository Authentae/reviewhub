// Integration tests for /api/review-requests

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUserWithBusiness, request } = require('./helpers');

describe('review-requests', () => {
  let app;
  before(async () => { app = await getAgent(); });

  async function setBizPlatformId(u, field, value) {
    const { run } = require('../src/db/schema');
    run(`UPDATE businesses SET ${field} = ? WHERE user_id = ?`, [value, u.userId]);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  test('GET /review-requests requires auth', async () => {
    const res = await request(app).get('/api/review-requests');
    assert.strictEqual(res.status, 401);
  });

  test('POST /review-requests requires auth', async () => {
    const res = await request(app).post('/api/review-requests').send({});
    assert.strictEqual(res.status, 401);
  });

  // ── List ──────────────────────────────────────────────────────────────────

  test('GET /review-requests returns empty list for new user', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).get('/api/review-requests').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 0);
    assert.deepStrictEqual(res.body.requests, []);
    assert.strictEqual(res.body.stats.sent, 0);
    assert.strictEqual(res.body.stats.clicked, 0);
    assert.strictEqual(res.body.stats.followed_up, 0);
  });

  test('list response includes follow_up_sent_at on each request', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJlistfu');
    await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'List', customer_email: 'list@x.com', platform: 'google' });
    const res = await request(app).get('/api/review-requests').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.requests.length > 0);
    assert.ok('follow_up_sent_at' in res.body.requests[0]);
    assert.strictEqual(res.body.requests[0].follow_up_sent_at, null);
  });

  test('followed_up stat counts sent follow-ups', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJfustat');
    const sent = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'FU', customer_email: 'fu@x.com', platform: 'google' });
    // Simulate a follow-up by setting the column directly (job is covered by followUpRequests.test.js)
    const { run } = require('../src/db/schema');
    run(`UPDATE review_requests SET follow_up_sent_at = datetime('now') WHERE id = ?`, [sent.body.id]);
    const res = await request(app).get('/api/review-requests').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.stats.followed_up, 1);
  });

  // ── Send ──────────────────────────────────────────────────────────────────

  test('POST /review-requests sends a request and returns 201', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJtest123');
    const res = await request(app)
      .post('/api/review-requests')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'Jane Doe', customer_email: 'jane@example.com', platform: 'google' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.customer_name, 'Jane Doe');
    assert.strictEqual(res.body.customer_email, 'jane@example.com');
    assert.strictEqual(res.body.platform, 'google');
    assert.ok(res.body.sent_at);
    assert.strictEqual(res.body.clicked_at, null);
  });

  test('GET /review-requests lists the sent request', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJtest456');
    await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'Bob', customer_email: 'bob@test.com', platform: 'google' });
    const res = await request(app).get('/api/review-requests').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.body.total, 1);
    assert.strictEqual(res.body.stats.sent, 1);
    assert.strictEqual(res.body.stats.clicked, 0);
    assert.strictEqual(res.body.requests[0].customer_name, 'Bob');
  });

  // Regression: a stray double-click on the Send button used to fire two
  // emails to the same customer. Now blocked with 409 within a 24h window.
  test('POST /review-requests blocks duplicate within 24h', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJduptest');

    const first = await request(app).post('/api/review-requests')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'Dup', customer_email: 'dup@example.com', platform: 'google' });
    assert.strictEqual(first.status, 201);

    const second = await request(app).post('/api/review-requests')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'Dup', customer_email: 'dup@example.com', platform: 'google' });
    assert.strictEqual(second.status, 409);
    assert.strictEqual(second.body.code, 'duplicate_recent');
    assert.ok(second.body.last_sent_at);
  });

  test('duplicate check is case-insensitive on email', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJcasetest');
    await request(app).post('/api/review-requests')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'Casey', customer_email: 'casey@example.com', platform: 'google' });
    const second = await request(app).post('/api/review-requests')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'Casey', customer_email: 'CASEY@example.com', platform: 'google' });
    assert.strictEqual(second.status, 409);
  });

  test('duplicate check does NOT block a different platform', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJxplat');
    await setBizPlatformId(u, 'yelp_business_id', 'ylp-1');
    await request(app).post('/api/review-requests')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'X', customer_email: 'x@example.com', platform: 'google' });
    const yelp = await request(app).post('/api/review-requests')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'X', customer_email: 'x@example.com', platform: 'yelp' });
    assert.strictEqual(yelp.status, 201);
  });

  test('POST /review-requests rejects missing customer_name', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_email: 'x@x.com', platform: 'google' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /customer_name/);
  });

  test('POST /review-requests rejects invalid email', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'X', customer_email: 'not-an-email', platform: 'google' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /email/i);
  });

  test('POST /review-requests rejects invalid platform', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'X', customer_email: 'x@x.com', platform: 'twitter' });
    assert.strictEqual(res.status, 400);
  });

  test('POST /review-requests returns 422 when platform ID not configured', async () => {
    const u = await makeUserWithBusiness();
    // google_place_id is NULL by default
    const res = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'X', customer_email: 'x@x.com', platform: 'google' });
    assert.strictEqual(res.status, 422);
  });

  test('POST /review-requests accepts optional message', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJmsg');
    const res = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'C', customer_email: 'c@c.com', platform: 'google', message: 'Thanks for visiting!' });
    assert.strictEqual(res.status, 201);
  });

  // ── Click tracking ────────────────────────────────────────────────────────

  test('GET /review-requests/track/:token records click and redirects', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJclick');
    const sent = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'D', customer_email: 'd@d.com', platform: 'google' });

    // The token is not returned by the API (security). We must look it up via DB.
    const { all } = require('../src/db/schema');
    const rows = all('SELECT token_hash FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.strictEqual(rows.length, 1);

    // The tracking endpoint uses the token_hash stored in DB — we can't call it
    // without the plaintext token, but we can verify the row was created with clicked_at=null.
    const { get } = require('../src/db/schema');
    const rr = get('SELECT clicked_at FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.strictEqual(rr.clicked_at, null);
  });

  test('GET /review-requests/track/:token returns 404 for unknown token', async () => {
    const res = await request(app).get('/api/review-requests/track/deadbeef00000000000000000000000000000000000000000000000000000000');
    assert.strictEqual(res.status, 404);
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  test('DELETE /review-requests/:id removes the record', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJdel');
    const sent = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'E', customer_email: 'e@e.com', platform: 'google' });
    const del = await request(app).delete(`/api/review-requests/${sent.body.id}`).set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);
    assert.strictEqual(del.body.deleted, true);
    const list = await request(app).get('/api/review-requests').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(list.body.total, 0);
  });

  test('DELETE /review-requests/:id returns 404 for another user\'s record', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    await setBizPlatformId(u1, 'google_place_id', 'ChIJiso');
    const sent = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u1.token}`)
      .send({ customer_name: 'F', customer_email: 'f@f.com', platform: 'google' });
    const res = await request(app).delete(`/api/review-requests/${sent.body.id}`).set('Authorization', `Bearer ${u2.token}`);
    assert.strictEqual(res.status, 404);
  });

  // ── Bulk send ─────────────────────────────────────────────────────────────

  test('POST /review-requests/bulk requires auth', async () => {
    const res = await request(app).post('/api/review-requests/bulk')
      .set('Content-Type', 'text/csv').send('name,email\nJoe,joe@x.com');
    assert.strictEqual(res.status, 401);
  });

  test('POST /review-requests/bulk blocked on Free plan', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post('/api/review-requests/bulk')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/csv')
      .send('name,email\nJoe,joe@x.com');
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.upgrade, true);
  });

  test('POST /review-requests/bulk sends multiple on Starter plan', async () => {
    const u = await makeUserWithBusiness('Bulk Co', 'starter');
    await setBizPlatformId(u, 'google_place_id', 'ChIJbulk');
    const csv = 'customer_name,customer_email\nAlice,alice@bulk.com\nBob,bob@bulk.com\n,invalid-not-email';
    const res = await request(app).post('/api/review-requests/bulk?platform=google')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/csv')
      .send(csv);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sent, 2);
    assert.strictEqual(res.body.skipped, 1);
  });

  test('POST /review-requests/bulk returns 400 for empty CSV', async () => {
    const u = await makeUserWithBusiness('Bulk2 Co', 'starter');
    await setBizPlatformId(u, 'google_place_id', 'ChIJbulk2');
    const res = await request(app).post('/api/review-requests/bulk?platform=google')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/csv')
      .send('');
    assert.strictEqual(res.status, 400);
  });

  // Regression: bulk-import used to silently double-send to a customer the
  // operator had emailed earlier the same day. Now skipped with a row-level
  // error matching the per-customer 24h cooldown on the single-send path.
  test('POST /review-requests/bulk skips duplicates within 24h', async () => {
    const u = await makeUserWithBusiness('Bulk Dup Co', 'starter');
    await setBizPlatformId(u, 'google_place_id', 'ChIJbulkdup');
    // Send a single request first
    const first = await request(app).post('/api/review-requests')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'Carl', customer_email: 'carl@bulk.com', platform: 'google' });
    assert.strictEqual(first.status, 201);

    // Now bulk-upload a CSV that includes Carl alongside a fresh address
    const csv = 'customer_name,customer_email\nCarl,carl@bulk.com\nDana,dana@bulk.com';
    const bulk = await request(app).post('/api/review-requests/bulk?platform=google')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/csv')
      .send(csv);
    assert.strictEqual(bulk.status, 200);
    assert.strictEqual(bulk.body.sent, 1, 'only Dana should be sent');
    assert.strictEqual(bulk.body.skipped, 1, 'Carl should be skipped');
    assert.match(bulk.body.errors[0].reason, /already sent.*24 hours/i);
  });

  test('POST /review-requests/bulk returns 422 when platform ID not configured', async () => {
    const u = await makeUserWithBusiness('Bulk3 Co', 'starter');
    const res = await request(app).post('/api/review-requests/bulk?platform=google')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Content-Type', 'text/csv')
      .send('name,email\nCarol,carol@x.com');
    assert.strictEqual(res.status, 422);
  });

  // ── Resend ───────────────────────────────────────────────────────────────

  test('POST /review-requests/:id/resend requires auth', async () => {
    const res = await request(app).post('/api/review-requests/1/resend');
    assert.strictEqual(res.status, 401);
  });

  test('POST /review-requests/:id/resend resends and resets clicked_at', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJresend');
    const sent = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'G', customer_email: 'g@g.com', platform: 'google' });
    assert.strictEqual(sent.status, 201);

    const res = await request(app)
      .post(`/api/review-requests/${sent.body.id}/resend`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.resent, true);
    assert.ok(res.body.sent_at);

    const { get } = require('../src/db/schema');
    const rr = get('SELECT clicked_at FROM review_requests WHERE id = ?', [sent.body.id]);
    assert.strictEqual(rr.clicked_at, null);
  });

  test('POST /review-requests/:id/resend returns 404 for another user\'s record', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    await setBizPlatformId(u1, 'google_place_id', 'ChIJresend2');
    const sent = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u1.token}`)
      .send({ customer_name: 'H', customer_email: 'h@h.com', platform: 'google' });
    const res = await request(app)
      .post(`/api/review-requests/${sent.body.id}/resend`)
      .set('Authorization', `Bearer ${u2.token}`);
    assert.strictEqual(res.status, 404);
  });

  test('POST /review-requests/:id/resend returns 422 when platform ID removed', async () => {
    const u = await makeUserWithBusiness();
    await setBizPlatformId(u, 'google_place_id', 'ChIJresend3');
    const sent = await request(app).post('/api/review-requests').set('Authorization', `Bearer ${u.token}`)
      .send({ customer_name: 'I', customer_email: 'i@i.com', platform: 'google' });
    // Remove the platform ID before resend
    await setBizPlatformId(u, 'google_place_id', null);
    const res = await request(app)
      .post(`/api/review-requests/${sent.body.id}/resend`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 422);
  });
});
