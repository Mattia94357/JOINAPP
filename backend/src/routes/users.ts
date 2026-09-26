import { deleteAccount } from '../services/accountDeletion';
import { activeUserFilter, socialAccessDenied } from '../services/blocking';
import { submitReport } from '../services/reports';
import { reportLimiter } from './reports';
import { asyncHandler } from '../middleware/asyncHandler';
import { getRequesterId } from '../services/sessions';
import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Types } from 'mongoose';
import auth, { AuthRequest } from '../middleware/auth';
import User, { IUser } from '../models/User';
import Activity from '../models/Activity';
import { rateLimit } from 'express-rate-limit';
import type { ParamsDictionary } from 'express-serve-static-core';
import { effectiveActivityStatus } from '../utils/activityLifecycle';
import { completePastActivities } from '../services/activityCompletion';

const router = express.Router();

type ApiResponse = Response<unknown>;
type NoParams = ParamsDictionary;
type UserIdParams = { id: string };
type ProfileBody = {
  bio?: unknown;
  aboutMe?: unknown;
  location?: unknown;
  languages?: unknown;
  interests?: unknown;
  instagram?: unknown;
  ageRange?: unknown;
  gender?: unknown;
  publicGender?: unknown;
  hasCompletedOnboardingTutorial?: unknown;
};
type ProfilePhotoBody = {
  profilePictureUrl: string;
  profileThumbnailUrl?: string;
};
type PrivacyBody = {
  locationPublic?: boolean;
  hostedActivitiesPublic?: boolean;
  joinedActivitiesPublic?: boolean;
  publicGender?: boolean;
};

const imageUrlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
const imageDataPattern = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const maxProfileImageBytes = 5 * 1024 * 1024;
const maxProfileImagePayloadLength = Math.ceil((maxProfileImageBytes * 4) / 3) + 128;
const allowedGenders = ['male', 'female', 'non_binary', 'prefer_not_to_say'] as const;
type Gender = typeof allowedGenders[number];
const moderationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } });

const isAllowedGender = (value: unknown): value is Gender =>
  typeof value === 'string' && (allowedGenders as readonly string[]).includes(value);

const optionalTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : undefined);



const historyActivityFields = 'title category location locationPrivacy date visibility status coverImage host participants';
const canViewHistoryActivity = (activity: any, viewerId?: string) => (
  activity.visibility !== 'private'
  || activity.host?.toString?.() === viewerId
  || (activity.participants || []).some((id: any) => id.toString() === viewerId)
);
const historyActivityPayload = (activity: any, viewerId?: string) => {
  const isMember = activity.host?.toString?.() === viewerId
    || (activity.participants || []).some((id: any) => id.toString() === viewerId);
  return ({
  _id: activity._id,
  title: activity.title,
  category: activity.category,
  location: activity.locationPrivacy === 'private' && !isMember ? undefined : activity.location,
  date: activity.date,
  visibility: activity.visibility,
  status: effectiveActivityStatus(activity),
  coverImage: activity.coverImage,
  });
};

const getBase64ByteSize = (value: string) => {
  const base64 = value.split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
};

const isValidProfileImage = (value: string) => {
  if (value.length > maxProfileImagePayloadLength) return false;
  if (imageUrlPattern.test(value)) return true;
  if (!imageDataPattern.test(value)) return false;
  const base64 = value.split(',')[1] || '';
  if (!base64 || !/^[a-zA-Z0-9+/=]+$/.test(base64)) return false;
  return getBase64ByteSize(value) <= maxProfileImageBytes;
};

const publicGenderValue = (user: IUser) => {
  const gender = user.gender;
  if (!user.publicGender || !gender || gender === 'prefer_not_to_say') return undefined;
  return allowedGenders.includes(gender) ? gender : undefined;
};

const userPayload = (user: IUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.profileThumbnailUrl || user.profilePictureUrl || user.avatar,
  profilePictureUrl: user.profilePictureUrl,
  profileThumbnailUrl: user.profileThumbnailUrl,
  profileCompleted: Boolean(user.profileCompleted || user.profilePictureUrl),
  location: user.location,
  interests: user.interests || [],
  verified: user.verified,
  bio: user.bio,
  aboutMe: user.aboutMe,
  languages: user.languages || [],
  instagram: user.instagram,
  ageRange: user.ageRange,
  gender: user.gender,
  publicGender: Boolean(user.publicGender),
  hostRating: user.hostRating,
  activityRating: user.activityRating,
  reviewCount: user.reviewCount,
  hostedCount: user.hostedCount,
  joinedCount: user.joinedCount,
  hasCompletedOnboardingTutorial: Boolean(user.hasCompletedOnboardingTutorial),
  locationPublic: user.locationPublic,
  hostedActivitiesPublic: user.hostedActivitiesPublic,
  joinedActivitiesPublic: user.joinedActivitiesPublic,
});

const publicUserPayload = (user: IUser) => ({
  id: user.id,
  name: user.name,
  avatar: user.profileThumbnailUrl || user.profilePictureUrl || (user.profileCompleted ? user.avatar : undefined),
  profilePictureUrl: user.profilePictureUrl,
  profileThumbnailUrl: user.profileThumbnailUrl,
  bio: user.bio,
  aboutMe: user.aboutMe,
  location: user.locationPublic ? user.location : undefined,
  languages: user.languages || [],
  interests: user.interests || [],
  instagram: user.instagram,
  gender: publicGenderValue(user),
  verified: user.verified,
  hostRating: user.hostRating,
  activityRating: user.activityRating,
  reviewCount: user.reviewCount,
  hostedCount: user.hostedCount,
  joinedCount: user.joinedCount,
});

router.patch(
  '/me/profile',
  auth,
  body('bio').optional().isString().isLength({ max: 500 }),
  body('aboutMe').optional().isString().isLength({ max: 500 }),
  body('location').optional().isString().isLength({ max: 120 }),
  body('languages').optional().isArray({ max: 12 }),
  body('interests').optional().isArray({ max: 20 }),
  body('instagram').optional().isString().isLength({ max: 80 }),
  body('ageRange').optional().isString().isLength({ max: 40 }),
  body('gender').optional({ nullable: true, checkFalsy: true }).isIn(allowedGenders),
  body('publicGender').optional().isBoolean(),
  body('hasCompletedOnboardingTutorial').optional().isBoolean(),
  asyncHandler(async (req: AuthRequest<NoParams, unknown, ProfileBody>, res: ApiResponse) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const bio = optionalTrimmedString(req.body.bio);
    if (bio !== undefined) user.bio = bio;
    const aboutMe = optionalTrimmedString(req.body.aboutMe);
    if (aboutMe !== undefined) user.aboutMe = aboutMe;
    const location = optionalTrimmedString(req.body.location);
    if (location !== undefined) user.location = location;
    const instagram = optionalTrimmedString(req.body.instagram);
    if (instagram !== undefined) user.instagram = instagram;
    const ageRange = optionalTrimmedString(req.body.ageRange);
    if (ageRange !== undefined) user.ageRange = ageRange;
    if (isAllowedGender(req.body.gender)) {
      user.gender = req.body.gender;
    }
    if (typeof req.body.publicGender === 'boolean') {
      user.publicGender = req.body.publicGender;
    }
    if (Array.isArray(req.body.languages)) user.languages = req.body.languages.map((item: string) => String(item).trim()).filter(Boolean).slice(0, 12);
    if (Array.isArray(req.body.interests)) user.interests = req.body.interests.map((item: string) => String(item).trim()).filter(Boolean).slice(0, 20);
    if (typeof req.body.hasCompletedOnboardingTutorial === 'boolean') {
      user.hasCompletedOnboardingTutorial = req.body.hasCompletedOnboardingTutorial;
    }

    await user.save();
    res.json(userPayload(user));
  }),
);

router.get('/me', auth, asyncHandler(async (req: AuthRequest, res: ApiResponse) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(userPayload(user));
}));

router.get('/me/history', auth, asyncHandler(async (req: AuthRequest, res: ApiResponse) => {
  await completePastActivities(new Date(), { $or: [{ host: req.userId }, { participants: req.userId }] });
  const [hostedActivities, joinedActivities, hostedCount, joinedCount] = await Promise.all([
    Activity.find({ host: req.userId, status: { $ne: 'cancelled' } }).sort({ date: -1 }).limit(100).select(historyActivityFields),
    Activity.find({ participants: req.userId, host: { $ne: req.userId }, status: { $ne: 'cancelled' } }).sort({ date: -1 }).limit(100).select(historyActivityFields),
    Activity.countDocuments({ host: req.userId, status: { $ne: 'cancelled' } }),
    Activity.countDocuments({ participants: req.userId, host: { $ne: req.userId }, status: { $ne: 'cancelled' } }),
  ]);
  res.json({
    hostedActivities: hostedActivities.map((activity) => historyActivityPayload(activity, req.userId)),
    joinedActivities: joinedActivities.map((activity) => historyActivityPayload(activity, req.userId)),
    hostedCount,
    joinedCount,
  });
}));

router.patch(
  '/me/profile-photo',
  auth,
  body('profilePictureUrl')
    .isString()
    .custom(isValidProfileImage)
    .withMessage('Use a JPEG, PNG, or WEBP image under 5MB.'),
  body('profileThumbnailUrl')
    .optional()
    .isString()
    .custom(isValidProfileImage)
    .withMessage('Use a JPEG, PNG, or WEBP thumbnail under 5MB.'),
  asyncHandler(async (req: AuthRequest<NoParams, unknown, ProfilePhotoBody>, res: ApiResponse) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.profilePictureUrl = req.body.profilePictureUrl;
    user.profileThumbnailUrl = req.body.profileThumbnailUrl || req.body.profilePictureUrl;
    user.avatar = user.profileThumbnailUrl;
    user.profileCompleted = true;
    await user.save();

    res.json(userPayload(user));
  }),
);

// Old clients must upgrade rather than reactivate an unowned singleton token.
router.patch('/me/push-token', auth, (_req, res) => res.status(410).json({ message: 'Please update JOIN to register this device.' }));

router.patch(
  '/me/privacy',
  auth,
  body('locationPublic').optional().isBoolean(),
  body('hostedActivitiesPublic').optional().isBoolean(),
  body('joinedActivitiesPublic').optional().isBoolean(),
  body('publicGender').optional().isBoolean(),
  asyncHandler(async (req: AuthRequest<NoParams, unknown, PrivacyBody>, res: ApiResponse) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Privacy settings must be true or false.' });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.locationPublic = req.body.locationPublic ?? user.locationPublic;
    user.hostedActivitiesPublic = req.body.hostedActivitiesPublic ?? user.hostedActivitiesPublic;
    user.joinedActivitiesPublic = req.body.joinedActivitiesPublic ?? user.joinedActivitiesPublic;
    user.publicGender = req.body.publicGender ?? user.publicGender;
    await user.save();

    res.json(userPayload(user));
  }),
);

router.delete('/me', auth, asyncHandler(async (req: AuthRequest, res: ApiResponse) => {
  await deleteAccount(req.userId as string);
  res.json({ message: 'Account deleted.' });
}));

// Compatibility endpoint; all new reports use the same validation and deduplication.
router.post('/:id/report', auth, reportLimiter, asyncHandler(async (req: any, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'User not found.' });
  const result = await submitReport(req.userId, 'user', req.params.id, req.body?.reason, req.body?.detail);
  res.status(result.status).json({ message: result.message });
}));

router.get('/me/blocked-users', auth, asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId).select('blockedUsers');
  const blocked = await User.find({ _id: { $in: user?.blockedUsers || [] }, ...activeUserFilter })
    .select('name avatar profilePictureUrl profileThumbnailUrl');
  res.json(blocked.map((person) => ({ id: person.id, name: person.name,
    avatar: person.profileThumbnailUrl || person.profilePictureUrl || person.avatar })));
}));

// Adds a user to the signed-in user's block list. This is additive and safe for existing users.
router.post('/:id/block', auth, moderationLimiter, asyncHandler(async (req: AuthRequest<UserIdParams>, res: ApiResponse) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'User to block not found' });
  }

  if (req.params.id === req.userId) {
    return res.status(400).json({ message: 'You cannot block yourself.' });
  }

  const [user, blockedUser] = await Promise.all([
    User.findById(req.userId),
    User.findById(req.params.id),
  ]);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!blockedUser || blockedUser.deletionStartedAt || blockedUser.deletedAt) return res.status(404).json({ message: 'User to block not found' });

  await User.updateOne({ _id: req.userId }, { $addToSet: { blockedUsers: blockedUser._id } });

  res.json({ message: 'User blocked.' });
}));

// Removes a user from the signed-in user's block list.
router.post('/:id/unblock', auth, asyncHandler(async (req: AuthRequest<UserIdParams>, res: ApiResponse) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  await User.updateOne({ _id: req.userId }, { $pull: { blockedUsers: req.params.id } });

  res.json({ message: 'User unblocked.' });
}));

router.get('/:id', asyncHandler(async (req: AuthRequest<UserIdParams>, res: ApiResponse) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = await User.findById(req.params.id).select('-password -passwordResetTokenHash -passwordResetExpires');
  if (!user) return res.status(404).json({ message: 'User not found' });

  const viewerId = await getRequesterId(req);
  if (await socialAccessDenied(viewerId, user.id)) return res.status(403).json({ message: 'Profile unavailable.' });
  const accessQuery = viewerId
    ? { $or: [{ visibility: { $ne: 'private' } }, { host: viewerId }, { participants: viewerId }] }
    : { visibility: { $ne: 'private' } };
  const hostedQuery = { $and: [{ host: user.id, status: { $ne: 'cancelled' } }, accessQuery] };
  const joinedQuery = { $and: [{ participants: user.id, host: { $ne: user.id }, status: { $ne: 'cancelled' } }, accessQuery] };
  const [hostedCandidates, joinedCandidates, hostedCount, joinedCount] = await Promise.all([
    user.hostedActivitiesPublic
      ? Activity.find(hostedQuery).sort({ date: -1 }).limit(100).select(historyActivityFields)
      : [],
    user.joinedActivitiesPublic
      ? Activity.find(joinedQuery).sort({ date: -1 }).limit(100).select(historyActivityFields)
      : [],
    user.hostedActivitiesPublic ? Activity.countDocuments(hostedQuery) : 0,
    user.joinedActivitiesPublic ? Activity.countDocuments(joinedQuery) : 0,
  ]);
  const hostedActivities = hostedCandidates.filter((activity: any) => canViewHistoryActivity(activity, viewerId));
  const joinedActivities = joinedCandidates.filter((activity: any) => canViewHistoryActivity(activity, viewerId));

  res.json({
    ...publicUserPayload(user),
    hostedActivities: hostedActivities.map((activity) => historyActivityPayload(activity, viewerId)),
    joinedActivities: joinedActivities.map((activity) => historyActivityPayload(activity, viewerId)),
    hostedCount,
    joinedCount,
  });
}));

export default router;
