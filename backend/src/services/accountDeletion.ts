import User from '../models/User';
import Activity from '../models/Activity';
import Chat from '../models/Chat';
import Moment from '../models/Moment';
import MomentComment from '../models/MomentComment';
import UserReport from '../models/UserReport';
import Notification from '../models/Notification';
import PushDevice from '../models/PushDevice';
import PushDelivery from '../models/PushDelivery';
import { cancelActivity } from './activityCancellation';
import { completePastActivities } from './activityCompletion';
import { leaveUpcomingActivity, promoteActivityWaitlist } from './activityMembership';
import { participationClosureReason } from '../utils/activityLifecycle';

export const deleteAccount = async (userId: string) => {
  const initial = await User.findById(userId).select('+sessionVersion');
  if (!initial || initial.deletedAt) return;
  // Durable intent disables social/auth access before cleanup. Only deletion may retry.
  await User.updateOne({ _id: userId, deletionStartedAt: { $exists: false } }, { $set: { deletionStartedAt: new Date() } });
  const activities = await Activity.find({ $or: [{ host: userId }, { participants: userId },
    { pendingParticipants: userId }, { waitlist: userId }] }).distinct('_id');
  const authoredMoments = await Moment.find({ creator: userId }).distinct('_id');
  const commentedMoments = await MomentComment.find({ author: userId }).distinct('moment');
  // Store affected IDs BEFORE removing references so retries can repair counts/promotions.
  await User.updateOne({ _id: userId, deletedAt: { $exists: false } }, { $addToSet: {
    deletionActivityIds: { $each: activities }, deletionMomentIds: { $each: [...authoredMoments, ...commentedMoments] },
  } });
  const user = await User.findById(userId).select('+sessionVersion +deletionActivityIds +deletionMomentIds');
  if (!user || user.deletedAt) return;
  const deviceIds = await PushDevice.find({ user: userId }).distinct('_id');
  const notificationIds = await Notification.find({ recipient: userId }).distinct('_id');
  // Delete dependent deliveries first so a retry can still discover their owners.
  await PushDelivery.deleteMany({ $or: [{ user: userId }, { device: { $in: deviceIds } },
    { notification: { $in: notificationIds } }] });
  await PushDevice.deleteMany({ user: userId });
  await completePastActivities(new Date(), { _id: { $in: user.deletionActivityIds || [] } });
  for (const activityId of user.deletionActivityIds || []) {
    const activity = await Activity.findById(activityId);
    if (!activity) continue;
    if (activity.host.toString() === userId) {
      if (!participationClosureReason(activity)) await cancelActivity(activity, userId, 'Host account deleted.', true);
    } else {
      await leaveUpcomingActivity(activity.id, userId);
      await promoteActivityWaitlist(activity.id);
    }
  }
  await Activity.updateMany({}, { $pull: { participants: user._id, pendingParticipants: user._id,
    declinedParticipants: user._id, waitlist: user._id, invitedUsers: user._id } });
  await Activity.updateMany({ host: userId }, { $set: { hostDeleted: true } });
  // No user identity survives in queued notification actors/recipients.
  await Activity.updateMany({ $or: [{ 'notificationEvents.actor': user._id }, { 'notificationEvents.recipients': user._id }] }, [{ $set: {
    notificationEvents: { $map: { input: '$notificationEvents', as: 'event', in: { $mergeObjects: ['$$event', {
      actor: { $cond: [{ $eq: ['$$event.actor', user._id] }, null, '$$event.actor'] },
      recipients: { $setDifference: ['$$event.recipients', [user._id]] },
    }] } } },
  } }]);
  await Chat.deleteMany({ chatType: 'directPrivateChat', $or: [{ members: userId }, { initiatedBy: userId }, { requestRecipient: userId }] });
  await Chat.updateMany({}, { $pull: { members: user._id, messages: { author: user._id }, readStates: { user: user._id } } });
  await Chat.updateMany({ initiatedBy: userId }, { $unset: { initiatedBy: 1 } });
  await Chat.updateMany({ requestRecipient: userId }, { $unset: { requestRecipient: 1 } });
  await MomentComment.deleteMany({ $or: [{ author: userId }, { moment: { $in: authoredMoments } }] });
  await Moment.deleteMany({ creator: userId });
  await Moment.updateMany({ likes: userId }, { $pull: { likes: user._id } });
  for (const momentId of user.deletionMomentIds || []) {
    const count = await MomentComment.countDocuments({ moment: momentId });
    await Moment.updateOne({ _id: momentId }, { $set: { commentCount: count } });
  }
  await User.updateMany({ blockedUsers: userId }, { $pull: { blockedUsers: user._id } });
  await UserReport.deleteMany({ $or: [{ reporter: userId }, { reportedUser: userId }] });
  await Notification.deleteMany({ recipient: userId });
  await Notification.updateMany({ actor: userId }, { $unset: { actor: 1 } });
  // Keep only a non-identifying tombstone for historical host references and retry authentication.
  // Never retain email, photos, password/reset credentials, profile fields, or saved activities.
  await User.collection.replaceOne({ _id: user._id, deletedAt: { $exists: false } }, {
    _id: user._id, name: 'Former JOIN member', email: `deleted-${user.id}@invalid.local`, password: '!deleted',
    sessionVersion: user.sessionVersion ?? 0, deletionStartedAt: user.deletionStartedAt, deletedAt: new Date(),
  });
};
