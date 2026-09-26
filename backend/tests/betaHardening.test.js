const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../dist/models/User').default;
const Activity = require('../dist/models/Activity').default;
const Chat = require('../dist/models/Chat').default;
const Moment = require('../dist/models/Moment').default;
const Comment = require('../dist/models/MomentComment').default;
const Report = require('../dist/models/UserReport').default;
const Notification = require('../dist/models/Notification').default;
const Device = require('../dist/models/PushDevice').default;
const Delivery = require('../dist/models/PushDelivery').default;
const { promoteActivityWaitlist } = require('../dist/services/activityMembership');
const { drainNotificationEvents, persistNotificationEvent } = require('../dist/services/notifications');

async function run() {
  process.env.JWT_SECRET = 'hardening-tests-only-not-a-production-secret';
  process.env.NODE_ENV = 'production';
  const mongo = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    await Promise.all([User, Activity, Chat, Moment, Comment, Report, Notification, Device, Delivery].map((model) => model.init()));
    const app = express(); app.set('trust proxy', 1); app.use(express.json());
    for (const name of ['auth', 'users', 'activities', 'chats', 'moments', 'reports', 'notifications']) app.use(`/api/${name}`, require(`../dist/routes/${name}`).default);
    app.use(require('../dist/middleware/errorHandler').errorHandler);
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    let sequence = 0;
    const call = async (user, route, method = 'GET', body, ip) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
        method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip || `10.1.${Math.floor(++sequence / 250)}.${sequence % 250 + 1}`,
          ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user.id }, process.env.JWT_SECRET)}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
      });
      const text = await response.text();
      return { status: response.status, data: text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : text };
    };
    let serial = 0;
    const user = (name) => User.create({ name, email: `hardening-${++serial}@example.test`, password: 'test-only',
      profileCompleted: true, profilePictureUrl: `https://example.test/${name}.jpg` });
    const [host, a, b, c] = await Promise.all(['host', 'a', 'b', 'c'].map(user));
    const activity = (extra = {}) => Activity.create({ title: 'Test plan', description: 'Plan description', location: 'Perth', category: 'Outdoors',
      host: host._id, participants: [host._id], maxAttendees: 4, date: new Date(Date.now() + 86400000), ...extra });
    const group = await activity({ participants: [host._id, a._id, b._id] });
    const direct = await call(a, `/chats/direct/${b.id}`, 'POST', {});
    assert.equal(direct.status, 200);
    assert.equal((await call(b, `/chats/${direct.data.chatId}/message`, 'POST', { message: 'PRIVATE_PREVIEW' })).status, 200);
    const past = await activity({ participants: [host._id, a._id, b._id], status: 'completed', date: new Date(Date.now() - 86400000) });
    const moment = await Moment.create({ activity: past._id, creator: b._id, images: ['https://example.test/m.jpg'] });
    const thirdMoment = await Moment.create({ activity: past._id, creator: c._id, images: ['https://example.test/c.jpg'] });
    await Comment.create({ moment: thirdMoment._id, author: b._id, text: 'BLOCKED_COMMENT' });
    assert.equal((await call(a, `/users/${b.id}/block`, 'POST', {})).status, 200);
    for (const [viewer, target] of [[a, b], [b, a]]) {
      assert.equal((await call(viewer, `/chats/direct/${target.id}`, 'POST', {})).status, 403);
      assert.equal((await call(viewer, `/chats/${direct.data.chatId}`)).status, 403);
      assert.equal((await call(viewer, `/chats/${direct.data.chatId}/message`, 'POST', { message: 'Denied' })).status, 403);
      assert.equal((await call(viewer, `/users/${target.id}`)).status, 403);
      assert.equal((await call(viewer, `/moments/user/${target.id}`)).status, 403);
      for (const scope of ['', '?scope=requests']) {
        const list = await call(viewer, `/chats${scope}`);
        assert.equal(list.status, 200);
        assert.ok(!JSON.stringify(list.data).includes('PRIVATE_PREVIEW'));
        assert.ok(!list.data.conversations.some((item) => item.id === direct.data.chatId));
        if (!scope) assert.equal(list.data.unreadConversationCount, list.data.conversations.filter((item) => item.unread).length);
        assert.equal(list.data.unreadRequestCount, 0);
      }
      assert.equal((await call(viewer, `/chats/${group.id}`)).status, 200);
      assert.equal((await call(viewer, `/chats/${group.id}/message`, 'POST', { message: 'Group remains usable' })).status, 200);
    }
    assert.equal((await call(a, `/moments/${moment.id}/like`, 'POST', {})).status, 404);
    assert.equal((await call(a, `/moments/${moment.id}/like`, 'DELETE')).status, 404);
    assert.equal((await call(a, `/moments/${moment.id}/comments`, 'POST', { text: 'Denied' })).status, 404);
    assert.equal((await call(a, `/moments/${moment.id}/comments`)).status, 404);
    assert.ok(!(await call(a, `/moments/activity/${past.id}`)).data.some((item) => item.id === moment.id));
    assert.equal((await call(a, `/moments/${thirdMoment.id}/comments`)).data.comments.length, 0);
    const blockedPlan = await activity({ host: b._id, participants: [b._id], waitlist: [a._id] });
    assert.equal((await call(a, `/activities/${blockedPlan.id}/join`, 'POST', {})).status, 403);
    assert.deepEqual((await promoteActivityWaitlist(blockedPlan.id)).promotedUserIds, []);
    await Activity.updateOne({ _id: blockedPlan._id }, { $addToSet: { pendingParticipants: a._id } });
    assert.equal((await call(b, `/activities/${blockedPlan.id}/approve/${a.id}`, 'POST', {})).status, 403);
    const blocked = await call(a, '/users/me/blocked-users');
    assert.deepEqual(blocked.data.map((person) => person.id), [b.id]);
    assert.equal(blocked.data[0].email, undefined);
    assert.equal((await call(null, '/users/me/blocked-users')).status, 401);
    assert.equal((await call(a, `/users/${b.id}/unblock`, 'POST', {})).status, 200);
    assert.equal((await call(a, '/users/me/blocked-users')).data.length, 0);
    assert.equal((await call(a, `/chats/${direct.data.chatId}`)).status, 200);
    console.log('PASS blocking: reciprocal social/direct restrictions, group chat, hidden previews/counts, unblock');

    const report = (reporter, type, id, extra = {}) => call(reporter, '/reports', 'POST', { targetType: type, targetId: id, reason: 'Harassment', ...extra });
    const comment = await Comment.create({ moment: moment._id, author: b._id, text: 'Reportable comment' });
    assert.equal((await report(a, 'user', a.id)).status, 400);
    assert.equal((await report(null, 'user', b.id)).status, 401);
    assert.equal((await report(a, 'user', 'invalid')).status, 404);
    assert.equal((await report(a, 'user', new mongoose.Types.ObjectId().toString())).status, 404);
    assert.equal((await report(a, 'user', b.id, { reason: {} })).status, 400);
    assert.equal((await report(a, 'user', b.id, { reason: '' })).status, 400);
    assert.equal((await report(a, 'user', b.id, { detail: 'x'.repeat(1001) })).status, 400);
    const inaccessible = await activity({ visibility: 'private' });
    assert.equal((await report(a, 'activity', inaccessible.id)).status, 404);
    for (const [type, target] of [['user', b], ['activity', group], ['moment', moment], ['comment', comment]]) {
      const result = await report(a, type, target.id, { detail: 'PRIVATE_REPORT_DETAIL' });
      assert.equal(result.status, 201, type);
      assert.deepEqual(Object.keys(result.data), ['message']);
    }
    await Promise.all(Array.from({ length: 5 }, () => report(a, 'moment', moment.id)));
    assert.equal(await Report.countDocuments({ reporter: a._id, targetType: 'moment', targetId: moment._id }), 1);
    assert.equal((await call(a, `/users/${b.id}/report`, 'POST', { reason: 'Spam' })).status, 200);
    for (const route of [`/users/${b.id}`, `/activities/${group.id}`, `/moments/user/${b.id}`, `/moments/${moment.id}/comments`]) {
      const response = await call(b, route);
      assert.ok(!JSON.stringify(response.data).includes('PRIVATE_REPORT_DETAIL'));
      assert.ok(!JSON.stringify(response.data).includes('reporter'));
    }
    assert.equal((await call(b, '/reports')).status, 404);
    for (let attempt = 0; attempt < 10; attempt++) await call(c, '/reports', 'POST', { targetType: 'user', targetId: b.id, reason: 'Spam' }, '10.9.9.9');
    assert.equal((await call(c, '/reports', 'POST', { targetType: 'user', targetId: b.id, reason: 'Spam' }, '10.9.9.9')).status, 429);
    console.log('PASS reports: all target types, self/invalid/private rejection, dedup/rate limit, private metadata');

    const doomed = await user('doomed');
    const waiting = await user('waiting');
    const joined = await activity({ participants: [host._id, doomed._id], maxAttendees: 2, status: 'full', waitlist: [waiting._id] });
    const pastJoined = await activity({ participants: [host._id, doomed._id], status: 'full', date: new Date(Date.now() - 86400000) });
    const queued = await activity({ pendingParticipants: [doomed._id], waitlist: [doomed._id], invitedUsers: [doomed._id], declinedParticipants: [doomed._id] });
    const upcoming = await activity({ host: doomed._id, participants: [doomed._id, a._id] });
    const historical = await activity({ host: doomed._id, participants: [doomed._id, a._id], status: 'completed', date: new Date(Date.now() - 86400000) });
    const ownMoment = await Moment.create({ activity: historical._id, creator: doomed._id, images: ['https://example.test/d.jpg'] });
    await Comment.create({ moment: ownMoment._id, author: a._id, text: 'Child comment' });
    await Comment.create({ moment: thirdMoment._id, author: doomed._id, text: 'Authored comment' });
    await Moment.updateOne({ _id: thirdMoment._id }, { $set: { commentCount: 2 }, $addToSet: { likes: doomed._id } });
    const directDoomed = await Chat.create({ chatType: 'directPrivateChat', directKey: `${a.id}:${doomed.id}`, members: [a._id, doomed._id],
      initiatedBy: doomed._id, requestRecipient: a._id, directState: 'request', messages: [{ author: doomed._id, message: 'Deleted content' }] });
    await Chat.create({ activity: historical._id, members: [doomed._id, a._id], readStates: [{ user: doomed._id, lastReadAt: new Date() }],
      messages: [{ author: doomed._id, message: 'Deleted content' }, { author: a._id, message: 'Keep this' }] });
    await User.updateOne({ _id: a._id }, { $addToSet: { blockedUsers: doomed._id } });
    await User.updateOne({ _id: doomed._id }, { $set: { savedActivities: [group._id], bio: 'PERSONAL_DATA', passwordResetTokenHash: 'SECRET' } });
    const notification = await Notification.create({ recipient: doomed._id, actor: b._id, type: 'join_approved', activity: group._id,
      title: 'Test', body: 'Test', idempotencyKey: 'deletion-test' });
    await Notification.create({ recipient: a._id, actor: doomed._id, type: 'join_approved', activity: group._id,
      title: 'Test', body: 'Test', idempotencyKey: 'deleted-actor' });
    await Device.create({ _id: 'doomed-device', user: doomed._id, expoPushToken: 'ExponentPushToken[test]', platform: 'ios', projectId: 'test', registrationId: 'test', lastSeenAt: new Date() });
    await Delivery.create({ user: doomed._id, notification: notification._id, device: 'doomed-device', registrationId: 'test' });
    await Report.create({ reporter: doomed._id, reportedUser: a._id, reason: 'Spam' });
    // Inject failure after membership and comment cleanup, then a later failure.
    const originalMomentDelete = Moment.deleteMany;
    try {
      Moment.deleteMany = async () => { throw new Error('Simulated cleanup failure'); };
      assert.equal((await call(doomed, '/users/me', 'DELETE')).status, 500);
    } finally { Moment.deleteMany = originalMomentDelete; }
    assert.ok((await User.findById(doomed.id)).deletionStartedAt);
    assert.equal((await User.findById(doomed.id)).deletedAt, undefined);
    assert.equal((await call(doomed, '/users/me')).status, 401);
    assert.equal((await call(a, `/users/${doomed.id}`)).status, 403);
    const originalNotificationDelete = Notification.deleteMany;
    try {
      Notification.deleteMany = async () => { throw new Error('Later cleanup failure'); };
      assert.equal((await call(doomed, '/users/me', 'DELETE')).status, 500);
    } finally { Notification.deleteMany = originalNotificationDelete; }
    assert.equal((await call(doomed, '/users/me', 'DELETE')).status, 200);
    assert.equal((await call(doomed, '/users/me', 'DELETE')).status, 200);
    const tombstone = await User.collection.findOne({ _id: doomed._id });
    assert.ok(tombstone.deletedAt);
    assert.equal(tombstone.name, 'Former JOIN member');
    for (const field of ['bio', 'avatar', 'profilePictureUrl', 'passwordResetTokenHash', 'savedActivities', 'deletionActivityIds', 'deletionMomentIds']) assert.equal(tombstone[field], undefined);
    assert.notEqual(tombstone.email, doomed.email);
    const joinedAfter = await Activity.findById(joined.id);
    assert.deepEqual(joinedAfter.participants.map(String), [host.id, waiting.id]);
    assert.equal(joinedAfter.status, 'full');
    assert.equal((await Activity.findById(pastJoined.id)).status, 'completed');
    const queueAfter = await Activity.findById(queued.id);
    for (const field of ['pendingParticipants', 'waitlist', 'invitedUsers', 'declinedParticipants']) assert.equal(queueAfter[field].length, 0);
    assert.equal((await Activity.findById(upcoming.id)).status, 'cancelled');
    assert.equal((await Chat.findOne({ activity: upcoming._id })).activityReadOnly, true);
    assert.equal((await Activity.findById(historical.id)).status, 'completed');
    assert.equal((await call(a, `/activities/${historical.id}`)).data.host.name, 'Former JOIN member');
    assert.equal(await Moment.countDocuments({ creator: doomed._id }), 0);
    assert.equal(await Comment.countDocuments({ $or: [{ author: doomed._id }, { moment: ownMoment._id }] }), 0);
    assert.equal((await Moment.findById(thirdMoment.id)).commentCount, 1);
    assert.equal(await Moment.countDocuments({ likes: doomed._id }), 0);
    assert.equal(await Chat.findById(directDoomed.id), null);
    assert.equal((await call(a, '/chats')).status, 200);
    assert.equal((await call(a, `/chats/${historical.id}`)).status, 200);
    assert.equal(await Chat.countDocuments({ $or: [{ members: doomed._id }, { 'readStates.user': doomed._id }, { 'messages.author': doomed._id }] }), 0);
    for (const model of [Device, Delivery]) assert.equal(await model.countDocuments({ user: doomed._id }), 0);
    assert.equal(await Notification.countDocuments({ recipient: doomed._id }), 0);
    assert.equal(await Notification.countDocuments({ actor: doomed._id }), 0);
    assert.equal(await Report.countDocuments({ reporter: doomed._id }), 0);
    assert.equal(await User.countDocuments({ blockedUsers: doomed._id }), 0);
    await drainNotificationEvents();
    assert.equal(await Notification.countDocuments({ recipient: a._id, activity: upcoming._id, type: 'activity_cancelled' }), 1);
    await persistNotificationEvent(group.id, { _id: new mongoose.Types.ObjectId(), type: 'join_approved', recipients: [doomed._id], createdAt: new Date() });
    assert.equal(await Notification.countDocuments({ recipient: doomed._id }), 0);
    const lostSession = await user('lost-session');
    await User.updateOne({ _id: lostSession._id }, { $set: {
      deletionStartedAt: new Date(), password: await require('bcryptjs').hash('RetryPassword1', 4),
    } });
    const resumed = await call(null, '/auth/login', 'POST', { email: lostSession.email, password: 'RetryPassword1' });
    assert.equal(resumed.status, 401);
    assert.equal(resumed.data.code, 'ACCOUNT_DELETED');
    assert.ok((await User.findById(lostSession.id)).deletedAt);
    console.log('PASS deletion: lifecycle/history, capacity/promotion, reference cleanup, push, two partial failures and repeat completion');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
