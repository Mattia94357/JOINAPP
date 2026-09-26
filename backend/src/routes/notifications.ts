import express from 'express';
import { Types } from 'mongoose';
import auth, { AuthRequest } from '../middleware/auth';
import Notification from '../models/Notification';
import Activity from '../models/Activity';
import { notificationPayload } from '../services/notifications';

const router = express.Router();
router.use(auth);
const handle = (fn: (req: AuthRequest<any>, res: express.Response) => Promise<unknown>): express.RequestHandler =>
  (req, res, next) => { void fn(req as AuthRequest<any>, res).catch(next); };

router.get('/unread-count', handle(async (req, res) => {
  return res.json({ unreadCount: await Notification.countDocuments({ recipient: req.userId, readAt: null }) });
}));
router.patch('/read-all', handle(async (req, res) => {
  await Notification.updateMany({ recipient: req.userId, readAt: null }, { $set: { readAt: new Date() } });
  return res.json({ success: true });
}));
router.patch('/:id/read', handle(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Notification not found.' });
  const record = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.userId },
    [{ $set: { readAt: { $ifNull: ['$readAt', new Date()] } } }], { new: true },
  );
  if (!record) return res.status(404).json({ message: 'Notification not found.' });
  return res.json({ id: record.id, readAt: record.readAt });
}));
router.get('/', handle(async (req, res) => {
  const requested = Number(req.query.limit || 20);
  const limit = Number.isFinite(requested) ? Math.min(50, Math.max(1, Math.floor(requested))) : 20;
  let boundary = {};
  if (req.query.cursor) {
    try {
      const cursor = JSON.parse(Buffer.from(String(req.query.cursor), 'base64url').toString());
      const date = new Date(cursor.date);
      if (!Types.ObjectId.isValid(cursor.id) || !Number.isFinite(date.getTime())) throw new Error();
      boundary = { $or: [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: cursor.id } }] };
    } catch { return res.status(400).json({ message: 'Invalid notification cursor.' }); }
  }
  const records = await Notification.find({ recipient: req.userId, ...boundary }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  const page = records.slice(0, limit);
  const activities = await Activity.find({ _id: { $in: page.map((n) => n.activity) } })
    .select('_id title visibility host participants pendingParticipants invitedUsers').lean();
  const byId = new Map(activities.map((a) => [String(a._id), a]));
  const last = page[page.length - 1];
  return res.json({
    notifications: page.map((n) => notificationPayload(n, byId.get(String(n.activity)), req.userId!)),
    nextCursor: records.length > limit && last
      ? Buffer.from(JSON.stringify({ date: last.createdAt, id: last._id })).toString('base64url') : null,
  });
}));
router.get('/:id', handle(async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Notification not found.' });
  const record = await Notification.findOne({ _id: req.params.id, recipient: req.userId });
  if (!record) return res.status(404).json({ message: 'Notification not found.' });
  const activity = await Activity.findById(record.activity).select('_id title visibility host participants pendingParticipants invitedUsers');
  return res.json(notificationPayload(record, activity, req.userId!));
}));
export default router;
