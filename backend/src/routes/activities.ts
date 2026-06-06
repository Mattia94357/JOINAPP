import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import auth, { AuthRequest } from '../middleware/auth';
import Activity from '../models/Activity';
import User from '../models/User';

const router = express.Router();
const participantFields = 'name avatar profilePictureUrl profileThumbnailUrl profileCompleted verified hostRating hostedCount joinedCount location bio aboutMe languages interests nationality ageRange activityRating reviewCount';

const getRequesterId = (req: express.Request) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return undefined;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId?: string };
    return decoded.userId;
  } catch {
    return undefined;
  }
};

const idInList = (list: any[] | undefined, id?: string) =>
  Boolean(id && (list || []).some((item) => item?.toString() === id));

const isBlockedBetween = (first: any, second: any) => {
  const firstBlocked = (first?.blockedUsers || []).some((id: any) => id.toString() === second?.id);
  const secondBlocked = (second?.blockedUsers || []).some((id: any) => id.toString() === first?.id);
  return firstBlocked || secondBlocked;
};

const canAccessActivity = (activity: any, userId?: string, inviteCode?: string) => {
  if (activity.visibility !== 'private') return true;
  if (inviteCode && activity.inviteCode && inviteCode === activity.inviteCode) return true;
  return (
    idInList([activity.host], userId) ||
    idInList(activity.participants, userId) ||
    idInList(activity.pendingParticipants, userId) ||
    idInList(activity.invitedUsers, userId)
  );
};

const updateCapacityStatus = (activity: any) => {
  if (activity.status === 'cancelled' || activity.status === 'completed') return;
  if (activity.maxAttendees && activity.participants.length >= activity.maxAttendees) {
    activity.status = 'full';
  } else {
    activity.status = 'active';
  }
};

router.get('/', async (req, res) => {
  const activities = await Activity.find({ visibility: { $ne: 'private' } })
    .populate('host', participantFields)
    .populate('participants', participantFields);
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
      visibility,
      joinApproval,
      galleryImages,
    } = req.body;
    const activity = new Activity({
      title,
      category,
      location,
      description,
      date: date ? new Date(date) : new Date(),
      vibe,
      coverImage,
      galleryImages: Array.isArray(galleryImages) ? galleryImages.slice(0, 5) : [],
      maxAttendees,
      visibility: visibility === 'private' ? 'private' : 'public',
      joinApproval: joinApproval === 'manual' ? 'manual' : 'auto',
      status: 'active',
      inviteCode: Math.random().toString(36).slice(2, 12),
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
  const userId = getRequesterId(req);
  const activity = await Activity.findById(req.params.id)
    .populate('host', participantFields)
    .populate('participants', participantFields)
    .populate('pendingParticipants', participantFields)
    .populate('waitlist', participantFields);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (!canAccessActivity(activity, userId, req.query.inviteCode as string | undefined)) {
    return res.status(403).json({ message: 'This private activity is invite-only.' });
  }
  res.json(activity);
});

router.post('/:id/join', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!user.profileCompleted || !user.profilePictureUrl) {
    return res.status(403).json({
      code: 'PROFILE_PHOTO_REQUIRED',
      message: 'Profile photos are required before joining activities so everyone can see who is attending.',
    });
  }

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  const host = await User.findById(activity.host);
  if (host && isBlockedBetween(user, host)) {
    return res.status(403).json({ message: 'You cannot join this activity.' });
  }
  if (activity.visibility === 'private' && !idInList(activity.invitedUsers, req.userId) && activity.host.toString() !== req.userId) {
    return res.status(403).json({ message: 'This private activity is invite-only.' });
  }
  if (activity.status === 'cancelled') {
    return res.status(400).json({ message: 'This activity has been cancelled.' });
  }

  if (activity.participants.some((participant) => participant.toString() === req.userId)) {
    return res.status(400).json({ message: 'Already joined' });
  }
  if (activity.pendingParticipants?.some((participant) => participant.toString() === req.userId)) {
    return res.json({ status: 'pending', message: 'Pending approval.' });
  }
  if (activity.maxAttendees && activity.participants.length >= activity.maxAttendees) {
    if (!activity.waitlist?.some((participant) => participant.toString() === req.userId)) {
      activity.waitlist = [...(activity.waitlist || []), req.userId as any];
      await activity.save();
    }
    return res.json({ status: 'waitlisted', message: 'Activity full. You joined the waitlist.' });
  }

  if (activity.joinApproval === 'manual' && activity.host.toString() !== req.userId) {
    activity.pendingParticipants = [...(activity.pendingParticipants || []), req.userId as any];
    await activity.save();
    return res.json({ status: 'pending', message: 'Join request sent.' });
  }

  activity.participants.push(req.userId as any);
  updateCapacityStatus(activity);
  await activity.save();
  res.json(activity);
});

// Lets a signed-in user explicitly save an activity without joining it.
router.post('/:id/save', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  const activity = await Activity.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!activity) return res.status(404).json({ message: 'Activity not found' });

  const saved = idInList(user.savedActivities, req.params.id);
  user.savedActivities = saved
    ? (user.savedActivities || []).filter((id) => id.toString() !== req.params.id)
    : [...(user.savedActivities || []), activity._id];
  await user.save();
  res.json({ saved: !saved, savedActivities: user.savedActivities });
});

// Host-only endpoint for approving a manual join request.
router.post('/:id/approve/:userId', auth, async (req: AuthRequest, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (activity.host.toString() !== req.userId) return res.status(403).json({ message: 'Only the host can approve requests.' });
  if (activity.maxAttendees && activity.participants.length >= activity.maxAttendees) return res.status(400).json({ message: 'Activity is full.' });

  activity.pendingParticipants = (activity.pendingParticipants || []).filter((id) => id.toString() !== req.params.userId);
  if (!idInList(activity.participants, req.params.userId)) {
    activity.participants.push(req.params.userId as any);
  }
  updateCapacityStatus(activity);
  await activity.save();
  res.json({ message: 'Join request approved.' });
});

// Host-only endpoint for declining a manual join request.
router.post('/:id/decline/:userId', auth, async (req: AuthRequest, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (activity.host.toString() !== req.userId) return res.status(403).json({ message: 'Only the host can decline requests.' });

  activity.pendingParticipants = (activity.pendingParticipants || []).filter((id) => id.toString() !== req.params.userId);
  await activity.save();
  res.json({ message: 'Join request declined.' });
});

// Host-only cancellation endpoint. Cancelled activities remain readable but cannot be joined.
router.post('/:id/cancel', auth, async (req: AuthRequest, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (activity.host.toString() !== req.userId) return res.status(403).json({ message: 'Only the host can cancel this activity.' });

  activity.status = 'cancelled';
  activity.cancellationReason = typeof req.body.reason === 'string' ? req.body.reason.slice(0, 500) : undefined;
  await activity.save();
  res.json({ message: 'Activity cancelled.' });
});

export default router;
