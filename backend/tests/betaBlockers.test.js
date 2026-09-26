// Real, isolated MongoDB + HTTP regressions; never connects to application data.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../dist/models/User').default;
const Activity = require('../dist/models/Activity').default;
const { promoteActivityWaitlist, confirmDirectJoin, approvePendingJoin } = require('../dist/services/activityMembership');
const { errorHandler } = require('../dist/middleware/errorHandler');
const { asyncHandler } = require('../dist/middleware/asyncHandler');

async function run() {
  process.env.JWT_SECRET = 'beta-blocker-tests-only-secret-not-for-production';
  process.env.NODE_ENV = 'production';
  const mongo = await MongoMemoryServer.create();
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    await Promise.all([User.init(), Activity.init()]);
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json({ limit: '6mb' }));
    for (const router of ['auth', 'activities', 'users', 'moments', 'chats']) {
      app.use(`/api/${router}`, require(`../dist/routes/${router}`).default);
      // Guard against accidentally introducing another bare Express 4 async route.
      const file = path.join(__dirname, `../src/routes/${router}.ts`);
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && node.expression.expression.getText(source) === 'router') {
          for (const argument of node.arguments) {
            assert.ok(!((ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
              && argument.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)), `${router}: unwrapped async route`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    app.get('/unexpected', asyncHandler(async () => { throw new Error('INTERNAL_SECRET_STACK'); }));
    app.get('/synchronous', asyncHandler(() => { throw new Error('INTERNAL_SECRET_STACK'); }));
    app.get('/empty-rejection', asyncHandler(() => Promise.reject()));
    app.use(errorHandler);
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    let requestNumber = 0;
    const call = async (route, { token, method = 'GET', body, raw } = {}) => {
      const response = await fetch(`${base}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.${Math.floor(++requestNumber / 250)}.${requestNumber % 250 + 1}`,
          ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(raw !== undefined ? { body: raw } : body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10000),
      });
      return { status: response.status, data: await response.json() };
    };
    const post = (route, body, token) => call(route, { method: 'POST', body, token });
    const tokenFor = (user, version) => jwt.sign({ userId: user.id, ...(version === undefined ? {} : { sessionVersion: version }) }, process.env.JWT_SECRET);
    const password = await bcrypt.hash('OldPassword1', 4);
    const makeUser = (name) => User.create({ name, email: `${name}@example.test`, password,
      profilePictureUrl: `https://example.test/${name}.jpg`, profileCompleted: true });
    const [host, member, candidate, next, pending, removed] = await Promise.all(
      ['host', 'member', 'candidate', 'next', 'pending', 'removed'].map(makeUser));
    const activity = (extra = {}) => Activity.create({ title: 'Private plan', description: 'Plan description',
      category: 'Outdoors', location: 'Secret address', locationName: 'Secret venue', exactAddress: 'Secret address',
      latitude: -31.95, longitude: 115.86, locationPrivacy: 'public',
      host: host._id, participants: [host._id, member._id], maxAttendees: 3,
      date: new Date(Date.now() + 86400000), visibility: 'public', joinApproval: 'auto', ...extra });

    // Invalid string fields, absent bodies, and invalid JSON must terminate safely.
    for (const value of [{ invalid: 'type' }, ['OldPassword1'], 123, null]) {
      assert.equal((await post('/api/auth/login', { email: host.email, password: value })).status, 400);
      assert.equal((await post('/api/auth/register', { name: 'Test', email: 'new@example.test', password: value })).status, 400);
      assert.equal((await post('/api/auth/reset-password', { token: value, password: 'NewPassword2' })).status, 400);
    }
    assert.equal((await post('/api/auth/login', { email: { $ne: null }, password: 'OldPassword1' })).status, 400);
    assert.equal((await post('/api/auth/login', {})).status, 400);
    assert.equal((await call('/api/auth/login', { method: 'POST', raw: '{bad json' })).status, 400);
    assert.equal((await post('/api/activities', { title: {}, location: {}, description: {} }, tokenFor(host))).status, 400);
    for (const route of ['/unexpected', '/synchronous', '/empty-rejection']) {
      const result = await call(route);
      assert.equal(result.status, 500);
      assert.deepEqual(result.data, { message: 'Something went wrong. Please try again.' });
    }
    // Actual router rejection and authentication storage failures use the same handler.
    const originalFindOne = User.findOne;
    try {
      User.findOne = () => ({ select: async () => { throw new Error('INTERNAL_SECRET_STACK'); } });
      assert.deepEqual(await post('/api/auth/login', { email: host.email, password: 'OldPassword1' }),
        { status: 500, data: { message: 'Something went wrong. Please try again.' } });
    } finally { User.findOne = originalFindOne; }
    const originalFindById = User.findById;
    try {
      User.findById = () => ({ select: () => ({ lean: async () => { throw new Error('INTERNAL_SECRET_STACK'); } }) });
      assert.deepEqual(await call('/api/users/me', { token: tokenFor(host) }),
        { status: 500, data: { message: 'Something went wrong. Please try again.' } });
    } finally { User.findById = originalFindById; }
    console.log('PASS async handlers: malformed types/JSON, route coverage, safe 500 responses');

    const privateActivity = await activity({ visibility: 'private', joinApproval: 'manual',
      pendingParticipants: [pending._id], inviteCode: 'retained-valid-code' });
    const detail = `/api/activities/${privateActivity.id}`;
    const assertPreview = (result) => {
      assert.equal(result.status, 200);
      assert.equal(result.data.title, privateActivity.title);
      assert.equal(result.data.participantCount, 2);
      assert.deepEqual(result.data.participants, []);
      for (const field of ['host', 'latitude', 'longitude', 'coordinates', 'exactAddress', 'locationName', 'venueName', 'pendingParticipants', 'waitlist']) {
        assert.equal(result.data[field], undefined, `Preview leaked ${field}`);
      }
      assert.equal(result.data.location, 'Location shared after approval');
      const serialized = JSON.stringify(result.data);
      for (const person of [host, member]) {
        assert.ok(!serialized.includes(person.id));
        assert.ok(!serialized.includes(person.profilePictureUrl));
        assert.ok(!serialized.includes(`"name":"${person.name}"`));
      }
    };
    assertPreview(await call(`${detail}?inviteCode=retained-valid-code`));
    const pendingPreview = await call(detail, { token: tokenFor(pending) });
    assertPreview(pendingPreview);
    assert.equal(pendingPreview.data.viewerJoinStatus, 'pending');
    // Model a real removal before reusing the retained invite.
    await Activity.updateOne({ _id: privateActivity._id }, { $addToSet: { participants: removed._id } });
    await Activity.updateOne({ _id: privateActivity._id }, { $pull: { participants: removed._id } });
    assertPreview(await call(`${detail}?inviteCode=retained-valid-code`, { token: tokenFor(removed) }));
    const full = await call(detail, { token: tokenFor(member) });
    assert.equal(full.status, 200);
    assert.equal(full.data.participants.length, 2);
    assert.equal(full.data.exactAddress, privateActivity.exactAddress);
    assert.equal(full.data.latitude, privateActivity.latitude);
    assert.equal(full.data.host.id, host.id);
    assert.equal((await call(detail)).status, 403);
    assert.equal((await call(`${detail}?inviteCode[bad]=type`)).status, 403);
    console.log('PASS private preview: anonymous, pending, confirmed, removed retained-invite');

    for (const [blocker, blocked] of [[host, candidate], [candidate, host], [member, candidate], [candidate, member]]) {
      await User.updateOne({ _id: blocker._id }, { $addToSet: { blockedUsers: blocked._id } });
      const a = await activity({ visibility: 'private', joinApproval: 'manual', waitlist: [candidate._id] });
      await promoteActivityWaitlist(a.id);
      const fresh = await Activity.findById(a.id);
      assert.ok(!fresh.participants.some((id) => id.equals(candidate._id)));
      assert.equal(fresh.pendingParticipants.length, 0);
      assert.equal(fresh.waitlist.length, 0);
      const auto = await activity({ waitlist: [candidate._id, next._id] });
      assert.deepEqual((await promoteActivityWaitlist(auto.id)).promotedUserIds, [next.id]);
      await User.updateOne({ _id: blocker._id }, { $pull: { blockedUsers: blocked._id } });
    }
    for (const policy of [{ visibility: 'private', joinApproval: 'auto' }, { visibility: 'public', joinApproval: 'manual' }]) {
      const a = await activity({ ...policy, waitlist: [candidate._id] });
      const result = await promoteActivityWaitlist(a.id);
      assert.deepEqual(result.promotedUserIds, []);
      assert.equal(result.activity.participants.length, 2);
      assert.deepEqual(result.activity.pendingParticipants.map(String), [candidate.id]);
      assert.equal(result.activity.waitlist.length, 0);
      // Blocking after transfer to pending must also prevent explicit approval.
      await User.updateOne({ _id: host._id }, { $addToSet: { blockedUsers: candidate._id } });
      assert.equal((await post(`/api/activities/${a.id}/approve/${candidate.id}`, {}, tokenFor(host))).status, 403);
      await User.updateOne({ _id: host._id }, { $pull: { blockedUsers: candidate._id } });
      assert.equal((await post(`/api/activities/${a.id}/approve/${candidate.id}`, {}, tokenFor(host))).status, 200);
      assert.equal((await Activity.findById(a.id)).participants.length, 3);
    }
    const normal = await activity({ waitlist: [candidate._id, next._id] });
    const normalResult = await promoteActivityWaitlist(normal.id);
    assert.deepEqual(normalResult.promotedUserIds, [candidate.id]);
    assert.equal(normalResult.activity.participants.length, 3);
    assert.deepEqual(normalResult.activity.waitlist.map(String), [next.id]);
    const legacy = await activity({ waitlist: [candidate._id] });
    await Activity.collection.updateOne({ _id: legacy._id }, { $unset: { visibility: '', joinApproval: '' } });
    assert.deepEqual((await promoteActivityWaitlist(legacy.id)).promotedUserIds, [candidate.id]);
    await User.updateOne({ _id: candidate._id }, { $unset: { profilePictureUrl: 1 } });
    const incomplete = await activity({ waitlist: [candidate._id, next._id] });
    assert.deepEqual((await promoteActivityWaitlist(incomplete.id)).promotedUserIds, [next.id]);
    await User.updateOne({ _id: candidate._id }, { $set: { profilePictureUrl: candidate.profilePictureUrl } });
    for (const extra of [{ status: 'cancelled' }, { status: 'completed' }, { date: new Date(Date.now() - 1000) }, { maxAttendees: 2 }]) {
      const a = await activity({ ...extra, waitlist: [candidate._id] });
      assert.deepEqual((await promoteActivityWaitlist(a.id)).promotedUserIds, []);
      assert.equal((await Activity.findById(a.id)).participants.length, 2);
    }
    const stale = await activity({ pendingParticipants: [candidate._id], waitlist: [candidate._id, next._id] });
    assert.deepEqual((await promoteActivityWaitlist(stale.id)).promotedUserIds, [next.id]);
    const race = await activity({ waitlist: [candidate._id, next._id], pendingParticipants: [pending._id] });
    await Promise.all([promoteActivityWaitlist(race.id), promoteActivityWaitlist(race.id),
      confirmDirectJoin(race.id, removed.id, {}), approvePendingJoin(race.id, pending.id, host.id)]);
    const raced = await Activity.findById(race.id);
    assert.equal(raced.participants.length, 3);
    assert.equal(new Set(raced.participants.map(String)).size, 3);
    // Change eligibility while its user lookup is in flight: the final conditional
    // membership write must still enforce lifecycle, capacity, state, and policy.
    for (const change of [{ status: 'cancelled' }, { maxAttendees: 2 },
      { pendingParticipants: [candidate._id] }, { joinApproval: 'manual' },
      { participants: [host._id, next._id] }]) {
      const a = await activity({ waitlist: [candidate._id] });
      const originalFind = User.find;
      try {
        User.find = (...args) => ({ select: async (...fields) => {
          const users = await originalFind.apply(User, args).select(...fields);
          await Activity.updateOne({ _id: a._id }, { $set: change });
          return users;
        } });
        assert.deepEqual((await promoteActivityWaitlist(a.id)).promotedUserIds, []);
        assert.ok(!(await Activity.findById(a.id)).participants.some((id) => id.equals(candidate._id)));
      } finally { User.find = originalFind; }
    }
    console.log('PASS promotion: bidirectional blocks, host approval, FIFO, lifecycle, state, concurrent capacity');

    const login = await post('/api/auth/login', { email: member.email, password: 'OldPassword1' });
    assert.equal(login.status, 200);
    assert.equal((await call('/api/users/me', { token: login.data.token })).status, 200);
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    await User.updateOne({ _id: member._id }, { $set: { passwordResetTokenHash: tokenHash, passwordResetExpires: new Date(Date.now() + 60000) } });
    const resets = await Promise.all([post('/api/auth/reset-password', { token: resetToken, password: 'NewPassword2' }),
      post('/api/auth/reset-password', { token: resetToken, password: 'NewPassword2' })]);
    assert.deepEqual(resets.map((r) => r.status).sort(), [200, 400]);
    assert.equal((await User.findById(member.id).select('+sessionVersion')).sessionVersion, 1);
    assert.equal((await call('/api/users/me', { token: login.data.token })).status, 401);
    assert.equal((await call('/api/users/me', { token: tokenFor(member) })).status, 401);
    assert.equal((await call(detail, { token: login.data.token })).status, 403);
    assertPreview(await call(`${detail}?inviteCode=retained-valid-code`, { token: login.data.token }));
    assert.equal((await post('/api/auth/login', { email: member.email, password: 'OldPassword1' })).status, 401);
    const newLogin = await post('/api/auth/login', { email: member.email, password: 'NewPassword2' });
    assert.equal(newLogin.status, 200);
    assert.equal((await call('/api/users/me', { token: newLogin.data.token })).status, 200);
    assert.equal((await call(detail, { token: newLogin.data.token })).data.participants.length, 2);
    assert.equal((await post('/api/auth/reset-password', { token: resetToken, password: 'AgainPassword3' })).status, 400);
    assert.equal((await post('/api/auth/reset-password', { token: 'invalid-token', password: 'AgainPassword3' })).status, 400);
    await User.updateOne({ _id: member._id }, { $set: { passwordResetTokenHash: tokenHash, passwordResetExpires: new Date(Date.now() - 1000) } });
    const expired = await post('/api/auth/reset-password', { token: resetToken, password: 'AgainPassword3' });
    assert.equal(expired.status, 400);
    assert.match(expired.data.message, /expired/);
    assert.equal((await call('/api/users/me', { token: newLogin.data.token })).status, 200);
    const deleted = await makeUser('deleted-session-test');
    const deletedToken = tokenFor(deleted);
    await User.deleteOne({ _id: deleted._id });
    assert.equal((await call('/api/users/me', { token: deletedToken })).status, 401);
    assert.equal((await call('/api/users/me')).status, 401); // Client logout: no token.
    console.log('PASS reset: old/legacy JWT revoked, new login, atomic one-use, invalid/expired, deleted users');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
    process.removeListener('unhandledRejection', onUnhandled);
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
