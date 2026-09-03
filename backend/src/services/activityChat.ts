import { Types } from 'mongoose';
import Chat from '../models/Chat';
import { confirmedActivityMemberIds } from './activityMembership';

export const CANCELLED_ACTIVITY_CHAT_MESSAGE = 'This activity was cancelled. The chat is read-only.';

export const canAccessActivityChat = (activity: any, userId?: string) => Boolean(
  userId && confirmedActivityMemberIds(activity).includes(userId),
);

export const isActivityChatReadOnly = (activity: any, chat?: any) => (
  activity?.status === 'cancelled' || chat?.activityReadOnly === true
);

export const lockActivityChatForCancellation = (activity: any) => {
  const members = confirmedActivityMemberIds(activity).map((memberId) => new Types.ObjectId(memberId));
  return Chat.findOneAndUpdate(
    { activity: activity._id },
    {
      $set: {
        members,
        chatType: activity.visibility === 'private' ? 'privateActivityChat' : 'publicActivityChat',
        activityReadOnly: true,
      },
      $setOnInsert: {
        activity: activity._id,
        messages: [],
        readStates: members.map((member) => ({ user: member, lastReadAt: new Date() })),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

export const appendActivityChatMessage = (
  chatId: string,
  authorId: string,
  message: string,
  sentAt = new Date(),
) => Chat.findOneAndUpdate(
  {
    _id: chatId,
    activity: { $exists: true },
    activityReadOnly: { $ne: true },
  },
  { $push: { messages: { author: new Types.ObjectId(authorId), message, sentAt } } },
  { new: true },
);
