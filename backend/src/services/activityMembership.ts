import { FilterQuery, Types } from 'mongoose';
import Activity, { IActivity } from '../models/Activity';

export type MembershipState = 'participant' | 'pending' | 'declined' | 'waitlisted' | 'none';
export type AtomicAccessFilter = FilterQuery<IActivity>;

const objectId = (value: string) => new Types.ObjectId(value);
const ids = (values: any[] | undefined) => (values || []).map((value) => value?._id?.toString?.() || value?.toString?.());


export const membershipState = (activity: Partial<IActivity>, userId: string): MembershipState => {
  if (ids(activity.participants).includes(userId)) return 'participant';
  if (ids(activity.pendingParticipants).includes(userId)) return 'pending';
  if (ids(activity.declinedParticipants).includes(userId)) return 'declined';
  if (ids(activity.waitlist).includes(userId)) return 'waitlisted';
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

const lifecycleFilter = (now: Date) => ({
  status: { $in: ['active', 'full'] },
  date: { $gt: now },
});

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
