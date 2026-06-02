import express from 'express';
import { body, validationResult } from 'express-validator';
import auth, { AuthRequest } from '../middleware/auth';
import Activity from '../models/Activity';
import User from '../models/User';

const router = express.Router();

router.get('/', async (req, res) => {
  const fields = 'name avatar profilePictureUrl profileThumbnailUrl profileCompleted verified hostRating hostedCount joinedCount location bio interests';
  const activities = await Activity.find().populate('host', fields).populate('participants', fields);
  res.json(activities);
});

router.post(
  '/',
  auth,
  body('title').notEmpty(),
  body('category').notEmpty(),
  body('location').notEmpty(),
  body('description').isLength({ min: 20 }),
  body('date').notEmpty(),
  body('maxAttendees').isInt({ min: 2 }),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      title,
      category,
      location,
      description,
      date,
      vibe,
      coverImage,
      maxAttendees,
      venueName,
      exactAddress,
      startTime,
      endTime,
      costType,
      costAmount,
      currency,
      hostNote,
      cancellationPolicy,
    } = req.body;
    const activity = new Activity({
      title,
      category,
      location,
      description,
      date: date ? new Date(date) : new Date(),
      vibe,
      coverImage,
      maxAttendees,
      venueName,
      exactAddress,
      startTime,
      endTime,
      costType: costType === 'Paid' ? 'Paid' : 'Free',
      costAmount: costType === 'Paid' ? Number(costAmount || 0) : 0,
      currency: currency || 'AUD',
      hostNote,
      cancellationPolicy,
      host: req.userId,
      participants: [req.userId],
    });

    await activity.save();
    res.status(201).json(activity);
  }
);

router.get('/:id', async (req, res) => {
  const fields = 'name avatar profilePictureUrl profileThumbnailUrl profileCompleted verified hostRating hostedCount joinedCount location bio interests';
  const activity = await Activity.findById(req.params.id).populate('host', fields).populate('participants', fields);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  res.json(activity);
});

router.post('/:id/join', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!user.profileCompleted || !user.profilePictureUrl) {
    return res.status(403).json({
      code: 'PROFILE_PHOTO_REQUIRED',
      message: 'Add a profile photo before joining. Photos help keep JOIN trusted and transparent.',
    });
  }

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });

  if (activity.participants.some((participant) => participant.toString() === req.userId)) {
    return res.status(400).json({ message: 'Already joined' });
  }

  activity.participants.push(req.userId as any);
  await activity.save();
  res.json(activity);
});

export default router;
