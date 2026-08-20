import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import auth, { AuthRequest } from '../middleware/auth';
import Activity from '../models/Activity';
import Moment from '../models/Moment';
import { getJwtSecret } from '../config/security';

const router = express.Router();
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } });
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 1536 * 1024;
const MAX_IMAGE_PAYLOAD_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 128;
const imageUrlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
const imageDataPattern = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

type MomentIdParams = { id: string };
type UserMomentsParams = { userId: string };
type ActivityMomentsParams = { activityId: string };
type CreateMomentBody = { activityId: string; images: string[]; caption?: string };

const requesterId = (req: express.Request) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  try {
    return (jwt.verify(header.slice(7), getJwtSecret()) as { userId?: string }).userId;
  } catch {
    return undefined;
  }
};

const idInList = (list: any[] | undefined, id?: string) => Boolean(
  id && (list || []).some((item) => (item?._id?.toString?.() || item?.toString?.()) === id),
);

const canViewActivity = (activity: any, viewerId?: string) => (
  activity?.visibility !== 'private'
  || activity?.host?._id?.toString?.() === viewerId
  || activity?.host?.toString?.() === viewerId
  || idInList(activity?.participants, viewerId)
);

const imageByteSize = (value: string) => Math.ceil(((value.split(',')[1] || '').length * 3) / 4);
const validImage = (value: unknown) => {
  if (typeof value !== 'string' || !value || value.length > MAX_IMAGE_PAYLOAD_LENGTH) return false;
  if (imageUrlPattern.test(value)) return true;
  if (!imageDataPattern.test(value)) return false;
  const encoded = value.split(',')[1] || '';
  return Boolean(encoded && /^[a-zA-Z0-9+/=]+$/.test(encoded) && imageByteSize(value) <= MAX_IMAGE_BYTES);
};

const personPayload = (user: any) => ({
  id: user?._id?.toString?.() || user?.id,
  name: user?.name || 'Former JOIN member',
  avatar: user?.profileThumbnailUrl || user?.profilePictureUrl || user?.avatar,
  profilePictureUrl: user?.profilePictureUrl,
  profileThumbnailUrl: user?.profileThumbnailUrl,
});

const visibleActivityLocation = (activity: any, viewerId?: string) => {
  if (activity?.locationPrivacy !== 'private') return activity?.location;
  const isMember = activity?.host?._id?.toString?.() === viewerId
    || activity?.host?.toString?.() === viewerId
    || idInList(activity?.participants, viewerId);
  return isMember ? activity?.location : undefined;
};

const momentPayload = (moment: any, viewerId?: string) => ({
  id: moment.id,
  creator: personPayload(moment.creator),
  activity: {
    id: moment.activity?._id?.toString?.() || moment.activity?.id,
    title: moment.activity?.title || 'Activity unavailable',
    category: moment.activity?.category,
    date: moment.activity?.date,
    location: visibleActivityLocation(moment.activity, viewerId),
    coverImage: moment.activity?.coverImage,
    visibility: moment.activity?.visibility,
  },
  images: moment.images || [],
  caption: moment.caption,
  likeCount: (moment.likes || []).length,
  likedByViewer: idInList(moment.likes, viewerId),
  canDelete: moment.creator?._id?.toString?.() === viewerId || moment.creator?.toString?.() === viewerId,
  createdAt: moment.createdAt,
  updatedAt: moment.updatedAt,
});

const populatedMoment = (query: any) => query
  .populate('creator', 'name avatar profilePictureUrl profileThumbnailUrl')
  .populate('activity', 'title category date location locationPrivacy coverImage visibility host participants');

router.post(
  '/',
  auth,
  writeLimiter,
  body('activityId').isMongoId(),
  body('images').isArray({ min: 1, max: MAX_IMAGES }),
  body('images.*').custom(validImage).withMessage('Moment photos must be JPEG, PNG, or WEBP images under 1.5MB each.'),
  body('caption').optional().isString().isLength({ max: 280 }),
  async (req: AuthRequest<Record<string, never>, unknown, CreateMomentBody>, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const activity = await Activity.findById(req.body.activityId);
    if (!activity) return res.status(404).json({ message: 'Activity not found.' });
    const isHost = activity.host.toString() === req.userId;
    const participated = isHost || idInList(activity.participants, req.userId);
    if (!participated) return res.status(403).json({ message: 'Only confirmed participants can add a Moment.' });
    if (activity.status === 'cancelled') return res.status(400).json({ message: 'Moments cannot be added to a cancelled activity.' });
    if (activity.status !== 'completed' && activity.date.getTime() > Date.now()) {
      return res.status(400).json({ message: 'Moments become available once the activity begins.' });
    }

    const moment = await Moment.create({
      creator: req.userId,
      activity: activity._id,
      images: req.body.images.slice(0, MAX_IMAGES),
      caption: typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, 280) : undefined,
      likes: [],
    });
    const populated = await populatedMoment(Moment.findById(moment.id));
    return res.status(201).json(momentPayload(populated, req.userId));
  },
);

router.get('/user/:userId', async (req: AuthRequest<UserMomentsParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.userId)) return res.status(404).json({ message: 'User not found.' });
  const viewerId = requesterId(req);
  const moments = await populatedMoment(Moment.find({ creator: req.params.userId }).sort({ createdAt: -1 }).limit(60));
  const visible = moments.filter((moment: any) => moment.creator && moment.activity && canViewActivity(moment.activity, viewerId));
  return res.json(visible.map((moment: any) => momentPayload(moment, viewerId)));
});

router.get('/activity/:activityId', async (req: AuthRequest<ActivityMomentsParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.activityId)) return res.status(404).json({ message: 'Activity not found.' });
  const viewerId = requesterId(req);
  const activity = await Activity.findById(req.params.activityId);
  if (!activity) return res.status(404).json({ message: 'Activity not found.' });
  if (!canViewActivity(activity, viewerId)) return res.status(403).json({ message: 'This activity is private.' });
  const moments = await populatedMoment(Moment.find({ activity: activity._id }).sort({ createdAt: -1 }).limit(60));
  return res.json(moments.filter((moment: any) => moment.creator).map((moment: any) => momentPayload(moment, viewerId)));
});

router.delete('/:id', auth, writeLimiter, async (req: AuthRequest<MomentIdParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Moment not found.' });
  const moment = await Moment.findById(req.params.id);
  if (!moment) return res.status(404).json({ message: 'Moment not found.' });
  if (moment.creator.toString() !== req.userId) return res.status(403).json({ message: 'You can only delete your own Moments.' });
  await moment.deleteOne();
  return res.json({ message: 'Moment deleted.' });
});

router.post('/:id/like', auth, writeLimiter, async (req: AuthRequest<MomentIdParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Moment not found.' });
  const moment = await populatedMoment(Moment.findById(req.params.id));
  if (!moment || !moment.activity || !canViewActivity(moment.activity, req.userId)) return res.status(404).json({ message: 'Moment not found.' });
  const updated = await Moment.findByIdAndUpdate(moment.id, { $addToSet: { likes: req.userId } }, { new: true });
  return res.json({ liked: true, likeCount: updated?.likes.length || 0 });
});

router.delete('/:id/like', auth, writeLimiter, async (req: AuthRequest<MomentIdParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Moment not found.' });
  const moment = await populatedMoment(Moment.findById(req.params.id));
  if (!moment || !moment.activity || !canViewActivity(moment.activity, req.userId)) return res.status(404).json({ message: 'Moment not found.' });
  const updated = await Moment.findByIdAndUpdate(moment.id, { $pull: { likes: req.userId } }, { new: true });
  return res.json({ liked: false, likeCount: updated?.likes.length || 0 });
});

export default router;
