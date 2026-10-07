import crypto from 'crypto';
import { Types } from 'mongoose';
import User from '../models/User';
import Moment from '../models/Moment';
import Activity from '../models/Activity';
import ImageUploadCounter from '../models/ImageUploadCounter';
import ImageUploadGuard from '../models/ImageUploadGuard';
import type { ValidatedImage } from './imageValidation';
import { ImageInputError } from './imageValidation';
import { assertBoundedVariants, processImageForDelivery, type ImageKind, type ProcessedVariant } from './imageStorage';

export class ImageUploadLimitError extends Error {
  constructor(public status: 429 | 503, message: string) { super(message); }
}

const positiveSetting = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

export const uploadLimits = () => ({
  userDaily: positiveSetting('IMAGE_UPLOAD_DAILY_USER_LIMIT', 20),
  userShort: positiveSetting('IMAGE_UPLOAD_SHORT_WINDOW_LIMIT', 5),
  shortWindowMinutes: positiveSetting('IMAGE_UPLOAD_SHORT_WINDOW_MINUTES', 10),
  ipShort: positiveSetting('IMAGE_UPLOAD_IP_LIMIT', 20),
  globalDaily: positiveSetting('GLOBAL_DAILY_IMAGE_UPLOAD_LIMIT', 1000),
  stored: positiveSetting('IMAGE_ASSET_MAX_PER_USER', 100),
  globalBytes: positiveSetting('GLOBAL_DAILY_IMAGE_UPLOAD_BYTES', 1_000_000_000),
});

export const imageUploadsEnabled = () => process.env.IMAGE_UPLOADS_ENABLED !== 'false';
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const dayId = (now: Date) => `day:${now.toISOString().slice(0, 10)}`;
const windowId = (now: Date, minutes: number) => `window:${minutes}:${Math.floor(now.getTime() / (minutes * 60_000))}`;
let lastGlobalWarningDay = '';
const warnedEvents = new Set<string>();
const warnOnce = (event: string, bucket: string) => {
  const key = `${event}:${bucket}`;
  if (warnedEvents.has(key)) return;
  if (warnedEvents.size > 5000) warnedEvents.clear();
  warnedEvents.add(key);
  console.warn('[images] Upload safeguard reached', { event, bucket });
};

const ensureCounter = async (id: string, expiresAt: Date) => {
  await ImageUploadCounter.updateOne({ _id: id }, { $setOnInsert: { files: 0, bytes: 0, users: {}, ips: {}, expiresAt } }, { upsert: true });
};

const currentStoredAssets = async (userId: string) => {
  const [profile, moments, activities] = await Promise.all([
    User.countDocuments({ _id: userId, profileImage: { $exists: true } }),
    Moment.aggregate([{ $match: { creator: new Types.ObjectId(userId) } }, { $project: { count: { $size: { $ifNull: ['$imageAssets', []] } } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
    Activity.countDocuments({ host: userId, coverImageAsset: { $exists: true } }),
  ]);
  return profile + (moments[0]?.total || 0) + activities;
};

export const checkImageUploadRequest = async (userId: string, ip: string, now = new Date()) => {
  if (!imageUploadsEnabled()) {
    warnOnce('kill_switch', dayId(now));
    throw new ImageUploadLimitError(503, 'Image uploads are temporarily unavailable. Please try again later.');
  }
  const limits = uploadLimits();
  const id = windowId(now, limits.shortWindowMinutes);
  await ensureCounter(id, new Date(now.getTime() + 2 * 86400_000));
  const userPath = `users.${hash(userId)}`;
  const ipPath = `ips.${hash(ip)}`;
  const updated = await ImageUploadCounter.findOneAndUpdate({ _id: id, $expr: { $and: [
    { $lt: [{ $ifNull: [`$${userPath}`, 0] }, limits.userShort] },
    { $lt: [{ $ifNull: [`$${ipPath}`, 0] }, limits.ipShort] },
  ] } }, { $inc: { [userPath]: 1, [ipPath]: 1 } }, { new: true });
  if (!updated) {
    const state = await ImageUploadCounter.findById(id).lean();
    const ipHit = Number(state?.ips?.[hash(ip)] || 0) >= limits.ipShort;
    warnOnce(ipHit ? 'ip_rate' : 'user_rate', id);
    throw new ImageUploadLimitError(429, 'Too many image uploads. Please try again later.');
  }
};

export const prepareBoundedImage = async (image: ValidatedImage, kind: ImageKind): Promise<ProcessedVariant[]> => {
  let variants;
  try { variants = await processImageForDelivery(image, kind); }
  catch { throw new ImageInputError('Could not process this image. Please choose another image.'); }
  assertBoundedVariants(kind, variants);
  return variants;
};

export const reserveImageUpload = async (userId: string, files: number, bytes: number, replacesProfile = false, now = new Date()) => {
  if (!imageUploadsEnabled()) {
    warnOnce('kill_switch', dayId(now));
    throw new ImageUploadLimitError(503, 'Image uploads are temporarily unavailable. Please try again later.');
  }
  if (!Number.isSafeInteger(files) || files < 1 || files > 3 || !Number.isSafeInteger(bytes) || bytes < 1) throw new Error('Invalid image quota reservation.');
  const limits = uploadLimits();
  const addedAssets = replacesProfile ? 0 : files;
  const objectId = new Types.ObjectId(userId);
  const lease = crypto.randomUUID();
  await ImageUploadGuard.updateOne({ _id: objectId }, { $setOnInsert: { pending: 0, updatedAt: now } }, { upsert: true });
  const guard = await ImageUploadGuard.findOneAndUpdate({ _id: objectId, $or: [{ pending: 0 }, { updatedAt: { $lt: new Date(now.getTime() - 10 * 60_000) } }] },
    { $set: { pending: 1, lease, updatedAt: now } }, { new: true });
  if (!guard) throw new ImageUploadLimitError(429, 'Another image upload is in progress. Please retry shortly.');

  try {
    const stored = await currentStoredAssets(userId);
    if (stored + addedAssets > limits.stored) {
      throw new ImageUploadLimitError(429, 'You have reached your image storage limit. Remove older images before uploading more.');
    }
    const id = dayId(now);
    await ensureCounter(id, new Date(now.getTime() + 3 * 86400_000));
    const userPath = `users.${hash(userId)}`;
    const updated = await ImageUploadCounter.findOneAndUpdate({ _id: id, $expr: { $and: [
      { $lte: [{ $add: [{ $ifNull: [`$${userPath}`, 0] }, files] }, limits.userDaily] },
      { $lte: [{ $add: ['$files', files] }, limits.globalDaily] },
      { $lte: [{ $add: ['$bytes', bytes] }, limits.globalBytes] },
    ] } }, { $inc: { [userPath]: files, files, bytes } }, { new: true });
    if (!updated) {
      const state = await ImageUploadCounter.findById(id).lean();
      if ((state?.files || 0) + files > limits.globalDaily || (state?.bytes || 0) + bytes > limits.globalBytes) {
        if (lastGlobalWarningDay !== id) {
          lastGlobalWarningDay = id;
          console.warn('[images] Global daily upload safeguard reached', { day: id });
        }
        throw new ImageUploadLimitError(503, 'Image uploads are temporarily unavailable. Please try again later.');
      }
      warnOnce('user_daily', id);
      throw new ImageUploadLimitError(429, "You've reached today's image upload limit. Try again later.");
    }
  } catch (error) {
    await ImageUploadGuard.updateOne({ _id: objectId, lease }, { $set: { pending: 0 }, $unset: { lease: 1 } });
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await ImageUploadGuard.updateOne({ _id: objectId, lease }, { $set: { pending: 0 }, $unset: { lease: 1 } });
  };
};
