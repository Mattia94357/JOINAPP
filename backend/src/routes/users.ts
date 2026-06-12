import express from 'express';
import { body, validationResult } from 'express-validator';
import { Types } from 'mongoose';
import auth, { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import Activity from '../models/Activity';
import UserReport from '../models/UserReport';

const router = express.Router();

const imageUrlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
const imageDataPattern = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const maxProfileImageBytes = 5 * 1024 * 1024;
const maxProfileImagePayloadLength = Math.ceil((maxProfileImageBytes * 4) / 3) + 128;
const allowedGenders = ['male', 'female', 'non_binary', 'prefer_not_to_say'];

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

const publicGenderValue = (user: any) => {
  if (!user?.publicGender || user.gender === 'prefer_not_to_say') return undefined;
  return allowedGenders.includes(user.gender) ? user.gender : undefined;
};

const userPayload = (user: any) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.profileThumbnailUrl || user.profilePictureUrl || user.avatar,
  profilePictureUrl: user.profilePictureUrl,
  profileThumbnailUrl: user.profileThumbnailUrl,
  pushToken: user.pushToken,
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
  savedActivities: user.savedActivities || [],
  hasCompletedOnboardingTutorial: Boolean(user.hasCompletedOnboardingTutorial),
  locationPublic: user.locationPublic,
  hostedActivitiesPublic: user.hostedActivitiesPublic,
  joinedActivitiesPublic: user.joinedActivitiesPublic,
});

const publicUserPayload = (user: any) => ({
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
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const assignString = (field: keyof typeof req.body) => {
      if (typeof req.body[field] === 'string') (user as any)[field] = req.body[field].trim();
    };

    assignString('bio');
    assignString('aboutMe');
    assignString('location');
    assignString('instagram');
    assignString('ageRange');
    if (typeof req.body.gender === 'string' && allowedGenders.includes(req.body.gender)) {
      user.gender = req.body.gender as any;
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
  },
);

router.get('/me', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(userPayload(user));
});

router.patch(
  '/me/profile-photo',
  auth,
  body('profilePictureUrl')
    .isString()
    .custom(isValidProfileImage)
    .withMessage('Use a JPEG, PNG, or WEBP image under 5MB.'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.profilePictureUrl = req.body.profilePictureUrl;
    if (req.body.profileThumbnailUrl && !isValidProfileImage(req.body.profileThumbnailUrl)) {
      return res.status(400).json({ message: 'Use a JPEG, PNG, or WEBP thumbnail under 5MB.' });
    }

    user.profileThumbnailUrl = req.body.profileThumbnailUrl || req.body.profilePictureUrl;
    user.avatar = user.profileThumbnailUrl;
    user.profileCompleted = true;
    await user.save();

    res.json(userPayload(user));
  },
);

// Stores the Expo push token for the signed-in user so future engagement notifications can be sent.
router.patch(
  '/me/push-token',
  auth,
  body('pushToken').isString().isLength({ min: 10, max: 512 }),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid push token.' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.pushToken = req.body.pushToken;
    await user.save();

    res.json(userPayload(user));
  },
);

router.patch('/me/privacy', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.locationPublic = req.body.locationPublic ?? user.locationPublic;
  user.hostedActivitiesPublic = req.body.hostedActivitiesPublic ?? user.hostedActivitiesPublic;
  user.joinedActivitiesPublic = req.body.joinedActivitiesPublic ?? user.joinedActivitiesPublic;
  user.publicGender = req.body.publicGender ?? user.publicGender;
  await user.save();

  res.json(userPayload(user));
});

// Permanently deletes the signed-in account. Existing activity references remain for backward compatibility.
router.delete('/me', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  await User.deleteOne({ _id: req.userId });
  res.json({ message: 'Account deleted.' });
});

// Records a lightweight user report for moderation workflows without changing public API contracts.
router.post(
  '/:id/report',
  auth,
  body('reason').optional().isString().isLength({ max: 500 }),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Report reason is too long.' });

    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'User not found' });
    }

    const reportedUser = await User.findById(req.params.id);
    if (!reportedUser) return res.status(404).json({ message: 'User not found' });

    await UserReport.create({
      reporter: req.userId,
      reportedUser: req.params.id,
      reason: req.body.reason || 'No reason provided',
    });

    res.status(201).json({ message: 'Report submitted.' });
  },
);

// Adds a user to the signed-in user's block list. This is additive and safe for existing users.
router.post('/:id/block', auth, async (req: AuthRequest, res) => {
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
  if (!blockedUser) return res.status(404).json({ message: 'User to block not found' });

  const alreadyBlocked = (user.blockedUsers || []).some((id) => id.toString() === req.params.id);
  if (!alreadyBlocked) {
    user.blockedUsers = [...(user.blockedUsers || []), blockedUser._id];
    await user.save();
  }

  res.json({ message: 'User blocked.' });
});

// Removes a user from the signed-in user's block list.
router.post('/:id/unblock', auth, async (req: AuthRequest, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.blockedUsers = (user.blockedUsers || []).filter((id) => id.toString() !== req.params.id);
  await user.save();

  res.json({ message: 'User unblocked.' });
});

router.get('/:id', async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = await User.findById(req.params.id).select('-password -passwordResetTokenHash -passwordResetExpires');
  if (!user) return res.status(404).json({ message: 'User not found' });

  const hostedActivities = user.hostedActivitiesPublic
    ? await Activity.find({ host: user.id }).sort({ createdAt: -1 }).limit(5).select('title category location date visibility')
    : [];
  const joinedActivities = user.joinedActivitiesPublic
    ? await Activity.find({ participants: user.id }).sort({ createdAt: -1 }).limit(5).select('title category location date visibility')
    : [];

  res.json({
    ...publicUserPayload(user),
    hostedActivities,
    joinedActivities,
  });
});

export default router;
