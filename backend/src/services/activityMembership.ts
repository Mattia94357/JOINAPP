import { FilterQuery, Types } from 'mongoose';
import Activity, { IActivity } from '../models/Activity';
import User from '../models/User';
import { activeUserFilter, isBlockedBetween } from './blocking';
import { appendNotificationEvent } from './notificationEvents';
import { participationClosureReason, upcomingActivityFilter } from '../utils/activityLifecycle';
import { userImageUrls } from './imageAssets';

export type MembershipState = 'participant' | 'pending' | 'declined' | 'waitlisted' | 'none';
export type ViewerJoinStatus = 'host' | MembershipState | 'invited';
export type AtomicAccessFilter = FilterQuery<IActivity>;

const objectId = (value: string) => new Types.ObjectId(value);
const ids = (values: any[] | undefined) => (values || []).map((value) => value?._id?.toString?.() || value?.toString?.());

export const confirmedActivityMemberIds = (activity: Partial<IActivity>) => Array.from(new Set([
  activity.hostDeleted ? undefined : activity.host?._id?.toString?.() || activity.host?.toString?.(),
  ...ids(activity.participants),
].filter(Boolean) as string[]));

export const membershipState = (activity: Partial<IActivity>, userId: string): MembershipState => {
  if (ids(activity.participants).includes(userId)) return 'participant';
  if (ids(activity.pendingParticipants).includes(userId)) return 'pending';
  if (ids(activity.declinedParticipants).includes(userId)) return 'declined';
  if (ids(activity.waitlist).includes(userId)) return 'waitlisted';
  return 'none';
};

export const activityViewerJoinStatus = (
  activity: Partial<IActivity>,
  userId?: string,
): ViewerJoinStatus | undefined => {
  if (!userId) return undefined;
  const hostId = activity.host?._id?.toString?.() || activity.host?.toString?.();
  if (hostId === userId) return 'host';
  const state = membershipState(activity, userId);
  if (state !== 'none') return state;
  if (ids(activity.invitedUsers).includes(userId)) return 'invited';
  return 'none';
};

export const hasAvailableCapacity = (activity: Partial<IActivity>) => (
  !activity.maxAttendees || (activity.participants || []).length < activity.maxAttendees
);

export type ApprovalMembershipIssue = 'user_not_found' | 'already_confirmed' | 'not_pending' | 'full';

export const approvalMembershipIssue = (
  activity: Partial<IActivity>,
  userId: string,
  targetExists: boolean,
): ApprovalMembershipIssue | undefined => {
  if (!targetExists) return 'user_not_found';
  const state = membershipState(activity, userId);
  if (state === 'participant') return 'already_confirmed';
  if (state !== 'pending') return 'not_pending';
  if (!hasAvailableCapacity(activity)) return 'full';
  return undefined;
};

const lifecycleFilter = (now: Date) => upcomingActivityFilter(now);

const noConflictingMembership = (userId: Types.ObjectId) => ({
  participants: { $ne: userId },
  pendingParticipants: { $ne: userId },
  declinedParticipants: { $ne: userId },
  waitlist: { $ne: userId },
});

const participantCount = { $size: { $ifNull: ['$participants', []] } };
const hasCapacityLimit = { $ne: [{ $ifNull: ['$maxAttendees', null] }, null] };
const capacityAvailableExpression = {
  $or: [
    { $not: [hasCapacityLimit] },
    { $lt: [participantCount, '$maxAttendees'] },
  ],
};
const capacityFullExpression = {
  $and: [hasCapacityLimit, { $gte: [participantCount, '$maxAttendees'] }],
};

const withoutUser = (field: string, userId: Types.ObjectId) => ({
  $filter: {
    input: { $ifNull: [`$${field}`, []] },
    as: 'memberId',
    cond: { $ne: ['$$memberId', userId] },
  },
});

const confirmPipeline = (userId: Types.ObjectId) => {
  const nextParticipants = { $setUnion: [{ $ifNull: ['$participants', []] }, [userId]] };
  return [{
    $set: {
      participants: nextParticipants,
      pendingParticipants: withoutUser('pendingParticipants', userId),
      declinedParticipants: withoutUser('declinedParticipants', userId),
      waitlist: withoutUser('waitlist', userId),
      invitedUsers: withoutUser('invitedUsers', userId),
      status: {
        $cond: [
          {
            $and: [
              hasCapacityLimit,
              { $gte: [{ $size: nextParticipants }, '$maxAttendees'] },
            ],
          },
          'full',
          'active',
        ],
      },
    },
  }];
};

export const confirmDirectJoin = (
  activityId: string,
  userId: string,
  accessFilter: AtomicAccessFilter,
  now = new Date(),
) => {
  const userObjectId = objectId(userId);
  return Activity.findOneAndUpdate(
    {
      _id: activityId,
      ...accessFilter,
      ...lifecycleFilter(now),
      ...noConflictingMembership(userObjectId),
      $expr: capacityAvailableExpression,
    },
    confirmPipeline(userObjectId),
    { new: true },
  );
};

export const addPendingJoin = (
  activityId: string,
  userId: string,
  accessFilter: AtomicAccessFilter,
  now = new Date(),
) => {
  const userObjectId = objectId(userId);
  return Activity.findOneAndUpdate(
    {
      _id: activityId,
      ...accessFilter,
      ...lifecycleFilter(now),
      ...noConflictingMembership(userObjectId),
      $expr: capacityAvailableExpression,
    },
    [{ $set: {
      pendingParticipants: { $setUnion: [{ $ifNull: ['$pendingParticipants', []] }, [userObjectId]] },
      notificationEvents: appendNotificationEvent('join_request', userId),
    } }],
    { new: true },
  );
};

export const addWaitlistedJoin = (
  activityId: string,
  userId: string,
  accessFilter: AtomicAccessFilter,
  now = new Date(),
) => {
  const userObjectId = objectId(userId);
  return Activity.findOneAndUpdate(
    {
      _id: activityId,
      ...accessFilter,
      ...lifecycleFilter(now),
      participants: { $ne: userObjectId },
      pendingParticipants: { $ne: userObjectId },
      declinedParticipants: { $ne: userObjectId },
      $expr: capacityFullExpression,
    },
    { $addToSet: { waitlist: userObjectId }, $set: { status: 'full' } },
    { new: true },
  );
};

export const approvePendingJoin = (
  activityId: string,
  userId: string,
  hostId: string,
  now = new Date(),
) => {
  const userObjectId = objectId(userId);
  return Activity.findOneAndUpdate(
    {
      _id: activityId,
      host: objectId(hostId),
      ...lifecycleFilter(now),
      pendingParticipants: userObjectId,
      participants: { $ne: userObjectId },
      $expr: capacityAvailableExpression,
    },
    [{ $set: { ...confirmPipeline(userObjectId)[0].$set,
      notificationEvents: appendNotificationEvent('join_approved', hostId, userId),
    } }],
    { new: true },
  );
};

export const declinePendingJoin = (
  activityId: string,
  userId: string,
  hostId: string,
) => {
  const userObjectId = objectId(userId);
  return Activity.findOneAndUpdate(
    {
      _id: activityId,
      host: objectId(hostId),
      pendingParticipants: userObjectId,
      participants: { $ne: userObjectId },
    },
    [{
      $set: {
        notificationEvents: appendNotificationEvent('join_declined', hostId, userId),
        pendingParticipants: withoutUser('pendingParticipants', userObjectId),
        declinedParticipants: { $setUnion: [{ $ifNull: ['$declinedParticipants', []] }, [userObjectId]] },
        waitlist: withoutUser('waitlist', userObjectId),
        invitedUsers: withoutUser('invitedUsers', userObjectId),
      },
    }],
    { new: true },
  );
};

export const leaveUpcomingActivity = (
  activityId: string,
  userId: string,
  now = new Date(),
) => {
  const userObjectId = objectId(userId);
  const remainingParticipants = withoutUser('participants', userObjectId);
  return Activity.findOneAndUpdate(
    {
      _id: activityId,
      host: { $ne: userObjectId },
      ...lifecycleFilter(now),
      participants: userObjectId,
    },
    [{
      $set: {
        participants: remainingParticipants,
        pendingParticipants: withoutUser('pendingParticipants', userObjectId),
        declinedParticipants: withoutUser('declinedParticipants', userObjectId),
        waitlist: withoutUser('waitlist', userObjectId),
        status: {
          $cond: [
            {
              $and: [
                hasCapacityLimit,
                { $gte: [{ $size: remainingParticipants }, '$maxAttendees'] },
              ],
            },
            'full',
            'active',
          ],
        },
      },
    }],
    { new: true },
  );
};

export const removeConfirmedParticipant = (
  activityId: string,
  targetUserId: string,
  hostId: string,
  now = new Date(),
) => {
  const targetObjectId = objectId(targetUserId);
  const hostObjectId = objectId(hostId);
  const remainingParticipants = withoutUser('participants', targetObjectId);
  return Activity.findOneAndUpdate(
    {
      _id: activityId,
      host: hostObjectId,
      ...lifecycleFilter(now),
      participants: targetObjectId,
      $expr: { $ne: ['$host', targetObjectId] },
    },
    [{
      $set: {
        notificationEvents: appendNotificationEvent('participant_removed', hostId, targetUserId),
        participants: remainingParticipants,
        status: {
          $cond: [
            {
              $and: [
                hasCapacityLimit,
                { $gte: [{ $size: remainingParticipants }, '$maxAttendees'] },
              ],
            },
            'full',
            'active',
          ],
        },
      },
    }],
    { new: true },
  );
};

export type WaitlistPromotionResult = {
  activity: IActivity | null;
  promotedUserIds: string[];
};

// Re-read both directions of every current member's block relationship.
export const isMembershipEligible = async (activity: Partial<IActivity>, candidateId: string) => {
  const memberIds = confirmedActivityMemberIds(activity);
  const users = await User.find({ _id: { $in: [...memberIds, candidateId] }, ...activeUserFilter }).select('_id blockedUsers profileCompleted profileImage +profilePictureUrl');
  const candidate = users.find((user) => user._id.toString() === candidateId);
  const hostId = activity.host?.toString();
  if (!candidate?.profileCompleted || !userImageUrls(candidate).profilePictureUrl
    || !users.some((user) => user._id.toString() === hostId)) return false;
  return !users.some((user) => memberIds.includes(user._id.toString()) && isBlockedBetween(candidate, user));
};

// Claims the current queue head with a conditional single-document update.
// Repeating that claim fills every available place while preserving FIFO order.
export const promoteActivityWaitlist = async (
  activityId: string,
  now?: Date,
): Promise<WaitlistPromotionResult> => {
  const currentTime = () => now ?? new Date();
  let activity = await Activity.findById(activityId);
  const promotedUserIds: string[] = [];

  while (
    activity
    && !participationClosureReason(activity, currentTime())
    && hasAvailableCapacity(activity)
    && (activity.waitlist || []).length > 0
  ) {
    const candidateId = activity.waitlist![0].toString();
    const candidateObjectId = objectId(candidateId);
    const hostId = activity.host.toString();
    const state = membershipState(activity, candidateId);
    const isEligible = candidateId !== hostId && state === 'waitlisted'
      && await isMembershipEligible(activity, candidateId);

    if (!isEligible) {
      const cleaned = await Activity.findOneAndUpdate(
        {
          _id: activityId,
          ...lifecycleFilter(currentTime()),
          'waitlist.0': candidateObjectId,
        },
        { $pull: { waitlist: candidateObjectId } },
        { new: true },
      );
      if (cleaned) {
        activity = cleaned;
        continue;
      }
      const latest = await Activity.findById(activityId);
      if (!latest || latest.waitlist?.[0]?.toString() === candidateId) {
        activity = latest;
        break;
      }
      activity = latest;
      continue;
    }

    const requiresApproval = activity.visibility === 'private' || activity.joinApproval === 'manual';
    const promoted = await Activity.findOneAndUpdate(
      {
        _id: activityId,
        ...lifecycleFilter(currentTime()),
        host: { $ne: candidateObjectId },
        // Do not use eligibility checked against a stale roster or approval policy.
        $and: [
          { host: activity.host },
          { participants: activity.participants },
          { $expr: { $eq: [{ $ifNull: ['$visibility', 'public'] }, activity.visibility ?? 'public'] } },
          { $expr: { $eq: [{ $ifNull: ['$joinApproval', 'auto'] }, activity.joinApproval ?? 'auto'] } },
        ],
        'waitlist.0': candidateObjectId,
        participants: { $ne: candidateObjectId },
        pendingParticipants: { $ne: candidateObjectId },
        declinedParticipants: { $ne: candidateObjectId },
        $expr: capacityAvailableExpression,
      },
      requiresApproval ? [{ $set: {
        pendingParticipants: { $setUnion: [{ $ifNull: ['$pendingParticipants', []] }, [candidateObjectId]] },
        waitlist: withoutUser('waitlist', candidateObjectId),
        notificationEvents: appendNotificationEvent('join_request', candidateId),
      } }] : [{ $set: { ...confirmPipeline(candidateObjectId)[0].$set,
        notificationEvents: appendNotificationEvent('waitlist_promoted', undefined, candidateId),
      } }],
      { new: true },
    );
    if (promoted) {
      if (!requiresApproval) promotedUserIds.push(candidateId);
      activity = promoted;
      continue;
    }

    const latest = await Activity.findById(activityId);
    if (!latest || (
      latest.waitlist?.[0]?.toString() === candidateId
      && hasAvailableCapacity(latest)
      && !participationClosureReason(latest, currentTime())
    )) {
      activity = latest;
      break;
    }
    activity = latest;
  }

  return { activity, promotedUserIds };
};

export const withdrawPendingJoin = (
  activityId: string,
  userId: string,
  now = new Date(),
) => {
  const userObjectId = objectId(userId);
  return Activity.findOneAndUpdate(
    {
      _id: activityId,
      ...lifecycleFilter(now),
      participants: { $ne: userObjectId },
      pendingParticipants: userObjectId,
    },
    [{
      $set: {
        pendingParticipants: withoutUser('pendingParticipants', userObjectId),
      },
    }],
    { new: true },
  );
};

// Removes only the authenticated user's current queue entry. The conflicting
// membership checks make this safe against a simultaneous FIFO promotion: if
// promotion wins, this update cannot remove the newly confirmed participant.
export const withdrawWaitlistedJoin = (
  activityId: string,
  userId: string,
  now = new Date(),
) => {
  const userObjectId = objectId(userId);
  return Activity.findOneAndUpdate(
    {
      _id: activityId,
      ...lifecycleFilter(now),
      host: { $ne: userObjectId },
      participants: { $ne: userObjectId },
      pendingParticipants: { $ne: userObjectId },
      declinedParticipants: { $ne: userObjectId },
      waitlist: userObjectId,
    },
    [{
      $set: {
        waitlist: withoutUser('waitlist', userObjectId),
      },
    }],
    { new: true },
  );
};
