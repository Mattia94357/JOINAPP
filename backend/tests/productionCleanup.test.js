const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function run() {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'production-cleanup-test-secret-32-characters';
  process.env.FRONTEND_URL = 'https://join.example.test';
  delete process.env.SMTP_HOST; delete process.env.SMTP_PORT; delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
  const mongo = await MongoMemoryServer.create();
  let server;
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    await mongoose.connect(mongo.getUri());
    const User = require('../dist/models/User').default;
    const { assertDemoSeedAllowed } = require('../dist/scripts/seed-demo-data');
    const { requestContext } = require('../dist/middleware/requestContext');
    const { asyncHandler } = require('../dist/middleware/asyncHandler');
    const { errorHandler } = require('../dist/middleware/errorHandler');
    await User.init();

    assert.throws(() => assertDemoSeedAllowed({ NODE_ENV: 'production', DEMO_SEED_CONFIRM: 'CREATE_JOIN_TEST_DATA', DEMO_SEED_PASSWORD: 'strong-test-only' }), /disabled in production/);
    assert.throws(() => assertDemoSeedAllowed({ NODE_ENV: 'development', DEMO_SEED_PASSWORD: 'strong-test-only' }), /DEMO_SEED_CONFIRM/);
    assert.throws(() => assertDemoSeedAllowed({ NODE_ENV: 'development', DEMO_SEED_CONFIRM: 'CREATE_JOIN_TEST_DATA' }), /DEMO_SEED_PASSWORD/);
    assert.doesNotThrow(() => assertDemoSeedAllowed({ NODE_ENV: 'development', DEMO_SEED_CONFIRM: 'CREATE_JOIN_TEST_DATA', DEMO_SEED_PASSWORD: 'strong-test-only' }));

    const app = express(); app.set('trust proxy', 1); app.use(requestContext); app.use(express.json());
    app.use('/api/auth', require('../dist/routes/auth').default);
    app.post('/api/fail', asyncHandler(async () => { throw new Error('secret JWT abc.def.ghi password=hunter2'); }));
    app.use(errorHandler);
    server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (path, options = {}) => {
      const response = await fetch(`${base}${path}`, options); const text = await response.text();
      return { response, data: JSON.parse(text) };
    };

    const registered = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unrated User', email: 'unrated@example.test', password: 'Password123' }) });
    assert.equal(registered.response.status, 200);
    assert.match(registered.response.headers.get('x-request-id') || '', /^[A-Za-z0-9-]{16,64}$/);
    assert.equal(registered.data.user.hostRating, undefined);
    assert.equal(registered.data.user.reviewCount, 0);
    assert.equal((await User.findById(registered.data.user.id)).hostRating, undefined);

    const forgot = await request('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'unrated@example.test' }) });
    assert.equal(forgot.response.status, 503);
    assert.equal(forgot.data.resetToken, undefined);
    assert.equal(forgot.data.resetUrl, undefined);

    const failed = await request('/api/fail?inviteCode=PRIVATE-CODE', { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer PRIVATE-JWT', 'X-Request-ID': 'cleanup-test-1',
    }, body: JSON.stringify({ password: 'PRIVATE-PASSWORD', latitude: -31.1, message: 'PRIVATE-MESSAGE' }) });
    assert.equal(failed.response.status, 500);
    assert.equal(failed.response.headers.get('x-request-id'), 'cleanup-test-1');
    assert.deepEqual(failed.data, { message: 'Something went wrong. Please try again.' });
    const serializedLogs = JSON.stringify(logs);
    for (const secret of ['PRIVATE-CODE', 'PRIVATE-JWT', 'PRIVATE-PASSWORD', 'PRIVATE-MESSAGE', 'hunter2', 'abc.def.ghi']) assert.ok(!serializedLogs.includes(secret));
    assert.match(serializedLogs, /cleanup-test-1/);
    assert.match(serializedLogs, /POST/);
    assert.ok(serializedLogs.includes('/api/fail'));
    assert.ok(!JSON.stringify(failed.data).includes('stack'));
    console.log('Production cleanup backend tests passed.');
  } finally {
    console.error = originalError;
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
