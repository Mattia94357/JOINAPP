import express from 'express';
import { body, validationResult } from 'express-validator';
import auth, { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import Activity from '../models/Activity';

const router = express.Router();

const imageUrlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;

const userPayload = (user: any) => ({
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
  hostRating: user.hostRating,
  hostedCount: user.hostedCount,
  joinedCount: user.joinedCount,
  locationPublic: user.locationPublic,
  hostedActivitiesPublic: user.hostedActivitiesPublic,
  joinedActivitiesPublic: user.joinedActivitiesPublic,
});

router.get('/me', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(userPayload(user));
});

router.patch(
  '/me/profile-photo',
  auth,
  body('profilePictureUrl').isString().matches(imageUrlPattern).withMessage('Use a JPEG, PNG, or WEBP image URL.'),
  async (req: AuthRequest, res) => {
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
  },
);

router.patch('/me/privacy', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.locationPublic = req.body.locationPublic ?? user.locationPublic;
  user.hostedActivitiesPublic = req.body.hostedActivitiesPublic ?? user.hostedActivitiesPublic;
  user.joinedActivitiesPublic = req.body.joinedActivitiesPublic ?? user.joinedActivitiesPublic;
  await user.save();

  res.json(userPayload(user));
});

router.get('/:id', async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -passwordResetTokenHash -passwordResetExpires');
  if (!user) return res.status(404).json({ message: 'User not found' });

  const hostedActivities = user.hostedActivitiesPublic
    ? await Activity.find({ host: user.id }).sort({ createdAt: -1 }).limit(5).select('title category location date')
    : [];
  const joinedActivities = user.joinedActivitiesPublic
    ? await Activity.find({ participants: user.id }).sort({ createdAt: -1 }).limit(5).select('title category location date')
    : [];

  res.json({
    ...userPayload(user),
    location: user.locationPublic ? user.location : undefined,
    hostedActivities,
    joinedActivities,
  });
});

export default router;
