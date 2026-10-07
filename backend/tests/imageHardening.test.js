const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sharp = require('sharp');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function run() {
  process.env.JWT_SECRET = 'image-tests-only-secret-with-32-characters';
  process.env.NODE_ENV = 'production';
  process.env.IMAGE_UPLOAD_SHORT_WINDOW_LIMIT = '100';
  const mongo = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    const User = require('../dist/models/User').default;
    const Activity = require('../dist/models/Activity').default;
    const Moment = require('../dist/models/Moment').default;
    const { setImageStorageForTests } = require('../dist/services/imageStorage');
    const { decodeImageDataUri } = require('../dist/services/imageValidation');
    const { migrateImageAssets } = require('../dist/scripts/migrate-image-assets');
    const { deleteAccount } = require('../dist/services/accountDeletion');
    await Promise.all([User, Activity, Moment].map((model) => model.init()));

    let sequence = 0;
    let failUpload = false;
    const deleted = [];
    setImageStorageForTests({
      async upload({ image, kind, ownerId, deterministicKey }) {
        if (failUpload) throw new Error('mock provider unavailable');
        const storageKey = deterministicKey || `${kind}/${ownerId}/mock-${++sequence}`;
        return { url: `https://cdn.example.test/${storageKey}.webp`, thumbnailUrl: kind === 'profile' ? `https://cdn.example.test/${storageKey}-thumb.webp` : undefined,
          storageKey, provider: 'r2', mimeType: 'image/webp', bytes: image.buffer.length, width: image.width, height: image.height };
      },
      async delete(key) { deleted.push(key); },
    });

    const app = express(); app.set('trust proxy', 1); app.use(express.json({ limit: '6mb' }));
    app.use('/api/users', require('../dist/routes/users').default);
    app.use('/api/moments', require('../dist/routes/moments').default);
    app.use('/api/activities', require('../dist/routes/activities').default);
    app.use(require('../dist/middleware/errorHandler').errorHandler);
    server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
    const call = async (user, route, method = 'GET', body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, { method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: user.id, sessionVersion: 0 }, process.env.JWT_SECRET)}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const text = await response.text();
      return { status: response.status, data: JSON.parse(text) };
    };
    const makeUser = (name) => User.create({ name, email: `${name}-${sequence++}@example.test`, password: 'test', profileCompleted: false });
    const owner = await makeUser('owner');
    const otherPng = `data:image/png;base64,${(await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ee4433' } }).png().toBuffer()).toString('base64')}`;

    const activityInput = {
      title: 'Provider backed activity picture', category: 'Food', location: 'Perth',
      description: 'A properly bounded activity image upload regression test.',
      date: new Date(Date.now() + 86400000).toISOString(), maxAttendees: 8, coverImageData: PNG,
    };
    const unauthenticated = await fetch(`http://127.0.0.1:${server.address().port}/api/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activityInput),
    });
    assert.equal(unauthenticated.status, 401);
    const activityPicture = await call(owner, '/activities', 'POST', activityInput);
    assert.equal(activityPicture.status, 201);
    assert.match(activityPicture.data.coverImage, /^https:\/\/cdn\.example\.test\/activity\//);
    assert.ok(!JSON.stringify(activityPicture.data).includes('storageKey'));
    assert.ok(!JSON.stringify(activityPicture.data).includes('base64'));
    const storedActivityPicture = await Activity.findById(activityPicture.data._id);
    assert.match(storedActivityPicture.coverImageAsset.storageKey, /^activity\//);
    assert.equal(storedActivityPicture.coverImage, undefined);
    const activityRetry = await call(owner, '/activities', 'POST', { ...activityInput, clientRequestId: 'activity-image-retry-1' });
    assert.equal(activityRetry.status, 201);
    const activityRetryAgain = await call(owner, '/activities', 'POST', { ...activityInput, clientRequestId: 'activity-image-retry-1' });
    assert.equal(activityRetryAgain.status, 200);
    assert.equal(activityRetryAgain.data._id, activityRetry.data._id);
    const activityConcurrent = await Promise.all(Array.from({ length: 2 }, () => call(owner, '/activities', 'POST',
      { ...activityInput, clientRequestId: 'activity-image-concurrent-1' })));
    assert.ok(activityConcurrent.every((result) => [200, 201].includes(result.status)));
    assert.equal(activityConcurrent[0].data._id, activityConcurrent[1].data._id);
    assert.equal((await call(owner, '/activities', 'POST', { ...activityInput, coverImageData: undefined, coverImage: 'https://attacker.test/a.jpg' })).status, 400);
    assert.equal((await call(owner, '/activities', 'POST', { ...activityInput, coverImageData: undefined, galleryImages: ['https://attacker.test/a.jpg'] })).status, 400);
    const activityCountBeforeFailure = await Activity.countDocuments();
    failUpload = true;
    assert.equal((await call(owner, '/activities', 'POST', { ...activityInput, title: 'Failed provider picture' })).status, 500);
    assert.equal(await Activity.countDocuments(), activityCountBeforeFailure);
    failUpload = false;

    const valid = await call(owner, '/users/me/profile-photo', 'PATCH', { profilePictureUrl: PNG });
    assert.equal(valid.status, 200);
    assert.match(valid.data.profilePictureUrl, /^https:\/\/cdn\.example\.test\//);
    assert.match(valid.data.profileThumbnailUrl, /^https:\/\/cdn\.example\.test\//);
    assert.ok(!JSON.stringify(valid.data).includes('base64'));
    let savedOwner = await User.findById(owner.id).select('+profilePictureUrl +profileThumbnailUrl +avatar');
    assert.ok(savedOwner.profileImage.storageKey);
    assert.equal(savedOwner.profilePictureUrl, undefined);
    assert.ok(!JSON.stringify(savedOwner.toObject()).includes('data:image'));

    for (const bad of [
      'https://attacker.test/tracker.jpg',
      'data:image/png;base64,aGVsbG8=',
      PNG.replace('image/png', 'image/jpeg'),
      'data:image/heic;base64,aGVsbG8=',
    ]) assert.equal((await call(owner, '/users/me/profile-photo', 'PATCH', { profilePictureUrl: bad })).status, 400);
    assert.throws(() => decodeImageDataUri(`data:image/png;base64,${'A'.repeat(6 * 1024 * 1024)}`, 4 * 1024 * 1024), /smaller/);

    const firstKey = savedOwner.profileImage.storageKey;
    assert.equal((await call(owner, '/users/me/profile-photo', 'PATCH', { profilePictureUrl: otherPng })).status, 200);
    assert.ok(deleted.includes(firstKey), 'replacement cleans the unreferenced prior object');
    const sharedAsset = (await User.findById(owner.id)).profileImage.toObject();
    const sharingUser = await makeUser('sharing'); sharingUser.profileImage = sharedAsset; sharingUser.profileCompleted = true; await sharingUser.save();
    assert.equal((await call(owner, '/users/me/profile-photo', 'PATCH', { profilePictureUrl: otherPng })).status, 200);
    assert.ok(!deleted.includes(sharedAsset.storageKey), 'cleanup preserves objects still referenced by another record');
    const keyBeforeFailure = (await User.findById(owner.id)).profileImage.storageKey;
    failUpload = true;
    assert.equal((await call(owner, '/users/me/profile-photo', 'PATCH', { profilePictureUrl: PNG })).status, 500);
    assert.equal((await User.findById(owner.id)).profileImage.storageKey, keyBeforeFailure, 'provider failure leaves MongoDB unchanged');
    failUpload = false;

    const activity = await Activity.create({ title: 'Past plan', description: 'Done', location: 'Perth', category: 'Outdoors', host: owner._id,
      participants: [owner._id], maxAttendees: 3, date: new Date(Date.now() - 86400000), status: 'completed' });
    assert.equal((await call(owner, '/moments', 'POST', { activityId: activity.id, images: [PNG, PNG, PNG, PNG] })).status, 400);
    const created = await call(owner, '/moments', 'POST', { activityId: activity.id, images: [PNG], caption: 'memory', clientRequestId: 'image-test-draft-1' });
    assert.equal(created.status, 201);
    assert.match(created.data.images[0], /^https:\/\/cdn\.example\.test\//);
    assert.ok(!JSON.stringify(created.data).includes('base64'));
    const retry = await call(owner, '/moments', 'POST', { activityId: activity.id, images: [PNG], caption: 'memory', clientRequestId: 'image-test-draft-1' });
    assert.equal(retry.status, 200);
    assert.equal(retry.data.id, created.data.id);
    assert.equal(await Moment.countDocuments({ clientRequestId: 'image-test-draft-1' }), 1);
    const concurrent = await Promise.all(Array.from({ length: 2 }, () => call(owner, '/moments', 'POST',
      { activityId: activity.id, images: [PNG], caption: 'concurrent', clientRequestId: 'image-test-concurrent-1' })));
    assert.ok(concurrent.every((result) => [200, 201].includes(result.status)));
    assert.equal(concurrent[0].data.id, concurrent[1].data.id);
    assert.equal(await Moment.countDocuments({ clientRequestId: 'image-test-concurrent-1' }), 1);
    const other = await makeUser('other');
    assert.equal((await call(other, `/moments/${created.data.id}`, 'DELETE')).status, 403);
    const momentKey = (await Moment.findById(created.data.id)).imageAssets[0].storageKey;
    assert.equal((await call(owner, `/moments/${created.data.id}`, 'DELETE')).status, 200);
    assert.ok(deleted.includes(momentKey));

    const legacyUser = await User.create({ name: 'Legacy', email: 'legacy@example.test', password: 'test', profilePictureUrl: PNG });
    const legacyMoment = await Moment.create({ creator: legacyUser._id, activity: activity._id, images: [PNG] });
    const migrated = await migrateImageAssets();
    assert.deepEqual(migrated, { usersMigrated: 1, momentsMigrated: 1 });
    assert.deepEqual(await migrateImageAssets(), { usersMigrated: 0, momentsMigrated: 0 });
    assert.ok((await User.findById(legacyUser.id)).profileImage);
    assert.equal((await Moment.findById(legacyMoment.id)).imageAssets.length, 1);

    const deletionUser = await makeUser('delete');
    deletionUser.profileImage = { url: 'https://cdn.example.test/delete.webp', storageKey: 'profiles/delete-key', provider: 'r2', mimeType: 'image/webp', bytes: 10, width: 10, height: 10 };
    deletionUser.profileCompleted = true;
    await deletionUser.save();
    await Moment.create({ creator: deletionUser._id, activity: activity._id, imageAssets: [{ url: 'https://cdn.example.test/delete-moment.webp', storageKey: 'moments/delete-key', provider: 'r2', mimeType: 'image/webp', bytes: 10, width: 10, height: 10 }] });
    await deleteAccount(deletionUser.id);
    assert.ok(deleted.includes('profiles/delete-key'));
    assert.ok(deleted.includes('moments/delete-key'));

    console.log('Image hardening regression tests passed.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    const { setImageStorageForTests } = require('../dist/services/imageStorage'); setImageStorageForTests();
    await mongoose.disconnect(); await mongo.stop();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
