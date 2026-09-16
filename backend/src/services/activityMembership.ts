import { FilterQuery, Types } from 'mongoose';
import Activity, { IActivity } from '../models/Activity';
import User from '../models/User';
import { participationClosureReason, upcomingActivityFilter } from '../utils/activityLifecycle';

export type MembershipState = 'participant' | 'pending' | 'declined' | 'waitlisted' | 'none';
export type ViewerJoinStatus = 'host' | MembershipState | 'invited';
export type AtomicAccessFilter = FilterQuery<IActivity>;

const objectId = (value: string) => new Types.ObjectId(value);
const ids = (values: any[] | undefined) => (values || []).map((value) => value?._id?.toString?.() || value?.toString?.());

export const confirmedActivityMemberIds = (activity: Partial<IActivity>) => Array.from(new Set([
  activity.host?._id?.toString?.() || activity.host?.toString?.(),
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
    { $addToSet: { pendingParticipants: userObjectId } },
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
    confirmPipeline(userObjectId),
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

// Claims the current queue head with a conditional single-document update.
// Repeating that claim fills every available place while preserving FIFO order.
export const promoteActivityWaitlist = async (
  activityId: string,
  now = new Date(),
): Promise<WaitlistPromotionResult> => {
  let activity = await Activity.findById(activityId);
  const promotedUserIds: string[] = [];

  while (
    activity
    && !participationClosureReason(activity, now)
    && hasAvailableCapacity(activity)
    && (activity.waitlist || []).length > 0
  ) {
    const candidateId = activity.waitlist![0].toString();
    const candidateObjectId = objectId(candidateId);
    const hostId = activity.host.toString();
    const state = membershipState(activity, candidateId);
    const candidateExists = await User.exists({ _id: candidateObjectId });
    const isEligible = candidateId !== hostId && state === 'waitlisted' && Boolean(candidateExists);

    if (!isEligible) {
      const cleaned = await Activity.findOneAndUpdate(
        {
          _id: activityId,
          ...lifecycleFilter(now),
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

    const promoted = await Activity.findOneAndUpdate(
      {
        _id: activityId,
        ...lifecycleFilter(now),
        host: { $ne: candidateObjectId },
        'waitlist.0': candidateObjectId,
        participants: { $ne: candidateObjectId },
        pendingParticipants: { $ne: candidateObjectId },
        declinedParticipants: { $ne: candidateObjectId },
        $expr: capacityAvailableExpression,
      },
      confirmPipeline(candidateObjectId),
      { new: true },
    );
    if (promoted) {
      promotedUserIds.push(candidateId);
      activity = promoted;
      continue;
    }

    const latest = await Activity.findById(activityId);
    if (!latest || (
      latest.waitlist?.[0]?.toString() === candidateId
      && hasAvailableCapacity(latest)
      && !participationClosureReason(latest, now)
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
