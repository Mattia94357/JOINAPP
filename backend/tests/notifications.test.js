// Isolated real MongoDB + HTTP tests. Never connects to application data.
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const Activity = require('../dist/models/Activity').default;
const User = require('../dist/models/User').default;
const Notification = require('../dist/models/Notification').default;
const { drainNotificationEvents, persistNotificationEvent } = require('../dist/services/notifications');
const { promoteActivityWaitlist } = require('../dist/services/activityMembership');

async function run() {
  process.env.JWT_SECRET = 'notification-tests-only-secret-never-used-outside-tests';
  const mongo = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    await Promise.all([Activity.init(), User.init(), Notification.init()]);
    const app = express();
    app.use(express.json());
    app.use('/api/activities', require('../dist/routes/activities').default);
    app.use('/api/notifications', require('../dist/routes/notifications').default);
    app.use('/api/users', require('../dist/routes/users').default);
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const user = async (name) => User.create({ name, email: `${name}@example.test`, password: 'test', profileCompleted: true, profilePictureUrl: 'https://example.test/photo.jpg' });
    const host = await user('host');
    const requester = await user('requester');
    const other = await user('other');
    const call = async (who, path, method = 'GET', body) => {
      const response = await fetch(`${base}${path}`, {
        method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${jwt.sign({ userId: who.id }, process.env.JWT_SECRET)}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: await response.json() };
    };
    const activity = (extra = {}) => Activity.create({
      title: 'Test activity', description: 'A sufficiently long activity description.', category: 'Outdoors',
      location: 'Perth', date: new Date(Date.now() + 86400000), host: host._id,
      participants: [host._id], maxAttendees: 6, visibility: 'public', joinApproval: 'manual', ...extra,
    });
    const notifications = (who, type, a) => Notification.find({ recipient: who._id, type, activity: a._id });

    const a = await activity();
    assert.equal((await call(requester, `/activities/${a.id}/join`, 'POST', {})).status, 200);
    assert.equal((await call(requester, `/activities/${a.id}/join`, 'POST', {})).status, 200);
    const pending = await Activity.findById(a.id).select('+notificationEvents');
    assert.equal(pending.notificationEvents.length, 1);
    // Queue replay, including competing consumers, must not duplicate records.
    await Promise.all([persistNotificationEvent(a.id, pending.notificationEvents[0]), persistNotificationEvent(a.id, pending.notificationEvents[0])]);
    await drainNotificationEvents();
    assert.equal((await notifications(host, 'join_request', a)).length, 1);
    assert.equal((await notifications(requester, 'join_request', a)).length, 0);
    assert.equal((await call(host, `/activities/${a.id}/approve/${requester.id}`, 'POST', {})).status, 200);
    assert.equal((await call(host, `/activities/${a.id}/approve/${requester.id}`, 'POST', {})).status, 409);
    await drainNotificationEvents();
    assert.equal((await notifications(requester, 'join_approved', a)).length, 1);

    const declined = await activity();
    await call(requester, `/activities/${declined.id}/join`, 'POST', {});
    await call(host, `/activities/${declined.id}/decline/${requester.id}`, 'POST', {});
    await drainNotificationEvents();
    assert.equal((await notifications(requester, 'join_declined', declined)).length, 1);

    // A failed materialization retains the committed event for a later retry.
    const retry = await activity();
    await call(requester, `/activities/${retry.id}/join`, 'POST', {});
    const originalWrite = Notification.updateOne;
    const originalError = console.error;
    try {
      Notification.updateOne = async () => { throw new Error('Simulated storage failure'); };
      console.error = () => {};
      await drainNotificationEvents();
    } finally { Notification.updateOne = originalWrite; console.error = originalError; }
    assert.equal((await Activity.findById(retry.id).select('+notificationEvents')).notificationEvents.length, 1);
    await drainNotificationEvents();
    assert.equal((await notifications(host, 'join_request', retry)).length, 1);

    // Withdrawing and requesting again represents a NEW event, not a replay.
    const repeat = await activity();
    await call(requester, `/activities/${repeat.id}/join`, 'POST', {});
    await call(requester, `/activities/${repeat.id}/withdraw`, 'POST', {});
    await call(requester, `/activities/${repeat.id}/join`, 'POST', {});
    await drainNotificationEvents();
    assert.equal((await notifications(host, 'join_request', repeat)).length, 2);

    const cancelled = await activity({ participants: [host._id, requester._id, other._id] });
    await Promise.all([call(host, `/activities/${cancelled.id}/cancel`, 'POST', {}), call(host, `/activities/${cancelled.id}/cancel`, 'POST', {})]);
    await drainNotificationEvents();
    assert.equal((await notifications(host, 'activity_cancelled', cancelled)).length, 0);
    assert.equal((await notifications(requester, 'activity_cancelled', cancelled)).length, 1);
    assert.equal((await notifications(other, 'activity_cancelled', cancelled)).length, 1);

    const edited = await activity({ participants: [host._id, requester._id] });
    await call(host, `/activities/${edited.id}`, 'PATCH', { title: 'Cosmetic edit' });
    await drainNotificationEvents();
    assert.equal((await notifications(requester, 'activity_edited', edited)).length, 0);
    const newDate = new Date(Date.now() + 172800000).toISOString();
    await call(host, `/activities/${edited.id}`, 'PATCH', { date: newDate });
    await call(host, `/activities/${edited.id}`, 'PATCH', { date: newDate });
    await drainNotificationEvents();
    assert.equal((await notifications(requester, 'activity_edited', edited)).length, 1);
    assert.equal((await notifications(host, 'activity_edited', edited)).length, 0);

    const promoted = await activity({ waitlist: [requester._id], maxAttendees: 2, joinApproval: 'auto' });
    await Promise.all([promoteActivityWaitlist(promoted.id), promoteActivityWaitlist(promoted.id)]);
    await drainNotificationEvents();
    assert.equal((await notifications(requester, 'waitlist_promoted', promoted)).length, 1);

    const privateActivity = await activity({ title: 'Secret activity title', visibility: 'private',
      participants: [host._id, requester._id], exactAddress: 'Secret precise address', inviteCode: 'secret-invite-code' });
    await call(host, `/activities/${privateActivity.id}`, 'PATCH', { location: 'New meeting place' });
    await drainNotificationEvents();
    let privateRecord = (await notifications(requester, 'activity_edited', privateActivity))[0];
    assert.ok(privateRecord);
    let list = await call(requester, '/notifications?limit=50');
    assert.equal(list.data.notifications.find((n) => n.id === privateRecord.id).activityTitle, 'Secret activity title');
    await call(host, `/activities/${privateActivity.id}/remove-participant/${requester.id}`, 'POST', {});
    await drainNotificationEvents();
    assert.equal((await notifications(requester, 'participant_removed', privateActivity)).length, 1);
    list = await call(requester, '/notifications?limit=50');
    const hidden = list.data.notifications.find((n) => n.id === privateRecord.id);
    assert.equal(hidden.target, null);
    assert.equal(hidden.activityTitle, null);
    for (const secret of ['Secret activity title', 'Secret precise address', 'secret-invite-code', 'notificationEvents', 'pushToken']) {
      assert.equal(JSON.stringify(list.data).includes(secret), false);
      assert.equal(JSON.stringify(await Notification.find({ activity: privateActivity._id })).includes(secret), false);
    }
    assert.equal((await call(null, '/notifications')).status, 401);
    const emptyUser = await user('empty');
    assert.deepEqual((await call(emptyUser, '/notifications')).data, { notifications: [], nextCursor: null });
    const hostRecord = (await notifications(host, 'join_request', a))[0];
    assert.equal((await call(other, `/notifications/${hostRecord.id}/read`, 'PATCH', {})).status, 404);
    const owned = await call(other, `/notifications?recipient=${host.id}&limit=50`);
    assert.ok(owned.data.notifications.every((n) => n.id !== hostRecord.id));
    const count = await Notification.countDocuments({ recipient: requester._id, readAt: null });
    assert.equal((await call(requester, '/notifications/unread-count')).data.unreadCount, count);
    const read = await call(host, `/notifications/${hostRecord.id}/read`, 'PATCH', {});
    assert.equal(read.status, 200);
    assert.equal((await call(host, `/notifications/${hostRecord.id}/read`, 'PATCH', {})).data.readAt, read.data.readAt);
    await call(requester, '/notifications/read-all', 'PATCH', {});
    assert.equal((await call(requester, '/notifications/unread-count')).data.unreadCount, 0);
    assert.ok((await call(other, '/notifications/unread-count')).data.unreadCount > 0);

    const first = await call(host, '/notifications?limit=1');
    assert.equal(first.data.notifications.length, 1);
    assert.ok(first.data.nextCursor);
    const second = await call(host, `/notifications?limit=1&cursor=${encodeURIComponent(first.data.nextCursor)}`);
    assert.notEqual(first.data.notifications[0].id, second.data.notifications[0].id);
    assert.equal((await call(host, '/notifications?cursor=bad')).status, 400);
    assert.equal((await Activity.find({ 'notificationEvents.0': { $exists: true } })).length, 0);
    assert.equal((await call(requester, '/users/me', 'DELETE')).status, 200);
    assert.equal(await Notification.countDocuments({ recipient: requester._id }), 0);
    assert.equal(await Notification.countDocuments({ actor: requester._id }), 0);
    console.log('Notification MongoDB/HTTP integration tests passed: lifecycle, replay, privacy, ownership, unread, pagination.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
