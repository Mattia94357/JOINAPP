import express from 'express';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import auth, { AuthRequest } from '../middleware/auth';
import PushDevice from '../models/PushDevice';
import User from '../models/User';
import { isExpoPushToken } from '../services/expoPush';

const router = express.Router();
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
router.use(auth, rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));
router.put('/:installationId', async (req: AuthRequest<{ installationId: string }, unknown, any>, res, next) => {
  try {
    const { expoPushToken, platform, projectId } = req.body || {};
    if (!uuid(req.params.installationId) || !isExpoPushToken(expoPushToken) || !['ios', 'android'].includes(platform) || !uuid(projectId)) {
      return res.status(400).json({ message: 'Invalid device registration.' });
    }
    if (!process.env.EXPO_PROJECT_ID) return res.status(503).json({ message: 'Native push is not configured.' });
    if (projectId !== process.env.EXPO_PROJECT_ID) return res.status(400).json({ message: 'Incorrect push project.' });
    // Repeated refreshes preserve the registration generation; a changed owner,
    // token, or revoked registration gets a new one. Old jobs cannot cross accounts.
    const record = await PushDevice.findOneAndUpdate({ _id: req.params.installationId }, [{ $set: {
      registrationId: { $cond: [{ $and: [
        { $eq: ['$user', new Types.ObjectId(req.userId)] }, { $eq: ['$expoPushToken', expoPushToken] },
        { $eq: [{ $ifNull: ['$revokedAt', null] }, null] }, { $ne: [{ $ifNull: ['$registrationId', null] }, null] },
      ] }, '$registrationId', randomUUID()] },
      user: new Types.ObjectId(req.userId), expoPushToken, platform, projectId, revokedAt: null, lastSeenAt: new Date(),
    } }], { upsert: true, new: true }).select('+registrationId');
    // Legacy singleton tokens have unknown platform/ownership and are never sent.
    await User.updateOne({ _id: req.userId }, { $unset: { pushToken: 1 } });
    return res.json({ registrationId: record.registrationId });
  } catch (error: any) {
    if (error?.code === 11000) return res.status(409).json({ message: 'This token is already registered to another installation.' });
    // Database errors can embed token-bearing query values; never forward them
    // to the generic development logger.
    next(new Error('Push device registration failed'));
  }
});
router.delete('/:installationId', async (req: AuthRequest<{ installationId: string }, unknown, any>, res, next) => {
  try {
    if (!uuid(req.params.installationId) || !uuid(req.body?.registrationId)) return res.status(400).json({ message: 'Invalid device registration.' });
    await PushDevice.updateOne({ _id: req.params.installationId, user: req.userId, registrationId: req.body.registrationId }, { $set: { revokedAt: new Date() } });
    return res.json({ success: true });
  } catch { next(new Error('Push device revocation failed')); }
});
export default router;
