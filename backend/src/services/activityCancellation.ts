import Activity from '../models/Activity';
import { lockActivityChatForCancellation } from './activityChat';
import { appendNotificationEvent } from './notificationEvents';
import { upcomingActivityFilter } from '../utils/activityLifecycle';

export const cancelActivity = async (activity: any, hostId: string, reason?: string, upcomingOnly = false) => {
  // Lock before cancellation; retries repair a partially completed cancellation.
  await lockActivityChatForCancellation(activity);
  return Activity.findOneAndUpdate({
    _id: activity._id, host: hostId, status: { $ne: 'cancelled' },
    ...(upcomingOnly ? upcomingActivityFilter(new Date()) : {}),
  }, [{ $set: {
    status: 'cancelled', cancellationReason: { $literal: reason?.slice(0, 500) || null },
    notificationEvents: appendNotificationEvent('activity_cancelled', hostId),
  } }], { new: true });
};
