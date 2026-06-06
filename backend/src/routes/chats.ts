import express from 'express';
import { body, validationResult } from 'express-validator';
import auth, { AuthRequest } from '../middleware/auth';
import Chat from '../models/Chat';
import Activity from '../models/Activity';
import User from '../models/User';
import { Types } from 'mongoose';

const router = express.Router();
const idInList = (list: any[] | undefined, id?: string) =>
  Boolean(id && (list || []).some((item) => item?.toString() === id));

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
  const blockedMember = await User.findOne({
    _id: { $in: activity.participants },
    blockedUsers: user?._id,
  });
  if (user && blockedMember && isBlockedBetween(user, blockedMember)) {
    return { error: 'Chat is unavailable for this activity.' };
  }

  chat.members = activity.participants;
  chat.chatType = activity.visibility === 'private' ? 'privateActivityChat' : 'publicActivityChat';
  await chat.save();

  return { chat };
};

router.get('/:id', auth, async (req: AuthRequest, res) => {
  const result = await getAuthorizedChat(req.params.id, req.userId);
  if (!result) return res.status(404).json({ message: 'Chat not found' });
  if ('error' in result) return res.status(403).json({ message: result.error });

  const chat = await Chat.findById(result.chat._id).populate('members', 'name profilePictureUrl profileThumbnailUrl avatar').populate('messages.author', 'name profilePictureUrl profileThumbnailUrl avatar');
  res.json(chat);
});

router.post('/:id/message', auth, body('message').notEmpty(), async (req: AuthRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await getAuthorizedChat(req.params.id, req.userId);
  if (!result) return res.status(404).json({ message: 'Chat not found' });
  if ('error' in result) return res.status(403).json({ message: result.error });
  const chat = result.chat;

  chat.messages.push({ author: req.userId as any, message: req.body.message, sentAt: new Date() });
  await chat.save();
  res.json(chat);
});

export default router;
