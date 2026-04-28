// Business owner claim flow tests.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, makeUserWithBusiness, request } = require('./helpers');
const { insert } = require('../src/db/schema');

function makeAdminEnv(email) {
  const prev = process.env.ADMIN_EMAIL;
  process.env.ADMIN_EMAIL = email;
  return () => { process.env.ADMIN_EMAIL = prev; };
}

describe('business claims — user routes', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('POST /businesses/:id/claim requires auth', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app).post(`/api/businesses/${u.businessId}/claim`).send({});
    assert.strictEqual(res.status, 401);
  });

  test('POST /businesses/:id/claim returns 404 for nonexistent business', async () => {
    const u = await makeUserWithBusiness();
    const res = await request(app)
      .post('/api/businesses/999999/claim')
      .set('Authorization', `Bearer ${u.token}`)
      .send({});
    assert.strictEqual(res.status, 404);
  });

  test('POST /businesses/:id/claim creates a pending claim without evidence', async () => {
    const owner = await makeUserWithBusiness('Claimable Co');
    const claimant = await makeUser();
    const res = await request(app)
      .post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimant.token}`)
      .send({});
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'pending');
    assert.strictEqual(res.body.business_id, owner.businessId);
  });

  test('POST /businesses/:id/claim accepts optional evidence text', async () => {
    const owner = await makeUserWithBusiness('Evidence Biz');
    const claimant = await makeUser();
    const res = await request(app)
      .post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimant.token}`)
      .send({ evidence: 'I am the registered owner, see domain WHOIS.' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.evidence, 'I am the registered owner, see domain WHOIS.');
  });

  test('POST /businesses/:id/claim returns 409 on duplicate pending claim', async () => {
    const owner = await makeUserWithBusiness('Dup Claim Biz');
    const claimant = await makeUser();
    await request(app)
      .post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimant.token}`)
      .send({});
    const res = await request(app)
      .post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimant.token}`)
      .send({});
    assert.strictEqual(res.status, 409);
    assert.match(res.body.error, /pending/i);
  });

  test('GET /businesses/:id/claim returns null when no claim exists', async () => {
    const owner = await makeUserWithBusiness('NoClaim Biz');
    const other = await makeUser();
    const res = await request(app)
      .get(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${other.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.claim, null);
  });

  test('GET /businesses/:id/claim returns the user\'s own claim status', async () => {
    const owner = await makeUserWithBusiness('Status Biz');
    const claimant = await makeUser();
    await request(app)
      .post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimant.token}`)
      .send({ evidence: 'proof' });
    const res = await request(app)
      .get(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimant.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.claim.status, 'pending');
  });
});

describe('business claims — admin routes', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /admin/claims returns 404 when ADMIN_EMAIL not set', async () => {
    const restore = makeAdminEnv('');
    const u = await makeUser();
    const res = await request(app).get('/api/admin/claims').set('Authorization', `Bearer ${u.token}`);
    restore();
    assert.strictEqual(res.status, 404);
  });

  test('GET /admin/claims returns 404 for non-admin user', async () => {
    const admin = await makeUser();
    const restore = makeAdminEnv('someother@example.com');
    const res = await request(app).get('/api/admin/claims').set('Authorization', `Bearer ${admin.token}`);
    restore();
    assert.strictEqual(res.status, 404);
  });

  test('GET /admin/claims lists pending claims for admin', async () => {
    const admin = await makeUser();
    const restore = makeAdminEnv(admin.email);

    const owner = await makeUserWithBusiness('Admin View Biz');
    const claimant = await makeUser();
    await request(app)
      .post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimant.token}`)
      .send({});

    const res = await request(app).get('/api/admin/claims').set('Authorization', `Bearer ${admin.token}`);
    restore();
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.rows));
    assert.ok(res.body.rows.some(r => r.business_id === owner.businessId));
  });

  test('POST /admin/claims/:id/approve approves a pending claim', async () => {
    const admin = await makeUser();
    const owner = await makeUserWithBusiness('Approve Biz');
    const claimant = await makeUser();

    const claimRes = await request(app)
      .post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimant.token}`)
      .send({});
    const claimId = claimRes.body.id;

    const restore = makeAdminEnv(admin.email);
    const res = await request(app)
      .post(`/api/admin/claims/${claimId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    restore();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'approved');
  });

  test('POST /admin/claims/:id/approve returns 409 if already approved', async () => {
    const admin = await makeUser();
    const owner = await makeUserWithBusiness('Double Approve Biz');
    const claimant = await makeUser();

    const claimRes = await request(app)
      .post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimant.token}`)
      .send({});
    const claimId = claimRes.body.id;

    const restore = makeAdminEnv(admin.email);
    await request(app)
      .post(`/api/admin/claims/${claimId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    const res = await request(app)
      .post(`/api/admin/claims/${claimId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    restore();
    assert.strictEqual(res.status, 409);
  });

  test('POST /admin/claims/:id/deny denies with a reason', async () => {
    const admin = await makeUser();
    const owner = await makeUserWithBusiness('Deny Biz');
    const claimant = await makeUser();

    const claimRes = await request(app)
      .post(`/api/businesses/${owner.businessId}/claim`)
      .set('Authorization', `Bearer ${claimant.token}`)
      .send({});
    const claimId = claimRes.body.id;

    const restore = makeAdminEnv(admin.email);
    const res = await request(app)
      .post(`/api/admin/claims/${claimId}/deny`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Could not verify ownership documentation.' });
    restore();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'denied');
    assert.strictEqual(res.body.denial_reason, 'Could not verify ownership documentation.');
  });
});
