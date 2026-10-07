import type { ImageAsset } from '../models/ImageAsset';
import User from '../models/User';
import Moment from '../models/Moment';
import Activity from '../models/Activity';
import { getImageStorage } from './imageStorage';

const safeHttpsUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    const localDevelopmentUrl = process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    return url.protocol === 'https:' || localDevelopmentUrl ? url.toString() : undefined;
  } catch { return undefined; }
};

export const userImageUrls = (user: any) => {
  const picture = safeHttpsUrl(user?.profileImage?.url) || safeHttpsUrl(user?.profilePictureUrl) || safeHttpsUrl(user?.avatar);
  const thumbnail = safeHttpsUrl(user?.profileImage?.thumbnailUrl) || safeHttpsUrl(user?.profileThumbnailUrl) || picture;
  return { profilePictureUrl: picture, profileThumbnailUrl: thumbnail, avatar: thumbnail };
};

export const momentImageUrls = (moment: any) => {
  const assets = (moment?.imageAssets || []).map((asset: ImageAsset) => safeHttpsUrl(asset.url)).filter(Boolean);
  if (assets.length) return assets;
  return (moment?.images || []).map(safeHttpsUrl).filter(Boolean);
};

export const activityImageUrl = (activity: any) => (
  safeHttpsUrl(activity?.coverImageAsset?.url) || safeHttpsUrl(activity?.coverImage)
);

export const cleanupUnreferencedAssets = async (assets: Array<ImageAsset | undefined>) => {
  for (const asset of assets.filter(Boolean) as ImageAsset[]) {
    if (!asset.storageKey || asset.provider === 'legacy-external' || asset.provider === 'cloudinary') continue;
    if (asset.provider === 'local' && process.env.IMAGE_STORAGE_PROVIDER !== 'local') continue;
    try {
      const [users, moments, activities] = await Promise.all([
        User.countDocuments({ 'profileImage.storageKey': asset.storageKey }),
        Moment.countDocuments({ 'imageAssets.storageKey': asset.storageKey }),
        Activity.countDocuments({ 'coverImageAsset.storageKey': asset.storageKey }),
      ]);
      if (!users && !moments && !activities) await getImageStorage().delete(asset.storageKey);
    } catch (error) {
      console.error('[images] Deferred object cleanup failed', { category: 'provider_cleanup' });
    }
  }
};
