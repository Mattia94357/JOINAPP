import crypto from 'crypto';
import ImageUploadClaim from '../models/ImageUploadClaim';

const claimId = (userId: string, kind: string, requestId: string) => crypto.createHash('sha256')
  .update(`${userId}:${kind}:${requestId}`).digest('hex');

export const acquireImageUploadClaim = async (userId: string, kind: string, requestId: string, reclaimCompleted = false) => {
  const id = claimId(userId, kind, requestId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60_000);
  try {
    await ImageUploadClaim.create({ _id: id, status: 'pending', createdAt: now, expiresAt });
    return { acquired: true as const, id };
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    if (reclaimCompleted) {
      const reused = await ImageUploadClaim.findOneAndUpdate({ _id: id, status: 'complete' },
        { $set: { status: 'pending', createdAt: now, expiresAt }, $unset: { targetId: 1 } });
      if (reused) return { acquired: true as const, id };
    }
    const reclaimed = await ImageUploadClaim.findOneAndUpdate({ _id: id, status: 'pending', createdAt: { $lt: new Date(now.getTime() - 5 * 60_000) } },
      { $set: { createdAt: now, expiresAt } });
    if (reclaimed) return { acquired: true as const, id };
    return { acquired: false as const, id };
  }
};

export const waitForImageUploadClaim = async (id: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const claim = await ImageUploadClaim.findById(id).lean();
    if (!claim) return undefined;
    if (claim.status === 'complete') return claim.targetId;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
};

export const completeImageUploadClaim = (id: string, targetId: string) => ImageUploadClaim.updateOne({ _id: id }, { $set: { status: 'complete', targetId } });
export const releaseImageUploadClaim = (id: string) => ImageUploadClaim.deleteOne({ _id: id, status: 'pending' });
