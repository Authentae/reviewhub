// Tests for the optional SPA-bundling behavior (SERVE_CLIENT=1).
//
// The production Dockerfile copies the built client's dist/ to /app/client-dist
// and sets SERVE_CLIENT=1 so this one process serves both /api/* and the SPA.
// That makes the Railway / Fly / VPS deploy topology one service, one port,
// no reverse proxy. These tests verify:
//   - Off by default — tests, dev, and any setup without the env var behave
//     identically to before (just /api routes)
//   - On with a real dist dir — serves index.html for unknown paths and
//     preserves /api routing
//   - Missing dist dir while SERVE_CLIENT=1 logs a warning and still serves API

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('./helpers');
const request = require('supertest');

describe('SPA bundling (SERVE_CLIENT)', () => {
  let tmpDist;

  before(() => {
    tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewhub-dist-'));
    fs.writeFileSync(path.join(tmpDist, 'index.html'),
      '<!doctype html><html><body><div id="root">SPA</div></body></html>');
    fs.mkdirSync(path.join(tmpDist, 'assets'));
    fs.writeFileSync(path.join(tmpDist, 'assets', 'index-abc.js'), 'console.log(1)');
  });
  after(() => {
    try { fs.rmSync(tmpDist, { recursive: true, force: true }); } catch {}
  });

  test('default build (no SERVE_CLIENT) returns 404 for non-API paths', async () => {
    const { createApp } = require('../src/app');
    const app = createApp();
    const res = await request(app).get('/dashboard');
    // Without SPA bundling enabled, / and /dashboard are not served; only
    // /api/* routes exist. Express returns 404 for non-matching paths.
    assert.strictEqual(res.status, 404);
  });

  test('SERVE_CLIENT=1 + valid dist serves index.html for SPA routes', async () => {
    const prevServe = process.env.SERVE_CLIENT;
    const prevDist = process.env.CLIENT_DIST_DIR;
    process.env.SERVE_CLIENT = '1';
    process.env.CLIENT_DIST_DIR = tmpDist;
    // App must be re-created so the new env is applied
    delete require.cache[require.resolve('../src/app')];
    try {
      const { createApp } = require('../src/app');
      const app = createApp();

      const dashboard = await request(app).get('/dashboard');
      assert.strictEqual(dashboard.status, 200);
      assert.match(dashboard.text, /id="root"/);

      const root = await request(app).get('/');
      assert.strictEqual(root.status, 200);
      assert.match(root.text, /id="root"/);

      const asset = await request(app).get('/assets/index-abc.js');
      assert.strictEqual(asset.status, 200);
      assert.match(asset.text, /console\.log/);
    } finally {
      if (prevServe === undefined) delete process.env.SERVE_CLIENT; else process.env.SERVE_CLIENT = prevServe;
      if (prevDist === undefined) delete process.env.CLIENT_DIST_DIR; else process.env.CLIENT_DIST_DIR = prevDist;
      delete require.cache[require.resolve('../src/app')];
    }
  });

  test('SERVE_CLIENT=1 still returns 404 JSON for unknown /api routes', async () => {
    const prevServe = process.env.SERVE_CLIENT;
    const prevDist = process.env.CLIENT_DIST_DIR;
    process.env.SERVE_CLIENT = '1';
    process.env.CLIENT_DIST_DIR = tmpDist;
    delete require.cache[require.resolve('../src/app')];
    try {
      const { createApp } = require('../src/app');
      const app = createApp();
      const res = await request(app).get('/api/does-not-exist');
      assert.strictEqual(res.status, 404);
      assert.deepStrictEqual(res.body, { error: 'Not found' });
    } finally {
      if (prevServe === undefined) delete process.env.SERVE_CLIENT; else process.env.SERVE_CLIENT = prevServe;
      if (prevDist === undefined) delete process.env.CLIENT_DIST_DIR; else process.env.CLIENT_DIST_DIR = prevDist;
      delete require.cache[require.resolve('../src/app')];
    }
  });

  test('SERVE_CLIENT=1 with missing dist dir falls back to API-only (warns, does not crash)', async () => {
    const prevServe = process.env.SERVE_CLIENT;
    const prevDist = process.env.CLIENT_DIST_DIR;
    process.env.SERVE_CLIENT = '1';
    process.env.CLIENT_DIST_DIR = path.join(os.tmpdir(), 'reviewhub-does-not-exist-' + Date.now());
    delete require.cache[require.resolve('../src/app')];
    try {
      const { createApp } = require('../src/app');
      const app = createApp(); // must not throw even though dist is missing
      const res = await request(app).get('/dashboard');
      assert.strictEqual(res.status, 404, 'with no dist dir, non-API paths 404 as usual');
    } finally {
      if (prevServe === undefined) delete process.env.SERVE_CLIENT; else process.env.SERVE_CLIENT = prevServe;
      if (prevDist === undefined) delete process.env.CLIENT_DIST_DIR; else process.env.CLIENT_DIST_DIR = prevDist;
      delete require.cache[require.resolve('../src/app')];
    }
  });
});
