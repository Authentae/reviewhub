// Response templates CRUD route tests.

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const { getAgent, makeUser, makeUserWithBusiness, setPlan, request } = require('./helpers');

describe('templates API', () => {
  let app;
  before(async () => { app = await getAgent(); });

  test('GET /templates requires auth', async () => {
    const res = await request(app).get('/api/templates');
    assert.strictEqual(res.status, 401);
  });

  test('GET /templates returns empty list for new user', async () => {
    const u = await makeUserWithBusiness();
    await setPlan(u.userId, 'starter');
    const res = await request(app).get('/api/templates').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.templates, []);
  });

  test('POST /templates requires Starter plan or higher', async () => {
    const u = await makeUserWithBusiness();
    // Free plan — templates feature disabled.
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'My Template', body: 'Thanks for the review!' });
    assert.strictEqual(res.status, 403);
    assert.match(res.body.error, /Starter/);
  });

  test('POST /templates rejects missing title', async () => {
    const u = await makeUserWithBusiness();
    await setPlan(u.userId, 'starter');
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ body: 'Thanks for the review!' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /title/i);
  });

  test('POST /templates rejects missing body', async () => {
    const u = await makeUserWithBusiness();
    await setPlan(u.userId, 'starter');
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'My Template' });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /body/i);
  });

  test('POST /templates creates a template and returns it', async () => {
    const u = await makeUserWithBusiness();
    await setPlan(u.userId, 'starter');
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'Positive Reply', body: 'Thank you so much for the kind words!' });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.title, 'Positive Reply');
    assert.strictEqual(res.body.body, 'Thank you so much for the kind words!');
  });

  test('GET /templates returns the created template', async () => {
    const u = await makeUserWithBusiness();
    await setPlan(u.userId, 'starter');
    await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'Greeting', body: 'Hello there!' });
    const res = await request(app).get('/api/templates').set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.templates.some(t => t.title === 'Greeting'));
  });

  test('PUT /templates/:id updates title and body', async () => {
    const u = await makeUserWithBusiness();
    await setPlan(u.userId, 'starter');
    const created = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'Old Title', body: 'Old body text.' });
    const id = created.body.id;

    const res = await request(app)
      .put(`/api/templates/${id}`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'New Title', body: 'New body text.' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.title, 'New Title');
    assert.strictEqual(res.body.body, 'New body text.');
  });

  test('PUT /templates/:id returns 404 for another user\'s template', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    await setPlan(u1.userId, 'starter');
    const created = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u1.token}`)
      .send({ title: 'Private', body: 'Private body.' });
    const id = created.body.id;

    const res = await request(app)
      .put(`/api/templates/${id}`)
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ title: 'Hacked', body: 'Hacked body.' });
    assert.strictEqual(res.status, 404);
  });

  test('DELETE /templates/:id removes the template', async () => {
    const u = await makeUserWithBusiness();
    await setPlan(u.userId, 'starter');
    const created = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ title: 'To Delete', body: 'Goodbye.' });
    const id = created.body.id;

    const del = await request(app)
      .delete(`/api/templates/${id}`)
      .set('Authorization', `Bearer ${u.token}`);
    assert.strictEqual(del.status, 200);
    assert.strictEqual(del.body.success, true);

    // Confirm it's gone.
    const list = await request(app).get('/api/templates').set('Authorization', `Bearer ${u.token}`);
    assert.ok(!list.body.templates.some(t => t.id === id));
  });

  test('DELETE /templates/:id returns 404 for another user\'s template', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    await setPlan(u1.userId, 'starter');
    const created = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u1.token}`)
      .send({ title: 'Do Not Delete', body: 'Body.' });
    const id = created.body.id;

    const res = await request(app)
      .delete(`/api/templates/${id}`)
      .set('Authorization', `Bearer ${u2.token}`);
    assert.strictEqual(res.status, 404);
  });

  test('POST /templates truncates title to 100 chars and body to 1000 chars', async () => {
    const u = await makeUserWithBusiness();
    await setPlan(u.userId, 'starter');
    const longTitle = 'A'.repeat(200);
    const longBody = 'B'.repeat(2000);
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ title: longTitle, body: longBody });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.title.length, 100);
    assert.strictEqual(res.body.body.length, 1000);
  });

  test('templates are isolated between users', async () => {
    const u1 = await makeUserWithBusiness();
    const u2 = await makeUserWithBusiness();
    await setPlan(u1.userId, 'starter');
    await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${u1.token}`)
      .send({ title: 'U1 Template', body: 'Only for U1.' });

    const res = await request(app).get('/api/templates').set('Authorization', `Bearer ${u2.token}`);
    assert.strictEqual(res.status, 200);
    assert.ok(!res.body.templates.some(t => t.title === 'U1 Template'));
  });
});
