import express from 'express';
import { Types } from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import auth from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { submitReport } from '../services/reports';

export const reportLimiter = rateLimit({ windowMs: 3600000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const router = express.Router();
router.post('/', auth, reportLimiter, asyncHandler(async (req: any, res) => {
  if (typeof req.body?.targetId !== 'string' || !Types.ObjectId.isValid(req.body.targetId)) {
    return res.status(404).json({ message: 'Report target not found.' });
  }
  const result = await submitReport(req.userId, req.body.targetType, req.body.targetId, req.body.reason, req.body.detail);
  return res.status(result.status).json({ message: result.message });
}));
export default router;
