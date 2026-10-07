const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function run() {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri());
    const User = require('../dist/models/User').default;
    const Counter = require('../dist/models/ImageUploadCounter').default;
    const Guard = require('../dist/models/ImageUploadGuard').default;
    const { checkImageUploadRequest, reserveImageUpload } = require('../dist/services/imageUploadLimits');
    await Promise.all([User, Counter, Guard].map((model) => model.init()));
    const users = await Promise.all(Array.from({ length: 4 }, (_, index) => User.create({
      name: `Quota ${index}`, email: `quota-${index}@example.test`, password: 'test',
    })));
    const at = new Date('2026-10-07T10:00:00Z');

    process.env.IMAGE_UPLOADS_ENABLED = 'false';
    await assert.rejects(checkImageUploadRequest(users[0].id, '192.0.2.1', at), { status: 503 });
    await assert.rejects(reserveImageUpload(users[0].id, 1, 100, false, at), { status: 503 });
    process.env.IMAGE_UPLOADS_ENABLED = 'true';

    process.env.IMAGE_UPLOAD_SHORT_WINDOW_LIMIT = '2';
    process.env.IMAGE_UPLOAD_IP_LIMIT = '3';
    const sameUser = await Promise.allSettled(Array.from({ length: 4 }, () => checkImageUploadRequest(users[0].id, '192.0.2.2', at)));
    assert.equal(sameUser.filter((result) => result.status === 'fulfilled').length, 2);
    const sameIp = await Promise.allSettled(users.slice(1).map((user) => checkImageUploadRequest(user.id, '192.0.2.2', at)));
    assert.equal(sameIp.filter((result) => result.status === 'fulfilled').length, 1);

    process.env.IMAGE_UPLOAD_DAILY_USER_LIMIT = '2';
    process.env.GLOBAL_DAILY_IMAGE_UPLOAD_LIMIT = '3';
    process.env.GLOBAL_DAILY_IMAGE_UPLOAD_BYTES = '300';
    process.env.IMAGE_ASSET_MAX_PER_USER = '2';
    const first = await reserveImageUpload(users[0].id, 2, 200, false, at);
    await assert.rejects(reserveImageUpload(users[0].id, 1, 1, false, at), { status: 429 });
    await first();
    await assert.rejects(reserveImageUpload(users[0].id, 1, 1, false, at), { status: 429 });
    const second = await reserveImageUpload(users[1].id, 1, 100, false, at);
    await second();
    await assert.rejects(reserveImageUpload(users[2].id, 1, 1, false, at), { status: 503 });

    await Counter.deleteMany({});
    process.env.IMAGE_UPLOAD_DAILY_USER_LIMIT = '20';
    process.env.GLOBAL_DAILY_IMAGE_UPLOAD_LIMIT = '1000';
    process.env.GLOBAL_DAILY_IMAGE_UPLOAD_BYTES = '1000000000';
    process.env.IMAGE_ASSET_MAX_PER_USER = '1';
    const sameAccount = await Promise.allSettled([reserveImageUpload(users[2].id, 1, 10, false, at), reserveImageUpload(users[2].id, 1, 10, false, at)]);
    assert.equal(sameAccount.filter((result) => result.status === 'fulfilled').length, 1);
    await sameAccount.find((result) => result.status === 'fulfilled').value();
    users[3].profileImage = { url: 'https://images.example.test/a.webp', storageKey: 'profiles/a', provider: 'r2', mimeType: 'image/webp', bytes: 10, width: 1, height: 1 };
    await users[3].save();
    await assert.rejects(reserveImageUpload(users[3].id, 1, 10, false, at), { status: 429 });
    const replacement = await reserveImageUpload(users[3].id, 1, 10, true, at);
    await replacement();
    console.log('Image upload quota tests passed.');
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
