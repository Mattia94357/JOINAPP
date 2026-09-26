import User from '../models/User';
import Activity from '../models/Activity';
import Moment from '../models/Moment';
import MomentComment from '../models/MomentComment';
import UserReport from '../models/UserReport';
import { activeUserFilter } from './blocking';
import { canAccessActivity, canAccessPrivateParticipantContent } from '../utils/activityPrivacy';

export const reportReasons = ['Spam', 'Harassment', 'Hate or discrimination', 'Unsafe behavior', 'Inappropriate content', 'Other'];
export const submitReport = async (reporter: string, targetType: unknown, targetId: string, reason: unknown, detail: unknown) => {
  if (!['user', 'activity', 'moment', 'comment'].includes(targetType as string)
    || typeof reason !== 'string' || !reportReasons.includes(reason)
    || (detail !== undefined && (typeof detail !== 'string' || detail.length > 1000))) {
    return { status: 400, message: 'Choose a valid report reason and use at most 1000 detail characters.' };
  }
  let owner: any;
  let activity: any;
  let exists = false;
  if (targetType === 'user') {
    const user = await User.findOne({ _id: targetId, ...activeUserFilter });
    exists = Boolean(user); owner = user?._id;
  } else if (targetType === 'activity') {
    activity = await Activity.findById(targetId);
    exists = Boolean(activity && canAccessActivity(activity, reporter)); owner = activity?.host;
  } else {
    const comment = targetType === 'comment' ? await MomentComment.findById(targetId) : null;
    const moment = await Moment.findById(targetType === 'moment' ? targetId : comment?.moment);
    activity = moment ? await Activity.findById(moment.activity) : null;
    exists = Boolean(moment && activity && canAccessPrivateParticipantContent(activity, reporter));
    owner = targetType === 'comment' ? comment?.author : moment?.creator;
  }
  if (!exists || !owner) return { status: 404, message: 'Report target not found.' };
  if (owner.toString() === reporter) return { status: 400, message: 'You cannot report yourself or your own content.' };
  await UserReport.init(); // Ensure concurrent first submissions have the deduplication index.
  try {
    const result = await UserReport.updateOne({ reporter, targetType, targetId }, { $setOnInsert: {
      reporter, targetType, targetId, reportedUser: owner, reason, detail: typeof detail === 'string' ? detail.trim() : undefined, status: 'open',
    } }, { upsert: true, runValidators: true });
    return { status: result.upsertedCount ? 201 : 200, message: 'Report submitted.' };
  } catch (error: any) {
    if (error?.code === 11000) return { status: 200, message: 'Report submitted.' };
    throw error;
  }
};
