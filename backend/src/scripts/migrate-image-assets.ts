import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import User from '../models/User';
import Moment from '../models/Moment';
import type { ImageAsset } from '../models/ImageAsset';
import { decodeImageDataUri } from '../services/imageValidation';
import { getImageStorage } from '../services/imageStorage';

dotenv.config();

const legacyExternal = (url: string): ImageAsset | undefined => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || url.length > 2048) return;
    const ext = parsed.pathname.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { url: parsed.toString(), storageKey: `legacy-external:${crypto.createHash('sha256').update(url).digest('hex')}`,
      provider: 'legacy-external', mimeType, bytes: 1, width: 1, height: 1 };
  } catch { return; }
};

export const migrateImageAssets = async () => {
  let usersMigrated = 0;
  let momentsMigrated = 0;
  const users = await User.find({ profileImage: { $exists: false }, $or: [
    { profilePictureUrl: { $exists: true } }, { profileThumbnailUrl: { $exists: true } }, { avatar: { $exists: true } },
  ] }).select('+profilePictureUrl +profileThumbnailUrl +avatar profileImage');
  for (const user of users) {
    const source = user.profilePictureUrl || user.profileThumbnailUrl || user.avatar;
    if (!source) continue;
    const asset = source.startsWith('data:')
      ? await getImageStorage().upload({ image: decodeImageDataUri(source, 5 * 1024 * 1024), kind: 'profile', ownerId: user.id,
        deterministicKey: `migration/profile/${user.id}` })
      : legacyExternal(source);
    if (!asset) continue;
    const result = await User.updateOne({ _id: user._id, profileImage: { $exists: false } }, {
      $set: { profileImage: asset, profileCompleted: true },
      $unset: { profilePictureUrl: 1, profileThumbnailUrl: 1, avatar: 1 },
    });
    usersMigrated += result.modifiedCount;
  }

  const moments = await Moment.find({ imageAssets: { $exists: false }, images: { $exists: true, $ne: [] } }).select('+images imageAssets creator');
  for (const moment of moments) {
    const assets: ImageAsset[] = [];
    for (const [index, source] of (moment.images || []).entries()) {
      const asset = source.startsWith('data:')
        ? await getImageStorage().upload({ image: decodeImageDataUri(source, 2 * 1024 * 1024), kind: 'moment', ownerId: moment.creator.toString(),
          deterministicKey: `migration/moment/${moment.id}/${index}` })
        : legacyExternal(source);
      if (asset) assets.push(asset);
    }
    if (!assets.length) continue;
    const result = await Moment.updateOne({ _id: moment._id, imageAssets: { $exists: false } }, {
      $set: { imageAssets: assets }, $unset: { images: 1 },
    });
    momentsMigrated += result.modifiedCount;
  }
  return { usersMigrated, momentsMigrated };
};

if (require.main === module) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI must be configured.');
  mongoose.connect(uri).then(migrateImageAssets).then((result) => {
    console.log('[images] Migration complete', result);
    return mongoose.disconnect();
  }).catch(async (error) => {
    console.error('[images] Migration failed; original database fields were retained.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}
