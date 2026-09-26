import { Types } from 'mongoose';
import Chat from '../models/Chat';
import ChatMessage from '../models/ChatMessage';
import Activity from '../models/Activity';
import User from '../models/User';
import { activeUserFilter, isBlockedBetween } from './blocking';
import { canAccessActivityChat } from './activityChat';
import { userImageUrls } from './imageAssets';

const senderFields = 'name profileImage +avatar +profilePictureUrl +profileThumbnailUrl';
const id = (value: any) => value?._id?.toString?.() || value?.toString?.() || '';

export const messagePayload = (message: any) => ({
  id: id(message._id),
  sender: {
    id: id(message.sender),
    name: message.sender?.name || 'Former JOIN member',
    avatar: userImageUrls(message.sender).avatar,
  },
  text: message.text,
  createdAt: message.createdAt,
});

// Safe to call repeatedly and concurrently. Legacy subdocument IDs become stable
// idempotency keys, and the old array is removed only after all upserts succeed.
export const migrateLegacyMessagesForChat = async (chatId: string) => {
  const chat = await Chat.findById(chatId).select('+messages');
  if (!chat?.messages?.length) return;
  await ChatMessage.init();
  try {
    await ChatMessage.bulkWrite(chat.messages.map((legacy: any) => ({
      updateOne: {
        filter: { chat: chat._id, sender: legacy.author, clientMessageId: `legacy:${legacy._id}` },
        update: { $setOnInsert: { chat: chat._id, sender: legacy.author, text: legacy.message,
          clientMessageId: `legacy:${legacy._id}`, createdAt: legacy.sentAt, updatedAt: legacy.sentAt } },
        upsert: true,
        timestamps: false,
      },
    })), { ordered: false });
  } catch (error: any) {
    if (error?.code !== 11000 || error?.writeErrors?.some((item: any) => item?.err?.code !== 11000)) throw error;
  }
  const latest = chat.messages.reduce((date: Date | undefined, item: any) => !date || item.sentAt > date ? item.sentAt : date, undefined);
  await Chat.updateOne({ _id: chat._id }, { $unset: { messages: 1 }, ...(latest ? { $max: { lastMessageAt: latest } } : {}) }, { timestamps: false });
};

export const encodeMessageCursor = (message: any) => Buffer.from(JSON.stringify({
  createdAt: new Date(message.createdAt).toISOString(), id: id(message._id),
})).toString('base64url');

export const decodeMessageCursor = (cursor: unknown) => {
  if (typeof cursor !== 'string' || cursor.length > 200) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const createdAt = new Date(value.createdAt);
    if (Number.isNaN(createdAt.getTime()) || !Types.ObjectId.isValid(value.id)) return undefined;
    return { createdAt, id: new Types.ObjectId(value.id) };
  } catch { return undefined; }
};

const cursorFilter = (cursor: { createdAt: Date; id: Types.ObjectId }, direction: 'before' | 'after') => {
  const operator = direction === 'before' ? '$lt' : '$gt';
  return { $or: [
    { createdAt: { [operator]: cursor.createdAt } },
    { createdAt: cursor.createdAt, _id: { [operator]: cursor.id } },
  ] };
};

export const getMessagePage = async (chatId: string, limit: number, before?: unknown, after?: unknown) => {
  await migrateLegacyMessagesForChat(chatId);
  const beforeCursor = decodeMessageCursor(before);
  const afterCursor = decodeMessageCursor(after);
  const filter: any = { chat: chatId };
  if (before !== undefined && !beforeCursor) throw Object.assign(new Error('Invalid message cursor.'), { status: 400 });
  if (after !== undefined && !afterCursor) throw Object.assign(new Error('Invalid message cursor.'), { status: 400 });
  if (beforeCursor) Object.assign(filter, cursorFilter(beforeCursor, 'before'));
  if (afterCursor) Object.assign(filter, cursorFilter(afterCursor, 'after'));
  const sort = afterCursor ? { createdAt: 1 as const, _id: 1 as const } : { createdAt: -1 as const, _id: -1 as const };
  const records = await ChatMessage.find(filter).sort(sort).limit(limit + 1).populate('sender', senderFields);
  const hasMore = records.length > limit;
  const selected = records.slice(0, limit);
  if (!afterCursor) selected.reverse();
  return {
    records: selected,
    messages: selected.map(messagePayload),
    hasMore,
    nextCursor: selected.length && hasMore ? encodeMessageCursor(selected[0]) : null,
    latestCursor: selected.length ? encodeMessageCursor(selected[selected.length - 1]) : null,
  };
};

export const countUnreadMessages = async (chat: any, userId: string) => {
  await migrateLegacyMessagesForChat(chat._id.toString());
  const state = (chat.readStates || []).find((item: any) => id(item.user) === userId);
  const filter: any = { chat: chat._id, sender: { $ne: userId } };
  if (state?.lastReadAt) {
    const date = new Date(state.lastReadAt);
    filter.$or = [{ createdAt: { $gt: date } }];
    if (state.lastReadMessageId) filter.$or.push({ createdAt: date, _id: { $gt: state.lastReadMessageId } });
  }
  return ChatMessage.countDocuments(filter);
};

export const latestMessageForChat = async (chatId: string) => {
  await migrateLegacyMessagesForChat(chatId);
  return ChatMessage.findOne({ chat: chatId }).sort({ createdAt: -1, _id: -1 }).lean();
};

export const markMessagesRead = async (chatId: string, userId: string, newest: any) => {
  if (!newest) return;
  const user = new Types.ObjectId(userId);
  const messageId = new Types.ObjectId(id(newest._id));
  const readAt = new Date(newest.createdAt);
  await Chat.updateOne({ _id: chatId }, [{ $set: {
    readStates: {
      $let: {
        vars: { existing: { $filter: { input: { $ifNull: ['$readStates', []] }, as: 'state', cond: { $eq: ['$$state.user', user] } } } },
        in: {
          $concatArrays: [
            { $filter: { input: { $ifNull: ['$readStates', []] }, as: 'state', cond: { $ne: ['$$state.user', user] } } },
            [{
              user,
              lastReadAt: { $cond: [
                { $or: [
                  { $eq: [{ $size: '$$existing' }, 0] },
                  { $lt: [{ $arrayElemAt: ['$$existing.lastReadAt', 0] }, readAt] },
                  { $and: [
                    { $eq: [{ $arrayElemAt: ['$$existing.lastReadAt', 0] }, readAt] },
                    { $lt: [{ $ifNull: [{ $arrayElemAt: ['$$existing.lastReadMessageId', 0] }, new Types.ObjectId('000000000000000000000000')] }, messageId] },
                  ] },
                ] }, readAt, { $arrayElemAt: ['$$existing.lastReadAt', 0] },
              ] },
              lastReadMessageId: { $cond: [
                { $or: [
                  { $eq: [{ $size: '$$existing' }, 0] },
                  { $lt: [{ $arrayElemAt: ['$$existing.lastReadAt', 0] }, readAt] },
                  { $and: [
                    { $eq: [{ $arrayElemAt: ['$$existing.lastReadAt', 0] }, readAt] },
                    { $lt: [{ $ifNull: [{ $arrayElemAt: ['$$existing.lastReadMessageId', 0] }, new Types.ObjectId('000000000000000000000000')] }, messageId] },
                  ] },
                ] }, messageId, { $arrayElemAt: ['$$existing.lastReadMessageId', 0] },
              ] },
            }],
          ],
        },
      },
    },
  } }], { timestamps: false });
};

const activityAllowsSender = async (activityId: any, userId: string) => {
  const activity = await Activity.findById(activityId).select('host hostDeleted participants status');
  return activity && activity.status !== 'cancelled' && canAccessActivityChat(activity, userId) ? activity : null;
};

const directAllowsSender = async (chat: any, userId: string) => {
  if (!(chat.members || []).some((member: any) => id(member) === userId)) return false;
  const members = await User.find({ _id: { $in: chat.members }, ...activeUserFilter }).select('_id blockedUsers');
  return members.length === 2 && !isBlockedBetween(members[0], members[1]);
};

export const createChatMessage = async (chatId: string, userId: string, text: string, clientMessageId: string) => {
  await ChatMessage.init();
  await migrateLegacyMessagesForChat(chatId);
  let chat = await Chat.findById(chatId);
  if (!chat) return { status: 404, message: 'Chat not found.' };
  const allowed = chat.chatType === 'directPrivateChat'
    ? await directAllowsSender(chat, userId)
    : !chat.activityReadOnly && chat.activity && await activityAllowsSender(chat.activity, userId);
  if (!allowed) return { status: chat.chatType === 'directPrivateChat' ? 403 : 409,
    code: chat.chatType === 'directPrivateChat' ? undefined : 'ACTIVITY_CHAT_READ_ONLY',
    message: chat.chatType === 'directPrivateChat' ? 'This conversation is unavailable.' : 'This activity chat is unavailable or read-only.' };
  let created: any;
  try {
    created = await ChatMessage.create({ chat: chat._id, sender: userId, text, clientMessageId });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    created = await ChatMessage.findOne({ chat: chat._id, sender: userId, clientMessageId });
  }
  // Recheck after insertion to close the authorization/removal race. A failed
  // postcondition removes the provisional message before any API success response.
  chat = await Chat.findById(chatId);
  const stillAllowed = chat && (chat.chatType === 'directPrivateChat'
    ? await directAllowsSender(chat, userId)
    : !chat.activityReadOnly && chat.activity && await activityAllowsSender(chat.activity, userId));
  if (!stillAllowed) {
    await ChatMessage.deleteOne({ _id: created._id });
    return { status: chat?.chatType === 'directPrivateChat' ? 403 : 409,
      code: chat?.chatType === 'directPrivateChat' ? undefined : 'ACTIVITY_CHAT_READ_ONLY',
      message: 'You no longer have access to send messages here.' };
  }
  if (!chat) throw new Error('Chat disappeared after message authorization.');
  if (chat.chatType === 'directPrivateChat' && chat.directState === 'request' && id(chat.requestRecipient) === userId) {
    await Chat.updateOne({ _id: chat._id, requestRecipient: userId }, { $set: { directState: 'active' }, $unset: { requestRecipient: 1 } }, { timestamps: false });
  }
  await Chat.updateOne({ _id: chat._id }, { $max: { lastMessageAt: created.createdAt } }, { timestamps: false });
  const populated = await ChatMessage.findById(created._id).populate('sender', senderFields);
  return { status: 200, created: messagePayload(populated), duplicate: created.clientMessageId === clientMessageId && created.createdAt.getTime() !== created.updatedAt.getTime() };
};
