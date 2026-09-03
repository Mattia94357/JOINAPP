import express from 'express';
import { body, validationResult } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { Types } from 'mongoose';
import auth, { AuthRequest } from '../middleware/auth';
import Chat from '../models/Chat';
import Activity from '../models/Activity';
import User from '../models/User';
import { confirmedActivityMemberIds } from '../services/activityMembership';

const router = express.Router();
type ChatIdParams = { id: string };
type DirectUserParams = { userId: string };
type SendMessageBody = { message: string };

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});

const cleanMessage = (value: string) => value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
const toId = (value: any) => value?._id?.toString?.() || value?.toString?.() || '';
const idInList = (list: any[] | undefined, id?: string) =>
  Boolean(id && (list || []).some((item) => toId(item) === id));
const directKeyFor = (firstId: string, secondId: string) => [firstId, secondId].sort().join(':');

const isBlockedBetween = (first: any, second: any) => {
  const firstBlocked = (first?.blockedUsers || []).some((id: any) => toId(id) === second?.id);
  const secondBlocked = (second?.blockedUsers || []).some((id: any) => toId(id) === first?.id);
  return firstBlocked || secondBlocked;
};

const activityMemberIds = confirmedActivityMemberIds;

const usersShareActivity = async (firstId: string, secondId: string) =>
  Boolean(await Activity.exists({
    status: { $ne: 'cancelled' },
    $and: [
      { $or: [{ host: firstId }, { participants: firstId }] },
      { $or: [{ host: secondId }, { participants: secondId }] },
    ],
  }));

const ensureActivityChats = async (userId: string) => {
  const activities = await Activity.find({
    status: { $ne: 'cancelled' },
    $or: [{ host: userId }, { participants: userId }],
  }).select('_id host participants visibility');

  await Promise.all(activities.map(async (activity) => {
    const members = activityMemberIds(activity);
    await Chat.findOneAndUpdate(
      { activity: activity._id },
      {
        $set: {
          members,
          chatType: activity.visibility === 'private' ? 'privateActivityChat' : 'publicActivityChat',
        },
        $setOnInsert: {
          activity: activity._id,
          messages: [],
          readStates: members.map((member) => ({ user: member, lastReadAt: new Date() })),
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }));
};

const markChatRead = async (chat: any, userId: string) => {
  const existingState = (chat.readStates || []).find((state: any) => toId(state.user) === userId);
  if (existingState) {
    existingState.lastReadAt = new Date();
  } else {
    chat.readStates.push({ user: userId, lastReadAt: new Date() });
  }
  await chat.save();
};

const unreadCountFor = (chat: any, userId: string) => {
  const readState = (chat.readStates || []).find((state: any) => toId(state.user) === userId);
  const lastReadAt = readState ? new Date(readState.lastReadAt).getTime() : 0;
  return (chat.messages || []).filter((message: any) =>
    toId(message.author) !== userId
    && new Date(message.sentAt).getTime() > lastReadAt).length;
};

const conversationSummary = (chat: any, userId: string) => {
  const latest = chat.messages?.[chat.messages.length - 1];
  const isActivity = chat.chatType !== 'directPrivateChat';
  const otherUser = isActivity
    ? null
    : (chat.members || []).find((member: any) => member && toId(member) !== userId);
  const unreadCount = unreadCountFor(chat, userId);

  return {
    id: chat._id.toString(),
    type: isActivity ? 'activity' : 'direct',
    state: chat.directState || 'active',
    title: isActivity ? chat.activity?.title || 'Activity chat' : otherUser?.name || 'Unavailable member',
    image: isActivity
      ? chat.activity?.coverImage
      : otherUser?.profileThumbnailUrl || otherUser?.profilePictureUrl || otherUser?.avatar,
    activity: isActivity && chat.activity ? {
      id: toId(chat.activity),
      title: chat.activity.title,
      coverImage: chat.activity.coverImage,
    } : undefined,
    user: otherUser ? {
      id: toId(otherUser),
      name: otherUser.name,
      avatar: otherUser.profileThumbnailUrl || otherUser.profilePictureUrl || otherUser.avatar,
    } : undefined,
    latestMessage: latest?.message || '',
    latestMessageAt: latest?.sentAt || chat.updatedAt,
    unread: unreadCount > 0,
    unreadCount,
  };
};

const getConversationLists = async (userId: string) => {
  await ensureActivityChats(userId);

  const chats = await Chat.find({ members: userId })
    .populate('activity', 'title coverImage host participants status')
    .populate('members', 'name avatar profilePictureUrl profileThumbnailUrl blockedUsers')
    .sort({ updatedAt: -1 });

  await Promise.all(chats.map(async (chat: any) => {
    if (
      chat.chatType === 'directPrivateChat'
      && chat.directState === 'request'
      && chat.members?.length === 2
      && await usersShareActivity(toId(chat.members[0]), toId(chat.members[1]))
    ) {
      chat.directState = 'active';
      chat.requestRecipient = undefined;
      await chat.save();
    }
  }));

  const visibleChats = chats.filter((chat: any) => {
    if (chat.chatType === 'directPrivateChat') return true;
    const activity = chat.activity;
    return activity && activity.status !== 'cancelled' && activityMemberIds(activity).includes(userId);
  });

  const summaries = visibleChats.map((chat: any) => conversationSummary(chat, userId));
  const recipientRequestIds = visibleChats
    .filter((chat: any) =>
      chat.chatType === 'directPrivateChat'
      && chat.directState === 'request'
      && toId(chat.requestRecipient) === userId)
    .map((chat: any) => chat._id.toString());
  const requests = summaries.filter((summary: any) => {
    const chat = visibleChats.find((item: any) => item._id.toString() === summary.id);
    return recipientRequestIds.includes(summary.id) && Boolean(chat?.messages?.length);
  });
  const conversations = summaries.filter((summary: any) => !recipientRequestIds.includes(summary.id));
  const byLatest = (first: any, second: any) =>
    new Date(second.latestMessageAt || 0).getTime() - new Date(first.latestMessageAt || 0).getTime();

  conversations.sort(byLatest);
  requests.sort(byLatest);

  return {
    conversations,
    requests,
    unreadConversationCount: conversations.filter((conversation: any) => conversation.unread).length,
    unreadRequestCount: requests.filter((request: any) => request.unread).length,
  };
};

const getAuthorizedChat = async (id: string, userId?: string) => {
  if (!Types.ObjectId.isValid(id) || !userId) return null;

  let chat = await Chat.findById(id);
  let activity = chat?.activity ? await Activity.findById(chat.activity) : null;

  if (!chat) {
    activity = await Activity.findById(id);
    if (!activity) return null;
    const members = activityMemberIds(activity);
    if (!members.includes(userId)) {
      return { error: 'You need to join this activity to access the chat.' };
    }
    chat = await Chat.findOneAndUpdate(
      { activity: activity._id },
      {
        $set: {
          members,
          chatType: activity.visibility === 'private' ? 'privateActivityChat' : 'publicActivityChat',
        },
        $setOnInsert: {
          activity: activity._id,
          messages: [],
          readStates: members.map((member) => ({ user: member, lastReadAt: new Date() })),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  if (!chat) return null;

  if (chat.chatType === 'directPrivateChat') {
    if (!idInList(chat.members, userId)) return { error: 'You do not have access to this conversation.' };
    const members = await User.find({ _id: { $in: chat.members } }).select('blockedUsers');
    if (members.length === 2 && isBlockedBetween(members[0], members[1])) {
      return { error: 'This conversation is unavailable.' };
    }
    return { chat };
  }

  if (!activity && chat.activity) activity = await Activity.findById(chat.activity);
  if (!activity || !activityMemberIds(activity).includes(userId)) {
    return { error: 'You need to join this activity to access the chat.' };
  }

  const user = await User.findById(userId);
  const members = await User.find({ _id: { $in: activityMemberIds(activity) } }).select('blockedUsers');
  const blockedMember = members.some((member) => member.id !== userId && user && isBlockedBetween(user, member));
  if (user && blockedMember) return { error: 'Chat is unavailable for this activity.' };

  chat.members = activityMemberIds(activity) as any;
  chat.chatType = activity.visibility === 'private' ? 'privateActivityChat' : 'publicActivityChat';
  await chat.save();

  return { chat };
};

router.get('/', auth, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });
  const lists = await getConversationLists(req.userId);
  const scope = req.query.scope === 'requests' ? 'requests' : 'active';
  return res.json({
    conversations: scope === 'requests' ? lists.requests : lists.conversations,
    unreadConversationCount: lists.unreadConversationCount,
    unreadRequestCount: lists.unreadRequestCount,
  });
});

router.get('/unread-count', auth, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });
  const lists = await getConversationLists(req.userId);
  return res.json({
    unreadConversationCount: lists.unreadConversationCount,
    unreadRequestCount: lists.unreadRequestCount,
  });
});

router.post('/direct/:userId', auth, async (req: AuthRequest<DirectUserParams>, res) => {
  const currentUserId = req.userId;
  const otherUserId = req.params.userId;
  if (!currentUserId || !Types.ObjectId.isValid(otherUserId)) {
    return res.status(400).json({ message: 'Invalid user.' });
  }
  if (currentUserId === otherUserId) {
    return res.status(400).json({ message: 'You cannot message yourself.' });
  }

  const [currentUser, otherUser] = await Promise.all([
    User.findById(currentUserId),
    User.findById(otherUserId),
  ]);
  if (!currentUser || !otherUser) return res.status(404).json({ message: 'User not found.' });
  if (isBlockedBetween(currentUser, otherUser)) {
    return res.status(403).json({ message: 'This conversation is unavailable.' });
  }

  const directKey = directKeyFor(currentUserId, otherUserId);
  let chat = await Chat.findOne({ directKey });
  if (!chat) {
    chat = await Chat.findOne({
      chatType: 'directPrivateChat',
      members: { $all: [currentUserId, otherUserId] },
      $expr: { $eq: [{ $size: '$members' }, 2] },
    });
    if (chat && !chat.directKey) {
      chat.directKey = directKey;
      chat.directState = chat.directState || 'active';
      await chat.save();
    }
  }
  if (!chat) {
    const sharedActivity = await usersShareActivity(currentUserId, otherUserId);
    chat = await Chat.create({
      members: [currentUserId, otherUserId],
      chatType: 'directPrivateChat',
      directKey,
      directState: sharedActivity ? 'active' : 'request',
      initiatedBy: currentUserId,
      requestRecipient: sharedActivity ? undefined : otherUserId,
      readStates: [
        { user: currentUserId, lastReadAt: new Date() },
        { user: otherUserId, lastReadAt: new Date() },
      ],
      messages: [],
    });
  }

  return res.json({
    chatId: chat._id.toString(),
    state: chat.directState || 'active',
    title: otherUser.name,
  });
});

router.get('/:id', auth, async (req: AuthRequest<ChatIdParams>, res) => {
  const result = await getAuthorizedChat(req.params.id, req.userId);
  if (!result) return res.status(404).json({ message: 'Chat not found' });
  if ('error' in result) return res.status(403).json({ message: result.error });

  await markChatRead(result.chat, req.userId!);

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const chat = await Chat.findById(result.chat._id)
    .populate('activity', 'title coverImage')
    .populate('members', 'name profilePictureUrl profileThumbnailUrl avatar')
    .populate('messages.author', 'name profilePictureUrl profileThumbnailUrl avatar');
  if (chat) {
    const messages = before && !Number.isNaN(before.getTime())
      ? chat.messages.filter((message: any) => new Date(message.sentAt).getTime() < before.getTime())
      : chat.messages;
    chat.messages = messages.slice(-limit) as any;
  }
  return res.json(chat);
});

router.post(
  '/:id/message',
  auth,
  chatLimiter,
  body('message').isString().trim().isLength({ min: 1, max: 1200 }),
  async (req: AuthRequest<ChatIdParams, unknown, SendMessageBody>, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const result = await getAuthorizedChat(req.params.id, req.userId);
    if (!result) return res.status(404).json({ message: 'Chat not found' });
    if ('error' in result) return res.status(403).json({ message: result.error });
    const chat = result.chat;

    const message = cleanMessage(req.body.message);
    if (!message) return res.status(400).json({ message: 'Message cannot be empty.' });
    const previous = chat.messages[chat.messages.length - 1];
    if (
      previous?.author?.toString() === req.userId
      && previous.message === message
      && Date.now() - new Date(previous.sentAt).getTime() < 10_000
    ) {
      return res.status(429).json({ message: 'Please avoid sending duplicate messages.' });
    }

    chat.messages.push({ author: req.userId as any, message, sentAt: new Date() });
    if (
      chat.chatType === 'directPrivateChat'
      && chat.directState === 'request'
      && toId(chat.requestRecipient) === req.userId
    ) {
      chat.directState = 'active';
      chat.requestRecipient = undefined;
    }
    const ownReadState = (chat.readStates || []).find((state: any) => toId(state.user) === req.userId);
    if (ownReadState) ownReadState.lastReadAt = new Date();
    else chat.readStates.push({ user: req.userId as any, lastReadAt: new Date() });
    await chat.save();

    return res.json(chat);
  },
);

export default router;
