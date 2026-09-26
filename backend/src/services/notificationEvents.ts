import { Types } from 'mongoose';
import { NotificationType } from '../models/Notification';

// These expressions run in the SAME atomic update as the successful transition.
// Only server lifecycle code supplies subject IDs; recipients come from the
// document before the update. Each committed transition has its own durable ID.
export const notificationEventExpression = (
  type: NotificationType, actorId?: string, subjectId?: string,
) => ({
  _id: new Types.ObjectId(),
  type,
  actor: actorId ? new Types.ObjectId(actorId) : null,
  recipients: type === 'join_request' ? ['$host']
    : subjectId ? [new Types.ObjectId(subjectId)]
      : { $setDifference: [{ $ifNull: ['$participants', []] }, ['$host']] },
  createdAt: new Date(),
});

export const appendNotificationEvent = (type: NotificationType, actorId?: string, subjectId?: string, condition: unknown = true) => ({
  $concatArrays: [
    { $ifNull: ['$notificationEvents', []] },
    { $cond: [condition, [notificationEventExpression(type, actorId, subjectId)], []] },
  ],
});

export const materialEditCondition = (update: Record<string, unknown>) => {
  const fields = ['date', 'endDate', 'location', 'locationName', 'latitude', 'longitude', 'venueName', 'exactAddress'];
  const comparisons = Object.entries(update).filter(([key]) => fields.includes(key))
    .map(([key, value]) => ({ $ne: [{ $ifNull: [`$${key}`, null] }, { $literal: value ?? null }] }));
  return comparisons.length ? { $or: comparisons } : false;
};
