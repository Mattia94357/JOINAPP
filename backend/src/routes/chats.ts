import express from 'express';
import { body, validationResult } from 'express-validator';
import auth, { AuthRequest } from '../middleware/auth';
import Chat from '../models/Chat';
import { Types } from 'mongoose';

const router = express.Router();

router.get('/:id', auth, async (req: AuthRequest, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Chat not found' });
  }
  const chat = await Chat.findById(req.params.id).populate('members', 'name').populate('messages.author', 'name');
  if (!chat) return res.status(404).json({ message: 'Chat not found' });
  res.json(chat);
});

router.post('/:id/message', auth, body('message').notEmpty(), async (req: AuthRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Chat not found' });
  }

  const chat = await Chat.findById(req.params.id);
  if (!chat) return res.status(404).json({ message: 'Chat not found' });

  chat.messages.push({ author: req.userId as any, message: req.body.message, sentAt: new Date() });
  await chat.save();
  res.json(chat);
});

export default router;
