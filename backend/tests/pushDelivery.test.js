const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../dist/models/User').default;
const Activity = require('../dist/models/Activity').default;
const Notification = require('../dist/models/Notification').default;
const PushDevice = require('../dist/models/PushDevice').default;
const PushDelivery = require('../dist/models/PushDelivery').default;
const { addPendingJoin } = require('../dist/services/activityMembership');
const { drainNotificationEvents, persistNotificationEvent } = require('../dist/services/notifications');
const { scheduleNotificationPushes, processPushDeliveries, checkPushReceipts } = require('../dist/services/pushDelivery');
const { ExpoHttpError } = require('../dist/services/expoPush');

(async () => {
  process.env.JWT_SECRET = 'isolated-push-test-secret';
  process.env.EXPO_PROJECT_ID = randomUUID();
  const mongo = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    await Promise.all([User.init(), Activity.init(), Notification.init(), PushDevice.init(), PushDelivery.init()]);
    const app = express(); app.use(express.json());
    app.use('/devices', require('../dist/routes/pushDevices').default);
    app.use('/notifications', require('../dist/routes/notifications').default);
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const call = async (user, path, method, body) => {
      const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method,
        headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user.id }, process.env.JWT_SECRET)}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: res.status, data: await res.json() };
    };
    const host = await User.create({ name: 'Host', email: 'host@test.local', password: 'test' });
    const requester = await User.create({ name: 'Requester', email: 'requester@test.local', password: 'test' });
    const other = await User.create({ name: 'Other', email: 'other@test.local', password: 'test' });
    const activity = await Activity.create({ title: 'SECRET PRIVATE TITLE', category: 'Outdoors', description: 'Test description', location: 'SECRET LOCATION',
      exactAddress: 'SECRET ADDRESS', inviteCode: 'SECRET INVITE', visibility: 'private', host: host._id, participants: [host._id],
      date: new Date(Date.now() + 86400000), maxAttendees: 5 });
    const register = async (user, device, token) => call(user, `/devices/${device}`, 'PUT', {
      expoPushToken: token, platform: 'ios', projectId: process.env.EXPO_PROJECT_ID,
    });
    const d1 = randomUUID(), d2 = randomUUID(), foreign = randomUUID();
    assert.equal((await register(null, d1, 'ExpoPushToken[one]')).status, 401);
    assert.equal((await register(host, d1, 'invalid')).status, 400);
    const first = await register(host, d1, 'ExpoPushToken[one]');
    assert.equal(first.status, 200); assert.ok(first.data.registrationId);
    assert.equal(JSON.stringify(first.data).includes('ExpoPushToken'), false);
    assert.equal((await register(host, d1, 'ExpoPushToken[one]')).data.registrationId, first.data.registrationId);
    await register(host, d2, 'ExpoPushToken[two]');
    await register(other, foreign, 'ExpoPushToken[other]');
    assert.equal((await register(other, randomUUID(), 'ExpoPushToken[one]')).status, 409);

    await addPendingJoin(activity.id, requester.id, {});
    const queued = (await Activity.findById(activity.id).select('+notificationEvents')).notificationEvents[0];
    await drainNotificationEvents();
    await scheduleNotificationPushes();
    assert.equal(await PushDelivery.countDocuments(), 2);
    const batches = [];
    const transport = {
      send: async (messages) => { batches.push(messages); return messages.map((_, i) => ({ status: 'ok', id: `ticket-${i}` })); },
      receipts: async () => ({ 'ticket-0': { status: 'error', details: { error: 'DeviceNotRegistered' } }, 'ticket-1': { status: 'ok' } }),
    };
    await Promise.all([processPushDeliveries(transport), processPushDeliveries(transport)]);
    assert.equal(batches.flat().length, 2);
    assert.deepEqual(batches.flat().map((m) => m.to).sort(), ['ExpoPushToken[one]', 'ExpoPushToken[two]']);
    for (const payload of batches.flat()) {
      assert.equal(JSON.stringify(payload).includes('SECRET'), false);
      assert.deepEqual(Object.keys(payload.data).sort(), ['activityId', 'notificationId', 'type']);
      assert.equal(payload.sound, null);
    }
    await persistNotificationEvent(activity.id, queued);
    await scheduleNotificationPushes();
    await processPushDeliveries(transport);
    assert.equal(batches.flat().length, 2);
    const notification = await Notification.findOne();
    assert.equal((await call(other, `/notifications/${notification.id}`, 'GET')).status, 404);
    await checkPushReceipts(transport, new Date(Date.now() + 16 * 60000));
    assert.ok(await PushDevice.countDocuments({ user: host._id, revokedAt: { $ne: null } }));
    assert.equal(await Notification.countDocuments(), 1);

    // Independent scenarios operate only on this disposable database.
    const fresh = async () => {
      await PushDelivery.deleteMany({}); await Notification.deleteMany({});
      await PushDevice.updateMany({ user: host._id }, { $set: { revokedAt: new Date() } });
      await register(host, d1, 'ExpoPushToken[one]');
      const n = await Notification.create({ recipient: host._id, type: 'activity_edited', activity: activity._id,
        title: 'Safe title', body: 'Safe body', idempotencyKey: randomUUID(), pushPending: true });
      await scheduleNotificationPushes(); return n;
    };
    await fresh();
    let sends = 0;
    const transient = { ...transport, send: async () => { sends++; if (sends === 1) throw new ExpoHttpError(503); return [{ status: 'ok', id: 'retried' }]; } };
    await processPushDeliveries(transient);
    assert.equal((await PushDelivery.findOne()).state, 'pending');
    await processPushDeliveries(transient); assert.equal(sends, 1);
    await processPushDeliveries(transient, new Date(Date.now() + 3 * 60000));
    await processPushDeliveries(transient, new Date(Date.now() + 4 * 60000));
    assert.equal(sends, 2); assert.equal((await PushDelivery.findOne()).state, 'ticket');

    await fresh(); sends = 0;
    const alwaysRejected = { ...transport, send: async () => { sends++; throw new ExpoHttpError(503); } };
    for (let attempt = 0; attempt < 5; attempt++) {
      await processPushDeliveries(alwaysRejected, new Date(Date.now() + attempt * 20 * 60000));
    }
    assert.equal(sends, 4); assert.equal((await PushDelivery.findOne()).state, 'failed');
    assert.equal(await Notification.countDocuments(), 1);

    await fresh();
    await processPushDeliveries({ ...transport, send: async () => [{ status: 'ok', id: 'missing-receipt' }] });
    for (let lookup = 0; lookup < 9; lookup++) {
      await checkPushReceipts({ ...transport, receipts: async () => ({}) }, new Date(Date.now() + (16 + lookup * 61) * 60000));
    }
    assert.equal((await PushDelivery.findOne()).state, 'unknown');
    assert.equal((await PushDelivery.findOne()).receiptChecks, 8);

    await fresh(); sends = 0;
    await PushDelivery.updateOne({}, { $set: { state: 'claimed', leaseId: randomUUID(), leaseUntil: new Date(0) } });
    const recovered = { ...transport, send: async () => { sends++; return [{ status: 'ok', id: 'recovered' }]; } };
    await processPushDeliveries(recovered);
    assert.equal(sends, 1);
    await PushDelivery.updateOne({}, { $set: { state: 'sending', leaseUntil: new Date(0) } });
    await processPushDeliveries(recovered);
    assert.equal(sends, 1); assert.equal((await PushDelivery.findOne()).state, 'unknown');

    await fresh();
    await processPushDeliveries({ ...transport, send: async () => [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] });
    assert.ok((await PushDevice.findById(d1)).revokedAt);
    assert.equal(await Notification.countDocuments(), 1);
    assert.equal((await PushDelivery.findOne()).state, 'failed');

    await fresh(); sends = 0;
    const ambiguous = { ...transport, send: async () => { sends++; throw new Error('timeout after acceptance is possible'); } };
    await processPushDeliveries(ambiguous);
    await processPushDeliveries(ambiguous, new Date(Date.now() + 600000));
    assert.equal(sends, 1); assert.equal((await PushDelivery.findOne()).state, 'unknown');
    assert.equal(await Notification.countDocuments(), 1);

    await fresh();
    await processPushDeliveries({ ...transport, send: async () => [{ status: 'ok', id: 'old-token-ticket' }] });
    const rotated = await register(host, d1, 'ExpoPushToken[rotated]');
    await checkPushReceipts({ ...transport, receipts: async () => ({ 'old-token-ticket': { status: 'error', details: { error: 'DeviceNotRegistered' } } }) }, new Date(Date.now() + 16 * 60000));
    assert.equal((await PushDevice.findById(d1)).revokedAt, null);
    await call(other, `/devices/${d1}`, 'DELETE', { registrationId: rotated.data.registrationId });
    assert.equal((await PushDevice.findById(d1)).revokedAt, null);
    await call(host, `/devices/${d1}`, 'DELETE', { registrationId: first.data.registrationId });
    assert.equal((await PushDevice.findById(d1)).revokedAt, null);
    await call(host, `/devices/${d1}`, 'DELETE', { registrationId: rotated.data.registrationId });
    assert.ok((await PushDevice.findById(d1)).revokedAt);

    await fresh();
    await register(other, d1, 'ExpoPushToken[one]');
    sends = 0;
    await processPushDeliveries({ ...transport, send: async () => { sends++; return []; } });
    assert.equal(sends, 0); assert.equal((await PushDelivery.findOne()).state, 'skipped');
    console.log('Push integration tests passed: durable source, devices, deduplication, ownership, privacy, receipts, retries, rotation, logout, account switch.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
