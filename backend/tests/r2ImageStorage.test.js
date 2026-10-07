const assert = require('node:assert/strict');
const sharp = require('sharp');

async function run() {
  const { decodeImageDataUri } = require('../dist/services/imageValidation');
  const { R2ImageStorage, IMMUTABLE_IMAGE_CACHE_CONTROL } = require('../dist/services/imageStorage');
  const { userImageUrls } = require('../dist/services/imageAssets');
  const { assertProductionEnvironment } = require('../dist/config/env');
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const small = decodeImageDataUri(PNG, 4 * 1024 * 1024);
  const config = { accountId: 'account', accessKeyId: 'access', secretAccessKey: 'secret', bucket: 'join-images', publicBaseUrl: 'https://images.example.test/' };
  const commands = [];
  const client = { async send(command) { commands.push(command); return {}; } };
  const storage = new R2ImageStorage(config, client);
  await assert.rejects(storage.upload({ image: { buffer: Buffer.alloc(1), width: 1, height: 1, mimeType: 'image/png', extension: 'png' },
    kind: 'moment', ownerId: 'ignored', preparedVariants: [{ name: 'image.webp', buffer: Buffer.alloc(5_000_001), width: 1, height: 1 }] }),
  /too large after processing/);
  assert.equal(commands.length, 0, 'oversized optimized output never reaches R2');

  const profile = await storage.upload({ image: small, kind: 'profile', ownerId: 'client/chosen/key' });
  assert.equal(profile.provider, 'r2');
  assert.equal(profile.mimeType, 'image/webp');
  assert.equal(profile.width, 512); assert.equal(profile.height, 512);
  assert.match(profile.storageKey, /^profiles\/[a-f0-9]{48}$/);
  assert.ok(!profile.storageKey.includes('client'));
  assert.match(profile.url, /\/avatar\.webp$/);
  assert.match(profile.thumbnailUrl, /\/thumb\.webp$/);
  const profilePuts = commands.splice(0);
  assert.deepEqual(profilePuts.map((command) => command.input.Key.slice(profile.storageKey.length + 1)), ['avatar.webp', 'thumb.webp']);
  profilePuts.forEach((command) => {
    assert.equal(command.input.Bucket, config.bucket);
    assert.equal(command.input.ContentType, 'image/webp');
    assert.equal(command.input.CacheControl, IMMUTABLE_IMAGE_CACHE_CONTROL);
    assert.ok(Buffer.isBuffer(command.input.Body));
  });
  const thumbMeta = await sharp(profilePuts[1].input.Body).metadata();
  assert.equal(thumbMeta.width, 128); assert.equal(thumbMeta.height, 128); assert.equal(thumbMeta.format, 'webp');

  const activity = await storage.upload({ image: small, kind: 'activity', ownerId: 'ignored' });
  assert.equal(activity.width, 1200); assert.equal(activity.height, 675);
  assert.match(activity.storageKey, /^activities\/[a-f0-9]{48}$/);
  assert.match(commands.shift().input.Key, /\/cover\.webp$/);

  const largeBuffer = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#c7a641' } }).jpeg().toBuffer();
  const momentImage = { buffer: largeBuffer, mimeType: 'image/jpeg', extension: 'jpg', width: 2400, height: 1200 };
  const moment = await storage.upload({ image: momentImage, kind: 'moment', ownerId: 'ignored' });
  assert.equal(moment.width, 1920); assert.equal(moment.height, 960);
  assert.match(moment.storageKey, /^moments\/[a-f0-9]{48}$/);
  commands.shift();

  const firstMigration = await storage.upload({ image: small, kind: 'profile', ownerId: 'ignored', deterministicKey: 'migration/profile/database-id' });
  commands.splice(0);
  const retryMigration = await storage.upload({ image: small, kind: 'profile', ownerId: 'different', deterministicKey: 'migration/profile/database-id' });
  commands.splice(0);
  assert.equal(firstMigration.storageKey, retryMigration.storageKey);
  assert.ok(!firstMigration.storageKey.includes('database-id'));

  const legacyCloudinary = userImageUrls({ profileImage: {
    url: 'https://res.cloudinary.com/legacy/image/upload/avatar.jpg',
    thumbnailUrl: 'https://res.cloudinary.com/legacy/image/upload/avatar-thumb.jpg',
    storageKey: 'legacy/avatar', provider: 'cloudinary', mimeType: 'image/jpeg', bytes: 10, width: 512, height: 512,
  } });
  assert.match(legacyCloudinary.profilePictureUrl, /^https:\/\/res\.cloudinary\.com\//);
  assert.match(legacyCloudinary.profileThumbnailUrl, /^https:\/\/res\.cloudinary\.com\//);

  await storage.delete(profile.storageKey);
  const deletion = commands.pop();
  assert.deepEqual(deletion.input.Delete.Objects.map((item) => item.Key), [`${profile.storageKey}/avatar.webp`, `${profile.storageKey}/thumb.webp`]);

  let sends = 0;
  const partialCommands = [];
  const partialClient = { async send(command) { partialCommands.push(command); sends += 1; if (sends === 2) throw new Error('R2 unavailable'); return {}; } };
  await assert.rejects(() => new R2ImageStorage(config, partialClient).upload({ image: small, kind: 'profile', ownerId: 'ignored' }), /R2 unavailable/);
  assert.equal(partialCommands[2].constructor.name, 'DeleteObjectsCommand', 'partial variant upload is cleaned up');

  Object.assign(process.env, {
    NODE_ENV: 'production', MONGODB_URI: 'mongodb://example.test/join', JWT_SECRET: 'r2-config-test-secret-at-least-32-characters',
    CORS_ORIGINS: 'https://app.example.test', PUBLIC_APP_URL: 'https://app.example.test', PASSWORD_RESET_BASE_URL: 'https://app.example.test/reset',
    IMAGE_STORAGE_PROVIDER: 'r2', R2_ACCOUNT_ID: 'account', R2_ACCESS_KEY_ID: 'access', R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET_NAME: 'bucket', R2_PUBLIC_BASE_URL: 'https://images.example.test',
  });
  delete process.env.CLOUDINARY_CLOUD_NAME; delete process.env.CLOUDINARY_API_KEY; delete process.env.CLOUDINARY_API_SECRET; delete process.env.CLOUDINARY_FOLDER;
  assert.doesNotThrow(assertProductionEnvironment, 'Cloudinary variables are not required');
  process.env.IMAGE_UPLOAD_DAILY_USER_LIMIT = 'invalid';
  assert.throws(assertProductionEnvironment, /IMAGE_UPLOAD_DAILY_USER_LIMIT/);
  delete process.env.IMAGE_UPLOAD_DAILY_USER_LIMIT;
  delete process.env.R2_BUCKET_NAME;
  assert.throws(assertProductionEnvironment, /R2_BUCKET_NAME/);
  process.env.R2_BUCKET_NAME = 'bucket'; process.env.R2_PUBLIC_BASE_URL = 'http://images.example.test';
  assert.throws(assertProductionEnvironment, /valid HTTPS URL/);

  console.log('Cloudflare R2 image storage tests passed.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
