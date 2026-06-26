import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import auth, { AuthRequest } from '../middleware/auth';
import Activity from '../models/Activity';
import User from '../models/User';
import { getJwtSecret } from '../config/security';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();
const allowedCategories = [
  'Wellness',
  'Food',
  'Networking',
  'Adventure',
  'Sports',
  'Fitness',
  'Beach',
  'Nightlife',
  'Travel',
  'Dating & Singles',
  'Culture',
  'Music',
  'Coworking',
  'Other',
];
const participantFields = 'name avatar profilePictureUrl profileThumbnailUrl profileCompleted verified hostRating hostedCount joinedCount location bio aboutMe languages interests ageRange activityRating reviewCount';
const imageUrlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
const allowedHostGenderFilters = ['male', 'female', 'non_binary'];
const activityWriteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } });
const cleanText = (value: unknown, max: number) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max)
  : '';

const publicGenderValue = (user: any) => {
  if (!user?.publicGender || user.gender === 'prefer_not_to_say') return undefined;
  return ['male', 'female', 'non_binary'].includes(user.gender) ? user.gender : undefined;
};

const getRequesterId = (req: express.Request) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return undefined;
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId?: string };
    return decoded.userId;
  } catch {
    return undefined;
  }
};

const idInList = (list: any[] | undefined, id?: string) =>
  Boolean(id && (list || []).some((item) => (item?._id?.toString?.() || item?.toString?.()) === id));

const isBlockedBetween = (first: any, second: any) => {
  const firstBlocked = (first?.blockedUsers || []).some((id: any) => id.toString() === second?.id);
  const secondBlocked = (second?.blockedUsers || []).some((id: any) => id.toString() === first?.id);
  return firstBlocked || secondBlocked;
};

const canAccessActivity = (activity: any, userId?: string, inviteCode?: string) => {
  if (activity.visibility !== 'private') return true;
  if (!userId && !inviteCode) return false;
  if (inviteCode && activity.inviteCode && inviteCode === activity.inviteCode) return true;
  return (
    idInList([activity.host], userId) ||
    idInList(activity.participants, userId) ||
    idInList(activity.pendingParticipants, userId) ||
    idInList(activity.declinedParticipants, userId) ||
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

const publicPersonPayload = (user: any) => ({
  id: user?.id || user?._id?.toString(),
  name: user?.name,
  avatar: user?.profileThumbnailUrl || user?.profilePictureUrl || (user?.profileCompleted ? user?.avatar : undefined),
  profilePictureUrl: user?.profilePictureUrl,
  profileThumbnailUrl: user?.profileThumbnailUrl,
  verified: user?.verified,
  gender: publicGenderValue(user),
  hostRating: user?.hostRating,
  hostedCount: user?.hostedCount,
  joinedCount: user?.joinedCount,
  reviewCount: user?.reviewCount,
});

const activityPayload = (activity: any, viewerId?: string) => {
  const isHost = activity.host?._id?.toString?.() === viewerId || activity.host?.toString?.() === viewerId;
  const participants = activity.participants || [];
  const pendingParticipants = activity.pendingParticipants || [];
  const declinedParticipants = activity.declinedParticipants || [];
  const waitlist = activity.waitlist || [];
  const viewerPending = idInList(pendingParticipants, viewerId);
  const viewerDeclined = idInList(declinedParticipants, viewerId);
  const viewerWaitlisted = idInList(waitlist, viewerId);
  const safePayload: any = {
    ...activity.toObject(),
    host: publicPersonPayload(activity.host),
    participants: participants.map(publicPersonPayload),
    participantCount: participants.length,
    spotsLeft: activity.maxAttendees ? Math.max(activity.maxAttendees - participants.length, 0) : undefined,
  };

  delete safePayload.pendingParticipants;
  delete safePayload.declinedParticipants;
  delete safePayload.waitlist;
  delete safePayload.invitedUsers;
  delete safePayload.inviteCode;

  if (!isHost && !idInList(participants, viewerId)) {
    delete safePayload.exactAddress;
  }

  if (isHost) {
    safePayload.pendingParticipants = pendingParticipants.map(publicPersonPayload);
    safePayload.declinedParticipants = declinedParticipants.map(publicPersonPayload);
    safePayload.waitlist = waitlist.map(publicPersonPayload);
  } else {
    safePayload.viewerJoinStatus = viewerPending
      ? 'pending'
      : viewerDeclined
        ? 'declined'
        : viewerWaitlisted
          ? 'waitlisted'
          : undefined;
  }

  return safePayload;
};

router.get('/', async (req, res) => {
  const userId = getRequesterId(req);
  const hostGender = typeof req.query.hostGender === 'string' ? req.query.hostGender : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const activities = await Activity.find({ visibility: 'public' })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('host', `${participantFields} gender publicGender`)
    .populate('participants', 'name avatar profilePictureUrl profileThumbnailUrl profileCompleted verified');
  const filteredActivities = allowedHostGenderFilters.includes(hostGender || '')
    ? activities.filter((activity) => publicGenderValue(activity.host) === hostGender)
    : activities;
  res.json(filteredActivities.map((activity) => activityPayload(activity, userId)));
});

router.post(
  '/',
  auth,
  activityWriteLimiter,
  body('title').isString().trim().isLength({ min: 3, max: 120 }),
  body('category').optional().isString().isIn(allowedCategories),
  body('location').isString().trim().isLength({ min: 2, max: 120 }),
  body('description').isString().trim().isLength({ min: 20, max: 3000 }),
  body('date').isISO8601(),
  body('maxAttendees').isInt({ min: 2 }),
  body('coverImage').optional({ checkFalsy: true }).custom((value) => imageUrlPattern.test(value)),
  body('galleryImages').optional().isArray({ max: 5 }),
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
    const gallery = Array.isArray(galleryImages) ? galleryImages.map((image) => String(image).trim()).filter(Boolean).slice(0, 5) : [];
    if (coverImage && !imageUrlPattern.test(String(coverImage))) {
      return res.status(400).json({ message: 'Use a valid JPEG, PNG, or WEBP cover image URL.' });
    }
    if (gallery.some((image) => !imageUrlPattern.test(image))) {
      return res.status(400).json({ message: 'Gallery images must be valid JPEG, PNG, or WEBP URLs.' });
    }

    const activity = new Activity({
      title: cleanText(title, 120),
      category: allowedCategories.includes(category) ? category : 'Other',
      location: cleanText(location, 120),
      description: cleanText(description, 3000),
      date: date ? new Date(date) : new Date(),
      vibe: cleanText(vibe, 80),
      coverImage,
      galleryImages: gallery,
      maxAttendees,
      visibility: visibility === 'private' ? 'private' : 'public',
      joinApproval: joinApproval === 'manual' ? 'manual' : 'auto',
      status: 'active',
      inviteCode: Math.random().toString(36).slice(2, 12),
      venueName: cleanText(venueName, 120),
      exactAddress: cleanText(exactAddress, 240),
      startTime: cleanText(startTime, 40),
      endTime: cleanText(endTime, 40),
      costType: costType === 'Paid' ? 'Paid' : 'Free',
      costAmount: costType === 'Paid' ? Number(costAmount || 0) : 0,
      currency: currency || 'AUD',
      hostNote: cleanText(hostNote, 500),
      cancellationPolicy: cleanText(cancellationPolicy, 500),
      host: req.userId,
      participants: [req.userId],
    });

    await activity.save();
    const populated = await Activity.findById(activity.id)
      .populate('host', `${participantFields} gender publicGender`)
      .populate('participants', participantFields);
    res.status(201).json(activityPayload(populated || activity, req.userId));
  }
);

router.get('/:id', async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Activity not found' });
  }

  const userId = getRequesterId(req);
  const activity = await Activity.findById(req.params.id)
    .populate('host', `${participantFields} gender publicGender`)
    .populate('participants', participantFields)
    .populate('pendingParticipants', participantFields)
    .populate('declinedParticipants', participantFields)
    .populate('waitlist', participantFields);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (!canAccessActivity(activity, userId, req.query.inviteCode as string | undefined)) {
    return res.status(403).json({ message: 'This private activity is invite-only.' });
  }
  res.json(activityPayload(activity, userId));
});

router.post('/:id/join', auth, activityWriteLimiter, async (req: AuthRequest, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Activity not found' });
  }

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
  const currentMembers = await User.find({ _id: { $in: [activity.host, ...(activity.participants || [])] } }).select('blockedUsers');
  if (currentMembers.some((member) => member.id !== req.userId && isBlockedBetween(user, member))) {
    return res.status(403).json({ message: 'You cannot join this activity.' });
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
  if (activity.declinedParticipants?.some((participant) => participant.toString() === req.userId)) {
    return res.json({ status: 'declined', message: 'Request declined.' });
  }
  if (activity.maxAttendees && activity.participants.length >= activity.maxAttendees) {
    if (!activity.waitlist?.some((participant) => participant.toString() === req.userId)) {
      activity.waitlist = [...(activity.waitlist || []), req.userId as any];
      await activity.save();
    }
    return res.json({ status: 'waitlisted', message: 'Activity full. You joined the waitlist.' });
  }

  if ((activity.joinApproval === 'manual' || activity.visibility === 'private') && activity.host.toString() !== req.userId) {
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
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Activity not found' });
  }

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
router.post('/:id/approve/:userId', auth, activityWriteLimiter, async (req: AuthRequest, res) => {
  if (!Types.ObjectId.isValid(req.params.id) || !Types.ObjectId.isValid(req.params.userId)) {
    return res.status(404).json({ message: 'Activity or user not found' });
  }

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (activity.host.toString() !== req.userId) return res.status(403).json({ message: 'Only the host can approve requests.' });
  if (activity.maxAttendees && activity.participants.length >= activity.maxAttendees) return res.status(400).json({ message: 'Activity is full.' });

  activity.pendingParticipants = (activity.pendingParticipants || []).filter((id) => id.toString() !== req.params.userId);
  activity.declinedParticipants = (activity.declinedParticipants || []).filter((id) => id.toString() !== req.params.userId);
  if (!idInList(activity.participants, req.params.userId)) {
    activity.participants.push(req.params.userId as any);
  }
  updateCapacityStatus(activity);
  await activity.save();
  res.json({ message: 'Join request approved.' });
});

// Host-only endpoint for declining a manual join request.
router.post('/:id/decline/:userId', auth, activityWriteLimiter, async (req: AuthRequest, res) => {
  if (!Types.ObjectId.isValid(req.params.id) || !Types.ObjectId.isValid(req.params.userId)) {
    return res.status(404).json({ message: 'Activity or user not found' });
  }

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (activity.host.toString() !== req.userId) return res.status(403).json({ message: 'Only the host can decline requests.' });

  activity.pendingParticipants = (activity.pendingParticipants || []).filter((id) => id.toString() !== req.params.userId);
  if (!idInList(activity.declinedParticipants, req.params.userId)) {
    activity.declinedParticipants = [...(activity.declinedParticipants || []), req.params.userId as any];
  }
  await activity.save();
  res.json({ message: 'Join request declined.' });
});

// Host-only cancellation endpoint. Cancelled activities remain readable but cannot be joined.
router.post('/:id/cancel', auth, async (req: AuthRequest, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Activity not found' });
  }

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (activity.host.toString() !== req.userId) return res.status(403).json({ message: 'Only the host can cancel this activity.' });

  activity.status = 'cancelled';
  activity.cancellationReason = typeof req.body.reason === 'string' ? req.body.reason.slice(0, 500) : undefined;
  await activity.save();
  res.json({ message: 'Activity cancelled.' });
});

export default router;
