import Activity from '../models/Activity';
import User from '../models/User';
import { activeUserFilter } from './blocking';
import Notification, { notificationTypes, NotificationType } from '../models/Notification';
import { canAccessActivity } from '../utils/activityPrivacy';

export const notificationCopy: Record<NotificationType, [string, string]> = {
  join_request: ['New join request', 'Someone requested to join your activity.'],
  join_approved: ['Join request approved', 'Your request to join an activity was approved.'],
  join_declined: ['Join request declined', 'Your request to join an activity was declined.'],
  waitlist_promoted: ['You have a place', 'You moved from the waitlist to a confirmed place.'],
  participant_removed: ['Participation updated', 'The host removed you from an activity.'],
  activity_cancelled: ['Activity cancelled', 'An activity you were attending was cancelled.'],
  activity_edited: ['Activity details changed', 'The time or location of an activity you are attending changed.'],
};

// Called only with events read from the committed activity outbox, never from
// request bodies. Replays and competing workers converge on one record/user.
export const persistNotificationEvent = async (activityId: string, event: any) => {
  if (!notificationTypes.includes(event.type)) throw new Error('Unknown notification event');
  const type = event.type as NotificationType;
  const recipients = [...new Set<string>((event.recipients || []).map(String))]
    .filter((id) => id !== event.actor?.toString());
  const users = await User.find({ _id: { $in: recipients }, ...activeUserFilter }).select('_id');
  const [title, body] = notificationCopy[type];
  for (const user of users) {
    try {
      await Notification.updateOne(
        { idempotencyKey: `${activityId}:${event._id}:${user._id}` },
        { $setOnInsert: {
          recipient: user._id, actor: event.actor || undefined, type, activity: activityId,
          title, body, readAt: null, createdAt: event.createdAt, pushPending: true,
        } },
        { upsert: true, runValidators: true },
      );
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
  }
};

let draining = false;
export const drainNotificationEvents = async () => {
  if (draining) return;
  draining = true;
  try {
    const activities = await Activity.find({ 'notificationEvents.0': { $exists: true } })
      .select('_id notificationEvents').sort({ 'notificationEvents.createdAt': 1 }).limit(50);
    for (const activity of activities) {
      for (const event of (activity.notificationEvents || []).slice(0, 50)) {
        try {
          await persistNotificationEvent(activity.id, event);
          await Activity.updateOne({ _id: activity._id }, { $pull: { notificationEvents: { _id: event._id } } });
        } catch {
          // Keep the durable event for retry; never undo a successful lifecycle action.
          console.error('[notifications] Event processing failed; will retry', String(event._id));
        }
      }
    }
  } finally { draining = false; }
};

export const startNotificationWorker = async () => {
  await Notification.init(); // Ensure the deduplication index before processing.
  const tick = () => { void drainNotificationEvents().catch(() => console.error('[notifications] Queue unavailable; will retry')); };
  tick();
  const timer = setInterval(tick, 5000);
  timer.unref();
  return timer;
};

// Allowlist response fields. Never serialize the stored document wholesale.
// Resolve access on EVERY read, including old notifications after removal.
export const notificationPayload = (record: any, activity: any, recipient: string) => {
  const accessible = activity && canAccessActivity(activity, recipient);
  const [title, body] = notificationCopy[record.type as NotificationType];
  return {
    id: String(record._id), type: record.type, title, body,
    readAt: record.readAt || null, createdAt: record.createdAt,
    activityTitle: accessible ? activity.title : null,
    target: accessible ? { type: 'activity', activityId: String(activity._id) } : null,
  };
};
