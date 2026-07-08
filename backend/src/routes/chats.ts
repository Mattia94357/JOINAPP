import express from 'express';
import { body, validationResult } from 'express-validator';
import auth, { AuthRequest } from '../middleware/auth';
import Chat from '../models/Chat';
import Activity from '../models/Activity';
import User from '../models/User';
import { Types } from 'mongoose';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();
type ChatIdParams = { id: string };
type SendMessageBody = {
  message: string;
};
const chatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } });
const cleanMessage = (value: string) => value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
const idInList = (list: any[] | undefined, id?: string) =>
  Boolean(id && (list || []).some((item) => (item?._id?.toString?.() || item?.toString?.()) === id));

const isBlockedBetween = (first: any, second: any) => {
  const firstBlocked = (first?.blockedUsers || []).some((id: any) => id.toString() === second?.id);
  const secondBlocked = (second?.blockedUsers || []).some((id: any) => id.toString() === first?.id);
  return firstBlocked || secondBlocked;
};

const getAuthorizedChat = async (id: string, userId?: string) => {
  if (!Types.ObjectId.isValid(id)) return null;

  let chat = await Chat.findById(id);
  let activity = chat?.activity ? await Activity.findById(chat.activity) : null;

  if (!chat) {
    activity = await Activity.findById(id);
    if (!activity) return null;
    chat = await Chat.findOne({ activity: activity._id });
    if (!chat) {
      chat = await Chat.create({
        activity: activity._id,
        members: activity.participants,
        chatType: activity.visibility === 'private' ? 'privateActivityChat' : 'publicActivityChat',
        messages: [],
      });
    }
  }

  if (!activity && chat.activity) activity = await Activity.findById(chat.activity);
  if (!activity) return null;
  if (!idInList(activity.participants, userId)) {
    return { error: 'You need to join this activity to access the chat.' };
  }

  const user = await User.findById(userId);
  const members = await User.find({ _id: { $in: activity.participants } }).select('blockedUsers');
  const blockedMember = members.some((member) => member.id !== userId && user && isBlockedBetween(user, member));
  if (user && blockedMember) {
    return { error: 'Chat is unavailable for this activity.' };
  }

  chat.members = activity.participants;
  chat.chatType = activity.visibility === 'private' ? 'privateActivityChat' : 'publicActivityChat';
  await chat.save();

  return { chat };
};

router.get('/:id', auth, async (req: AuthRequest<ChatIdParams>, res) => {
  const result = await getAuthorizedChat(req.params.id, req.userId);
  if (!result) return res.status(404).json({ message: 'Chat not found' });
  if ('error' in result) return res.status(403).json({ message: result.error });

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const chat = await Chat.findById(result.chat._id).populate('members', 'name profilePictureUrl profileThumbnailUrl avatar').populate('messages.author', 'name profilePictureUrl profileThumbnailUrl avatar');
  if (chat) {
    const messages = before && !Number.isNaN(before.getTime())
      ? chat.messages.filter((message: any) => new Date(message.sentAt).getTime() < before.getTime())
      : chat.messages;
    chat.messages = messages.slice(-limit) as any;
  }
  res.json(chat);
});

router.post('/:id/message', auth, chatLimiter, body('message').isString().trim().isLength({ min: 1, max: 1200 }), async (req: AuthRequest<ChatIdParams, unknown, SendMessageBody>, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await getAuthorizedChat(req.params.id, req.userId);
  if (!result) return res.status(404).json({ message: 'Chat not found' });
  if ('error' in result) return res.status(403).json({ message: result.error });
  const chat = result.chat;

  const message = cleanMessage(req.body.message);
  if (!message) return res.status(400).json({ message: 'Message cannot be empty.' });
  const previous = chat.messages[chat.messages.length - 1];
  if (previous?.author?.toString() === req.userId && previous.message === message && Date.now() - new Date(previous.sentAt).getTime() < 10_000) {
    return res.status(429).json({ message: 'Please avoid sending duplicate messages.' });
  }
  chat.messages.push({ author: req.userId as any, message, sentAt: new Date() });
  await chat.save();
  res.json(chat);
});

export default router;
