import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import auth, { AuthRequest } from '../middleware/auth';
import Activity from '../models/Activity';
import Moment from '../models/Moment';
import MomentComment from '../models/MomentComment';
import { getJwtSecret } from '../config/security';

const router = express.Router();
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } });
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 1536 * 1024;
const MAX_IMAGE_PAYLOAD_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 128;
const imageUrlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
const imageDataPattern = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

type MomentIdParams = { id: string };
type MomentCommentParams = { id: string; commentId: string };
type UserMomentsParams = { userId: string };
type ActivityMomentsParams = { activityId: string };
type CreateMomentBody = { activityId: string; images: string[]; caption?: string };
type CreateCommentBody = { text: string; clientRequestId?: string };

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

const commentPayload = (comment: any, viewerId?: string) => ({
  id: comment.id,
  momentId: comment.moment?._id?.toString?.() || comment.moment?.toString?.(),
  author: personPayload(comment.author),
  text: comment.text,
  canDelete: comment.author?._id?.toString?.() === viewerId || comment.author?.toString?.() === viewerId,
  createdAt: comment.createdAt,
});

const visibleActivityLocation = (activity: any, viewerId?: string) => {
  if (activity?.locationPrivacy !== 'private') return activity?.location;
  const isMember = activity?.host?._id?.toString?.() === viewerId
    || activity?.host?.toString?.() === viewerId
    || idInList(activity?.participants, viewerId);
  return isMember ? activity?.location : undefined;
};

const momentPayload = (moment: any, viewerId?: string, latestComments: any[] = []) => ({
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
  commentCount: moment.commentCount || 0,
  latestComments: latestComments.map((comment) => commentPayload(comment, viewerId)),
  canDelete: moment.creator?._id?.toString?.() === viewerId || moment.creator?.toString?.() === viewerId,
  createdAt: moment.createdAt,
  updatedAt: moment.updatedAt,
});

const populatedMoment = (query: any) => query
  .populate('creator', 'name avatar profilePictureUrl profileThumbnailUrl')
  .populate('activity', 'title category date location locationPrivacy coverImage visibility host participants');

const populatedComments = (query: any) => query
  .populate('author', 'name avatar profilePictureUrl profileThumbnailUrl');

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
      commentCount: 0,
    });
    const populated = await populatedMoment(Moment.findById(moment.id));
    return res.status(201).json(momentPayload(populated, req.userId));
  },
);

router.get('/user/:userId', async (req: AuthRequest<UserMomentsParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.userId)) return res.status(404).json({ message: 'User not found.' });
  const viewerId = requesterId(req);
  const activityAccess = viewerId
    ? { $or: [{ visibility: { $ne: 'private' } }, { host: viewerId }, { participants: viewerId }] }
    : { visibility: { $ne: 'private' } };
  const accessibleActivityIds = await Activity.find(activityAccess).distinct('_id');
  const query = { creator: req.params.userId, activity: { $in: accessibleActivityIds } };
  const [moments, total] = await Promise.all([
    populatedMoment(Moment.find(query).sort({ createdAt: -1 }).limit(60)),
    Moment.countDocuments(query),
  ]);
  const visible = moments.filter((moment: any) => moment.creator && moment.activity);
  const latestComments = visible[0]
    ? await populatedComments(MomentComment.find({ moment: visible[0]._id }).sort({ createdAt: -1 }).limit(2))
    : [];
  return res.json({
    moments: visible.map((moment: any, index: number) => momentPayload(moment, viewerId, index === 0 ? latestComments : [])),
    total,
  });
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

router.get('/:id/comments', async (req: AuthRequest<MomentIdParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Moment not found.' });
  const viewerId = requesterId(req);
  const moment = await populatedMoment(Moment.findById(req.params.id));
  if (!moment || !moment.activity || !canViewActivity(moment.activity, viewerId)) {
    return res.status(404).json({ message: 'Moment not found.' });
  }

  const comments = await populatedComments(
    MomentComment.find({ moment: moment._id }).sort({ createdAt: 1 }),
  );
  return res.json({
    comments: comments.map((comment: any) => commentPayload(comment, viewerId)),
    count: comments.length,
  });
});

router.post(
  '/:id/comments',
  auth,
  writeLimiter,
  body('text').isString().trim().isLength({ min: 1, max: 400 }).withMessage('Comments must be between 1 and 400 characters.'),
  body('clientRequestId').optional().isString().isLength({ min: 1, max: 64 }),
  async (req: AuthRequest<MomentIdParams, unknown, CreateCommentBody>, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Moment not found.' });

    const moment = await populatedMoment(Moment.findById(req.params.id));
    if (!moment || !moment.activity || !canViewActivity(moment.activity, req.userId)) {
      return res.status(404).json({ message: 'Moment not found.' });
    }

    let comment: any;
    let created = true;
    try {
      comment = await MomentComment.create({
        moment: moment._id,
        author: req.userId,
        text: req.body.text,
        clientRequestId: req.body.clientRequestId,
      });
    } catch (error: any) {
      if (error?.code !== 11000 || !req.body.clientRequestId) throw error;
      created = false;
      comment = await MomentComment.findOne({
        moment: moment._id,
        author: req.userId,
        clientRequestId: req.body.clientRequestId,
      });
    }

    if (!comment) return res.status(500).json({ message: 'Comment could not be saved.' });
    const updatedMoment = created
      ? await Moment.findByIdAndUpdate(moment._id, { $inc: { commentCount: 1 } }, { new: true })
      : await Moment.findById(moment._id);
    const populated = await populatedComments(MomentComment.findById(comment._id));
    return res.status(created ? 201 : 200).json({
      comment: commentPayload(populated, req.userId),
      commentCount: updatedMoment?.commentCount || 0,
    });
  },
);

router.delete('/:id/comments/:commentId', auth, writeLimiter, async (req: AuthRequest<MomentCommentParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.id) || !Types.ObjectId.isValid(req.params.commentId)) {
    return res.status(404).json({ message: 'Comment not found.' });
  }
  const moment = await populatedMoment(Moment.findById(req.params.id));
  if (!moment || !moment.activity || !canViewActivity(moment.activity, req.userId)) {
    return res.status(404).json({ message: 'Moment not found.' });
  }
  const comment = await MomentComment.findOne({ _id: req.params.commentId, moment: moment._id });
  if (!comment) return res.status(404).json({ message: 'Comment not found.' });
  if (comment.author.toString() !== req.userId) {
    return res.status(403).json({ message: 'You can only delete your own comments.' });
  }

  await comment.deleteOne();
  const updatedMoment = await Moment.findByIdAndUpdate(
    moment._id,
    [{
      $set: {
        commentCount: {
          $max: [0, { $subtract: [{ $ifNull: ['$commentCount', 0] }, 1] }],
        },
      },
    }],
    { new: true },
  );
  return res.json({ commentCount: Math.max(updatedMoment?.commentCount || 0, 0) });
});

router.delete('/:id', auth, writeLimiter, async (req: AuthRequest<MomentIdParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Moment not found.' });
  const moment = await Moment.findById(req.params.id);
  if (!moment) return res.status(404).json({ message: 'Moment not found.' });
  if (moment.creator.toString() !== req.userId) return res.status(403).json({ message: 'You can only delete your own Moments.' });
  await MomentComment.deleteMany({ moment: moment._id });
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
