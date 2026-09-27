import { activeUserFilter, isBlockedBetween } from '../services/blocking';
import { asyncHandler } from '../middleware/asyncHandler';
import express from 'express';
import { body, validationResult } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { Types } from 'mongoose';
import auth, { AuthRequest } from '../middleware/auth';
import Chat from '../models/Chat';
import Activity from '../models/Activity';
import User from '../models/User';
import { confirmedActivityMemberIds } from '../services/activityMembership';
import { canAccessActivityChat, isActivityChatReadOnly } from '../services/activityChat';
import { countUnreadMessages, createChatMessage, decodeMessageCursor, getMessagePage,
  latestMessageForChat, markMessagesRead } from '../services/chatMessages';
import { activityImageUrl, userImageUrls } from '../services/imageAssets';

const router = express.Router();
const limiter = rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const id = (value: any) => value?._id?.toString?.() || value?.toString?.() || '';
const cleanMessage = (value: string) => value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
const members = confirmedActivityMemberIds;
const directKey = (a: string, b: string) => [a, b].sort().join(':');
const shareActivity = (a: string, b: string) => Activity.exists({ status: { $ne: 'cancelled' }, $and: [
  { $or: [{ host: a }, { participants: a }] }, { $or: [{ host: b }, { participants: b }] },
] });

const ensureActivityChats = async (userId: string) => {
  const activities = await Activity.find({ $or: [{ host: userId }, { participants: userId }] })
    .select('host hostDeleted participants visibility status');
  await Promise.all(activities.map((activity) => Chat.findOneAndUpdate({ activity: activity._id }, {
    $set: { members: members(activity), chatType: activity.visibility === 'private' ? 'privateActivityChat' : 'publicActivityChat',
      ...(activity.status === 'cancelled' ? { activityReadOnly: true } : {}) },
    $setOnInsert: { activity: activity._id, readStates: members(activity).map((user) => ({ user, lastReadAt: new Date() })) },
  }, { upsert: true, setDefaultsOnInsert: true, timestamps: false })));
};

const authorize = async (value: string, userId?: string): Promise<any> => {
  if (!Types.ObjectId.isValid(value) || !userId) return null;
  let chat = await Chat.findById(value);
  let activity = chat?.activity ? await Activity.findById(chat.activity) : null;
  if (!chat) {
    activity = await Activity.findById(value);
    if (!activity) return null;
    if (!canAccessActivityChat(activity, userId)) return { error: 'You need to join this activity to access the chat.' };
    chat = await Chat.findOneAndUpdate({ activity: activity._id }, {
      $set: { members: members(activity), chatType: activity.visibility === 'private' ? 'privateActivityChat' : 'publicActivityChat',
        ...(activity.status === 'cancelled' ? { activityReadOnly: true } : {}) },
      $setOnInsert: { activity: activity._id, readStates: members(activity).map((user) => ({ user, lastReadAt: new Date() })) },
    }, { upsert: true, new: true, setDefaultsOnInsert: true, timestamps: false });
  }
  if (!chat) return null;
  if (chat.chatType === 'directPrivateChat') {
    if (!(chat.members || []).some((member) => id(member) === userId)) return { error: 'You do not have access to this conversation.' };
    const people = await User.find({ _id: { $in: chat.members }, ...activeUserFilter }).select('_id blockedUsers');
    return people.length === 2 && !isBlockedBetween(people[0], people[1]) ? { chat } : { error: 'This conversation is unavailable.' };
  }
  if (!activity && chat.activity) activity = await Activity.findById(chat.activity);
  if (!activity || !canAccessActivityChat(activity, userId)) return { error: 'You need to join this activity to access the chat.' };
  chat = await Chat.findByIdAndUpdate(chat._id, { $set: { members: members(activity),
    chatType: activity.visibility === 'private' ? 'privateActivityChat' : 'publicActivityChat',
    ...(activity.status === 'cancelled' ? { activityReadOnly: true } : {}) } }, { new: true, timestamps: false });
  return chat ? { chat, activity } : null;
};

const visibleChats = async (userId: string) => {
  await ensureActivityChats(userId);
  const chats: any[] = await Chat.find({ members: userId })
    .populate('activity', 'title coverImage coverImageAsset host hostDeleted participants status')
    .populate('members', 'name profileImage +avatar +profilePictureUrl +profileThumbnailUrl blockedUsers deletionStartedAt deletedAt');
  const output = [];
  for (const chat of chats) {
    if (chat.chatType === 'directPrivateChat') {
      if (chat.members.length !== 2 || chat.members.some((person: any) => !person || person.deletionStartedAt || person.deletedAt)
        || isBlockedBetween(chat.members[0], chat.members[1])) continue;
      if (chat.directState === 'request' && await shareActivity(id(chat.members[0]), id(chat.members[1]))) {
        await Chat.updateOne({ _id: chat._id, directState: 'request' },
          { $set: { directState: 'active' }, $unset: { requestRecipient: 1 } }, { timestamps: false });
        chat.directState = 'active'; chat.requestRecipient = undefined;
      }
    } else if (!chat.activity || !canAccessActivityChat(chat.activity, userId)) continue;
    output.push(chat);
  }
  return output;
};

const lists = async (userId: string) => {
  const chats = await visibleChats(userId);
  const summaries = await Promise.all(chats.map(async (chat: any) => {
    const [latest, unreadCount] = await Promise.all([latestMessageForChat(chat.id), countUnreadMessages(chat, userId)]);
    const activityChat = chat.chatType !== 'directPrivateChat';
    const other = activityChat ? null : chat.members.find((person: any) => person && id(person) !== userId);
    return { id: chat.id, type: activityChat ? 'activity' : 'direct', state: chat.directState || 'active',
      title: activityChat ? chat.activity?.title || 'Activity chat' : other?.name || 'Former JOIN member',
      image: activityChat ? activityImageUrl(chat.activity) : userImageUrls(other).avatar,
      activity: activityChat && chat.activity ? { id: id(chat.activity), title: chat.activity.title,
        coverImage: activityImageUrl(chat.activity), status: chat.activity.status } : undefined,
      user: other ? { id: id(other), name: other.name, avatar: userImageUrls(other).avatar } : undefined,
      latestMessage: latest?.text || '', latestMessageAt: latest?.createdAt || chat.lastMessageAt || chat.updatedAt,
      unread: unreadCount > 0, unreadCount, readOnly: activityChat && isActivityChatReadOnly(chat.activity, chat),
      request: chat.chatType === 'directPrivateChat' && chat.directState === 'request'
        && id(chat.requestRecipient) === userId && Boolean(latest) };
  }));
  summaries.sort((a: any, b: any) => new Date(b.latestMessageAt || 0).getTime() - new Date(a.latestMessageAt || 0).getTime());
  const clean = ({ request, ...item }: any) => item;
  const conversations = summaries.filter((item) => !item.request).map(clean);
  const requests = summaries.filter((item) => item.request).map(clean);
  return { conversations, requests, unreadConversationCount: conversations.filter((item) => item.unread).length,
    unreadRequestCount: requests.filter((item) => item.unread).length };
};

router.get('/', auth, asyncHandler(async (req: AuthRequest, res) => {
  const result = await lists(req.userId!);
  res.json({ conversations: req.query.scope === 'requests' ? result.requests : result.conversations,
    unreadConversationCount: result.unreadConversationCount, unreadRequestCount: result.unreadRequestCount });
}));
router.get('/unread-count', auth, asyncHandler(async (req: AuthRequest, res) => {
  const result = await lists(req.userId!);
  res.json({ unreadConversationCount: result.unreadConversationCount, unreadRequestCount: result.unreadRequestCount });
}));
router.post('/direct/:userId', auth, asyncHandler(async (req: AuthRequest<{ userId: string }>, res) => {
  const currentId = req.userId!; const otherId = req.params.userId;
  if (!Types.ObjectId.isValid(otherId) || currentId === otherId) return res.status(400).json({ message: 'Invalid user.' });
  const [current, other] = await Promise.all([User.findById(currentId), User.findById(otherId)]);
  if (!current || !other || other.deletionStartedAt || other.deletedAt) return res.status(404).json({ message: 'User not found.' });
  if (isBlockedBetween(current, other)) return res.status(403).json({ message: 'This conversation is unavailable.' });
  const key = directKey(currentId, otherId);
  let chat = await Chat.findOne({ directKey: key }) || await Chat.findOne({ chatType: 'directPrivateChat',
    members: { $all: [currentId, otherId] }, $expr: { $eq: [{ $size: '$members' }, 2] } });
  if (!chat) {
    const active = Boolean(await shareActivity(currentId, otherId));
    chat = await Chat.create({ members: [currentId, otherId], chatType: 'directPrivateChat', directKey: key,
      directState: active ? 'active' : 'request', initiatedBy: currentId, requestRecipient: active ? undefined : otherId,
      readStates: [{ user: currentId, lastReadAt: new Date() }, { user: otherId, lastReadAt: new Date() }] });
  } else if (!chat.directKey) await Chat.updateOne({ _id: chat._id }, { $set: { directKey: key, directState: chat.directState || 'active' } }, { timestamps: false });
  res.json({ chatId: chat.id, state: chat.directState || 'active', title: other.name });
}));

router.get('/:id', auth, asyncHandler(async (req: AuthRequest<{ id: string }>, res) => {
  const result = await authorize(req.params.id, req.userId);
  if (!result) return res.status(404).json({ message: 'Chat not found' });
  if (result.error) return res.status(403).json({ message: result.error });
  if ((req.query.before && !decodeMessageCursor(req.query.before)) || (req.query.after && !decodeMessageCursor(req.query.after)))
    return res.status(400).json({ message: 'Invalid message cursor.' });
  const page = await getMessagePage(result.chat.id, Math.min(Math.max(Number(req.query.limit) || 50, 1), 100), req.query.before, req.query.after);
  const chat = await Chat.findById(result.chat._id).populate('activity', 'title coverImage status')
    .populate('members', 'name profileImage +profilePictureUrl +profileThumbnailUrl +avatar');
  if (!chat) return res.status(404).json({ message: 'Chat not found' });
  if (!req.query.before && page.records.length) await markMessagesRead(chat.id, req.userId!, page.records[page.records.length - 1]);
  res.json({ id: chat.id, chatType: chat.chatType, activity: chat.activity, members: chat.members,
    readOnly: isActivityChatReadOnly(chat.activity, chat), messages: page.messages,
    nextCursor: page.nextCursor, latestCursor: page.latestCursor, hasMore: page.hasMore });
}));

router.post('/:id/message', auth, limiter,
  body('message').isString().trim().isLength({ min: 1, max: 1200 }),
  body('clientMessageId').isString().isLength({ min: 8, max: 100 }),
  asyncHandler(async (req: AuthRequest<{ id: string }, unknown, { message: string; clientMessageId: string }>, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Message and client message ID are required.' });
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Chat not found.' });
    const message = cleanMessage(req.body.message);
    if (!message) return res.status(400).json({ message: 'Message cannot be empty.' });
    const access = await authorize(req.params.id, req.userId);
    if (!access) return res.status(404).json({ message: 'Chat not found.' });
    if (access.error) return res.status(403).json({ message: access.error });
    const result = await createChatMessage(access.chat.id, req.userId!, message, req.body.clientMessageId);
    if (!result.created) return res.status(result.status).json({ code: result.code, message: result.message });
    res.json({ message: result.created });
  }),
);
export default router;
