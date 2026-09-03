import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import auth, { AuthRequest } from '../middleware/auth';
import Activity from '../models/Activity';
import User from '../models/User';
import { lockActivityChatForCancellation } from '../services/activityChat';
import { getJwtSecret } from '../config/security';
import { rateLimit } from 'express-rate-limit';
import {
  effectiveActivityStatus,
  isScheduledStartInFuture,
  participationClosureReason,
  upcomingActivityFilter,
} from '../utils/activityLifecycle';
import { completeActivityIfPast, completePastActivities } from '../services/activityCompletion';
import {
  canAccessActivity,
  generateActivityInviteCode,
  idInActivityList,
  sanitizeActivityPrivacy,
} from '../utils/activityPrivacy';
import {
  addPendingJoin,
  addWaitlistedJoin,
  approvalMembershipIssue,
  approvePendingJoin,
  confirmDirectJoin,
  declinePendingJoin,
  hasAvailableCapacity,
  leaveUpcomingActivity,
  membershipState,
  withdrawPendingJoin,
} from '../services/activityMembership';

const router = express.Router();
type ActivityIdParams = { id: string };
type ActivityApprovalParams = { id: string; userId: string };
type CreateActivityBody = {
  title: string;
  category?: string;
  location: string;
  locationName?: string;
  latitude?: number | string;
  longitude?: number | string;
  isApproximateLocation?: boolean;
  locationPrivacy?: string;
  description: string;
  date?: string;
  ageGroup?: string;
  vibe?: string;
  coverImage?: string;
  maxAttendees: number;
  venueName?: string;
  exactAddress?: string;
  startTime?: string;
  endTime?: string;
  costType?: string;
  costAmount?: number | string;
  currency?: string;
  hostNote?: string;
  cancellationPolicy?: string;
  visibility?: string;
  joinApproval?: string;
  galleryImages?: unknown;
};
type CancelActivityBody = {
  reason?: unknown;
};
type PrivateAccessBody = {
  inviteCode?: string;
};
const allowedCategories = [
  'Wellness',
  'Food',
  'Drinks',
  'Networking',
  'Outdoors',
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

const idInList = idInActivityList;

const isBlockedBetween = (first: any, second: any) => {
  const firstBlocked = (first?.blockedUsers || []).some((id: any) => id.toString() === second?.id);
  const secondBlocked = (second?.blockedUsers || []).some((id: any) => id.toString() === first?.id);
  return firstBlocked || secondBlocked;
};

const privateMutationAccessFilter = (activity: any, userId: string, inviteCode?: string) => {
  if (activity.visibility !== 'private') return {};
  const userObjectId = new Types.ObjectId(userId);
  return {
    $or: [
      { host: userObjectId },
      { participants: userObjectId },
      { pendingParticipants: userObjectId },
      { invitedUsers: userObjectId },
      ...(inviteCode ? [{ inviteCode }] : []),
    ],
  };
};

const populatedActivity = (activityId: string) => Activity.findById(activityId)
  .populate('host', `${participantFields} gender publicGender`)
  .populate('participants', participantFields)
  .populate('pendingParticipants', participantFields)
  .populate('declinedParticipants', participantFields)
  .populate('waitlist', participantFields);

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

const activityPayload = (activity: any, viewerId?: string, options: { includeHostInviteCode?: boolean } = {}) => {
  const isHost = activity.host?._id?.toString?.() === viewerId || activity.host?.toString?.() === viewerId;
  const participants = activity.participants || [];
  const pendingParticipants = activity.pendingParticipants || [];
  const declinedParticipants = activity.declinedParticipants || [];
  const waitlist = activity.waitlist || [];
  const viewerPending = idInList(pendingParticipants, viewerId);
  const viewerDeclined = idInList(declinedParticipants, viewerId);
  const viewerWaitlisted = idInList(waitlist, viewerId);
  const safePayload: any = sanitizeActivityPrivacy({
    ...activity.toObject(),
    status: effectiveActivityStatus(activity),
    host: publicPersonPayload(activity.host),
    participants: participants.map(publicPersonPayload),
    participantCount: participants.length,
    spotsLeft: activity.maxAttendees ? Math.max(activity.maxAttendees - participants.length, 0) : undefined,
  }, activity, viewerId, options);

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
  const now = new Date();
  await completePastActivities(now, { visibility: 'public' });
  const userId = getRequesterId(req);
  const hostGender = typeof req.query.hostGender === 'string' ? req.query.hostGender : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const activities = await Activity.find({ visibility: 'public', ...upcomingActivityFilter(now) })
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
  body('locationName').optional({ checkFalsy: true }).isString().trim().isLength({ max: 120 }),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('isApproximateLocation').optional().isBoolean(),
  body('locationPrivacy').optional().isIn(['public', 'approximate', 'private']),
  body('description').isString().trim().isLength({ min: 20, max: 3000 }),
  body('date').isISO8601(),
  body('ageGroup').optional().isIn(['any', '18-24', '25-34', '35-44', '45+']),
  body('maxAttendees').isInt({ min: 2 }),
  body('coverImage').optional({ checkFalsy: true }).custom((value) => imageUrlPattern.test(value)),
  body('galleryImages').optional().isArray({ max: 5 }),
  async (req: AuthRequest<Record<string, never>, unknown, CreateActivityBody>, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      title,
      category,
      location,
      locationName,
      latitude,
      longitude,
      isApproximateLocation,
      locationPrivacy,
      description,
      date,
      ageGroup,
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
    const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
    const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';
    if (hasLatitude !== hasLongitude) {
      return res.status(400).json({ message: 'Both latitude and longitude are required for an activity location.' });
    }
    const normalizedLatitude = hasLatitude ? Number(latitude) : undefined;
    const normalizedLongitude = hasLongitude ? Number(longitude) : undefined;
    const scheduledDate = new Date(date as string);
    if (!isScheduledStartInFuture(scheduledDate)) {
      return res.status(400).json({ message: 'Activity start time must be in the future.' });
    }
    const gallery = Array.isArray(galleryImages) ? galleryImages.map((image) => String(image).trim()).filter(Boolean).slice(0, 5) : [];
    if (coverImage && !imageUrlPattern.test(String(coverImage))) {
      return res.status(400).json({ message: 'Use a valid JPEG, PNG, or WEBP cover image URL.' });
    }
    if (gallery.some((image) => !imageUrlPattern.test(image))) {
      return res.status(400).json({ message: 'Gallery images must be valid JPEG, PNG, or WEBP URLs.' });
    }

    const activity = new Activity({
      title: cleanText(title, 120),
      category: category && allowedCategories.includes(category) ? category : 'Other',
      location: cleanText(location, 120),
      locationName: cleanText(locationName || venueName || location, 120),
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      isApproximateLocation: Boolean(isApproximateLocation),
      locationPrivacy: ['public', 'approximate', 'private'].includes(locationPrivacy || '')
        ? locationPrivacy
        : 'public',
      description: cleanText(description, 3000),
      date: scheduledDate,
      ageGroup: ['18-24', '25-34', '35-44', '45+'].includes(ageGroup || '') ? ageGroup : 'any',
      vibe: cleanText(vibe, 80),
      coverImage,
      galleryImages: gallery,
      maxAttendees,
      visibility: visibility === 'private' ? 'private' : 'public',
      joinApproval: joinApproval === 'manual' ? 'manual' : 'auto',
      status: 'active',
      inviteCode: visibility === 'private' ? generateActivityInviteCode() : undefined,
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
    res.status(201).json(activityPayload(populated || activity, req.userId, { includeHostInviteCode: true }));
  }
);

router.get('/:id', async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Activity not found' });
  }

  const userId = getRequesterId(req);
  await completeActivityIfPast(req.params.id);
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
  res.json(activityPayload(activity, userId, { includeHostInviteCode: true }));
});

router.post(
  '/:id/join',
  auth,
  activityWriteLimiter,
  body('inviteCode').optional().isString().isLength({ min: 1, max: 128 }),
  async (req: AuthRequest<ActivityIdParams, unknown, PrivateAccessBody>, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid private activity invite code.' });
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Activity not found' });
  }

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const requesterId = req.userId as string;

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (!canAccessActivity(activity, req.userId, req.body.inviteCode)) {
    return res.status(403).json({ message: 'A valid invitation is required to join this private activity.' });
  }
  if (!user.profileCompleted || !user.profilePictureUrl) {
    return res.status(403).json({
      code: 'PROFILE_PHOTO_REQUIRED',
      message: 'Profile photos are required before joining activities so everyone can see who is attending.',
    });
  }
  const host = await User.findById(activity.host);
  if (host && isBlockedBetween(user, host)) {
    return res.status(403).json({ message: 'You cannot join this activity.' });
  }
  const currentMembers = await User.find({ _id: { $in: [activity.host, ...(activity.participants || [])] } }).select('blockedUsers');
  if (currentMembers.some((member) => member.id !== req.userId && isBlockedBetween(user, member))) {
    return res.status(403).json({ message: 'You cannot join this activity.' });
  }
  const closureReason = participationClosureReason(activity);
  if (closureReason === 'cancelled') return res.status(400).json({ message: 'This activity has been cancelled.' });
  if (closureReason === 'completed') return res.status(400).json({ message: 'This activity has been completed and can no longer be joined.' });
  if (closureReason === 'started') {
    await completeActivityIfPast(activity.id);
    return res.status(400).json({ message: 'This activity has already started and can no longer be joined.' });
  }

  const currentState = membershipState(activity, requesterId);
  if (currentState === 'participant') return res.status(409).json({ message: 'Already joined.' });
  if (currentState === 'pending') return res.json({ status: 'pending', message: 'Pending approval.' });
  if (currentState === 'declined') return res.json({ status: 'declined', message: 'Request declined.' });
  if (currentState === 'waitlisted') return res.json({ status: 'waitlisted', message: 'Already on the waitlist.' });

  const now = new Date();
  const accessFilter = privateMutationAccessFilter(activity, requesterId, req.body.inviteCode);
  const requiresApproval = (activity.joinApproval === 'manual' || activity.visibility === 'private')
    && activity.host.toString() !== req.userId;
  const updated = requiresApproval
    ? await addPendingJoin(activity.id, requesterId, accessFilter, now)
    : await confirmDirectJoin(activity.id, requesterId, accessFilter, now);

  if (updated) {
    if (requiresApproval) return res.json({ status: 'pending', message: 'Join request sent.' });
    const populated = await populatedActivity(updated.id);
    return res.json(activityPayload(populated || updated, req.userId));
  }

  const latest = await Activity.findById(activity.id);
  if (!latest) return res.status(404).json({ message: 'Activity not found' });
  if (!canAccessActivity(latest, req.userId, req.body.inviteCode)) {
    return res.status(403).json({ message: 'A valid invitation is required to join this private activity.' });
  }
  const latestClosure = participationClosureReason(latest, now);
  if (latestClosure === 'cancelled') return res.status(400).json({ message: 'This activity has been cancelled.' });
  if (latestClosure === 'completed') return res.status(400).json({ message: 'This activity has been completed and can no longer be joined.' });
  if (latestClosure === 'started') return res.status(400).json({ message: 'This activity has already started and can no longer be joined.' });

  const latestState = membershipState(latest, requesterId);
  if (latestState === 'participant') return res.status(409).json({ message: 'Already joined.' });
  if (latestState === 'pending') return res.json({ status: 'pending', message: 'Pending approval.' });
  if (latestState === 'declined') return res.json({ status: 'declined', message: 'Request declined.' });
  if (latestState === 'waitlisted') return res.json({ status: 'waitlisted', message: 'Already on the waitlist.' });

  if (!hasAvailableCapacity(latest)) {
    const waitlisted = await addWaitlistedJoin(activity.id, requesterId, accessFilter, now);
    if (waitlisted) return res.json({ status: 'waitlisted', message: 'Activity full. You joined the waitlist.' });
    const finalState = await Activity.findById(activity.id);
    if (finalState && membershipState(finalState, requesterId) === 'participant') {
      return res.status(409).json({ message: 'Already joined.' });
    }
    if (finalState && membershipState(finalState, requesterId) === 'waitlisted') {
      return res.json({ status: 'waitlisted', message: 'Already on the waitlist.' });
    }
  }

  return res.status(409).json({ message: 'Activity membership changed. Please try again.' });
});

// Lets a signed-in user explicitly save an activity without joining it.
router.post(
  '/:id/save',
  auth,
  body('inviteCode').optional().isString().isLength({ min: 1, max: 128 }),
  async (req: AuthRequest<ActivityIdParams, unknown, PrivateAccessBody>, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid private activity invite code.' });
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Activity not found' });
  }

  const user = await User.findById(req.userId);
  const activity = await Activity.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (!canAccessActivity(activity, req.userId, req.body.inviteCode)) {
    return res.status(403).json({ message: 'You do not have access to save this private activity.' });
  }

  const saved = idInList(user.savedActivities, req.params.id);
  user.savedActivities = saved
    ? (user.savedActivities || []).filter((id) => id.toString() !== req.params.id)
    : [...(user.savedActivities || []), activity._id];
  await user.save();
  res.json({ saved: !saved, savedActivities: user.savedActivities });
});

// A confirmed non-host participant may leave only before the activity starts.
router.post('/:id/leave', auth, activityWriteLimiter, async (req: AuthRequest<ActivityIdParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Activity not found' });
  }

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  const requesterId = req.userId as string;
  if (!canAccessActivity(activity, requesterId)) {
    return res.status(403).json({ message: 'You do not have access to this private activity.' });
  }
  if (activity.host.toString() === requesterId) {
    return res.status(403).json({ message: 'Hosts cannot leave their own activity.' });
  }

  const closureReason = participationClosureReason(activity);
  if (closureReason === 'cancelled') return res.status(400).json({ message: 'You cannot leave a cancelled activity.' });
  if (closureReason === 'completed') return res.status(400).json({ message: 'You cannot leave a completed activity.' });
  if (closureReason === 'started') {
    await completeActivityIfPast(activity.id);
    return res.status(400).json({ message: 'You cannot leave after the activity has started.' });
  }
  if (membershipState(activity, requesterId) !== 'participant') {
    return res.status(409).json({ message: 'You are not a confirmed participant in this activity.' });
  }

  const now = new Date();
  const updated = await leaveUpcomingActivity(activity.id, requesterId, now);
  if (updated) {
    return res.json({
      status: 'left',
      message: 'You left the activity.',
      activityStatus: effectiveActivityStatus(updated, now),
      participantCount: updated.participants.length,
    });
  }

  const latest = await Activity.findById(activity.id);
  if (!latest) return res.status(404).json({ message: 'Activity not found' });
  const latestClosure = participationClosureReason(latest, now);
  if (latestClosure === 'cancelled') return res.status(400).json({ message: 'You cannot leave a cancelled activity.' });
  if (latestClosure === 'completed') return res.status(400).json({ message: 'You cannot leave a completed activity.' });
  if (latestClosure === 'started') return res.status(400).json({ message: 'You cannot leave after the activity has started.' });
  if (latest.host.toString() === requesterId) return res.status(403).json({ message: 'Hosts cannot leave their own activity.' });
  return res.status(409).json({ message: 'You are no longer a confirmed participant in this activity.' });
});

// A requester may atomically withdraw only their own still-pending request.
router.post('/:id/withdraw', auth, activityWriteLimiter, async (req: AuthRequest<ActivityIdParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Activity not found' });
  }

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  const requesterId = req.userId as string;
  if (!canAccessActivity(activity, requesterId)) {
    return res.status(403).json({ message: 'You do not have access to this private activity.' });
  }
  const closureReason = participationClosureReason(activity);
  if (closureReason === 'cancelled') return res.status(400).json({ message: 'You cannot withdraw a request from a cancelled activity.' });
  if (closureReason === 'completed') return res.status(400).json({ message: 'You cannot withdraw a request from a completed activity.' });
  if (closureReason === 'started') {
    await completeActivityIfPast(activity.id);
    return res.status(400).json({ message: 'You cannot withdraw a request after the activity has started.' });
  }
  if (membershipState(activity, requesterId) !== 'pending') {
    return res.status(409).json({ message: 'You do not have a pending request for this activity.' });
  }

  const now = new Date();
  const updated = await withdrawPendingJoin(activity.id, requesterId, now);
  if (updated) return res.json({ status: 'withdrawn', message: 'Join request withdrawn.' });

  const latest = await Activity.findById(activity.id);
  if (!latest) return res.status(404).json({ message: 'Activity not found' });
  const latestClosure = participationClosureReason(latest, now);
  if (latestClosure === 'cancelled') return res.status(400).json({ message: 'You cannot withdraw a request from a cancelled activity.' });
  if (latestClosure === 'completed') return res.status(400).json({ message: 'You cannot withdraw a request from a completed activity.' });
  if (latestClosure === 'started') return res.status(400).json({ message: 'You cannot withdraw a request after the activity has started.' });
  return res.status(409).json({ message: 'This join request is no longer pending.' });
});

// Host-only endpoint for approving a manual join request.
router.post('/:id/approve/:userId', auth, activityWriteLimiter, async (req: AuthRequest<ActivityApprovalParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.id) || !Types.ObjectId.isValid(req.params.userId)) {
    return res.status(404).json({ message: 'Activity or user not found' });
  }

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (activity.host.toString() !== req.userId) return res.status(403).json({ message: 'Only the host can approve requests.' });
  const closureReason = participationClosureReason(activity);
  if (closureReason === 'cancelled') return res.status(400).json({ message: 'Join requests cannot be approved for a cancelled activity.' });
  if (closureReason === 'completed') return res.status(400).json({ message: 'Join requests cannot be approved for a completed activity.' });
  if (closureReason === 'started') {
    await completeActivityIfPast(activity.id);
    return res.status(400).json({ message: 'Join requests cannot be approved after the activity has started.' });
  }
  const targetExists = await User.exists({ _id: req.params.userId });
  const approvalIssue = approvalMembershipIssue(activity, req.params.userId, Boolean(targetExists));
  if (approvalIssue === 'user_not_found') return res.status(404).json({ message: 'User not found.' });
  if (approvalIssue === 'already_confirmed') return res.status(409).json({ message: 'This user is already confirmed.' });
  if (approvalIssue === 'not_pending') return res.status(409).json({ message: 'This join request is no longer pending.' });
  if (approvalIssue === 'full') return res.status(409).json({ message: 'Activity is full.' });

  const now = new Date();
  const approved = await approvePendingJoin(activity.id, req.params.userId, req.userId, now);
  if (approved) return res.json({ message: 'Join request approved.' });

  const latest = await Activity.findById(activity.id);
  if (!latest) return res.status(404).json({ message: 'Activity not found' });
  const latestClosure = participationClosureReason(latest, now);
  if (latestClosure === 'cancelled') return res.status(400).json({ message: 'Join requests cannot be approved for a cancelled activity.' });
  if (latestClosure === 'completed') return res.status(400).json({ message: 'Join requests cannot be approved for a completed activity.' });
  if (latestClosure === 'started') return res.status(400).json({ message: 'Join requests cannot be approved after the activity has started.' });

  const latestState = membershipState(latest, req.params.userId);
  if (latestState === 'participant') return res.status(409).json({ message: 'This user is already confirmed.' });
  if (latestState !== 'pending') return res.status(409).json({ message: 'This join request is no longer pending.' });
  if (!hasAvailableCapacity(latest)) return res.status(409).json({ message: 'Activity is full.' });
  return res.status(409).json({ message: 'Join request changed. Please refresh and try again.' });
});

// Host-only endpoint for declining a manual join request.
router.post('/:id/decline/:userId', auth, activityWriteLimiter, async (req: AuthRequest<ActivityApprovalParams>, res) => {
  if (!Types.ObjectId.isValid(req.params.id) || !Types.ObjectId.isValid(req.params.userId)) {
    return res.status(404).json({ message: 'Activity or user not found' });
  }

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (activity.host.toString() !== req.userId) return res.status(403).json({ message: 'Only the host can decline requests.' });
  const targetExists = await User.exists({ _id: req.params.userId });
  if (!targetExists) return res.status(404).json({ message: 'User not found.' });
  const state = membershipState(activity, req.params.userId);
  if (state === 'participant') return res.status(409).json({ message: 'This user is already confirmed.' });
  if (state !== 'pending') return res.status(409).json({ message: 'This join request is no longer pending.' });

  const declined = await declinePendingJoin(activity.id, req.params.userId, req.userId as string);
  if (declined) return res.json({ message: 'Join request declined.' });
  const latest = await Activity.findById(activity.id);
  if (latest && membershipState(latest, req.params.userId) === 'participant') {
    return res.status(409).json({ message: 'This user is already confirmed.' });
  }
  return res.status(409).json({ message: 'This join request is no longer pending.' });
});

// Host-only cancellation endpoint. Cancelled activities remain readable but cannot be joined.
router.post('/:id/cancel', auth, async (req: AuthRequest<ActivityIdParams, unknown, CancelActivityBody>, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Activity not found' });
  }

  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  if (activity.host.toString() !== req.userId) return res.status(403).json({ message: 'Only the host can cancel this activity.' });

  await lockActivityChatForCancellation(activity);
  activity.status = 'cancelled';
  activity.cancellationReason = typeof req.body.reason === 'string' ? req.body.reason.slice(0, 500) : undefined;
  await activity.save();
  res.json({ message: 'Activity cancelled.' });
});

export default router;
