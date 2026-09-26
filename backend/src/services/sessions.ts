import { Request } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { getJwtSecret } from '../config/security';

// Shared by required and optional authentication: revoked tokens grant no access.
export const getRequesterId = async (req: Pick<Request, 'headers'>, allowDeletion = false): Promise<string | undefined> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(header.slice(7), getJwtSecret());
    if (typeof decoded === 'string') return undefined;
    payload = decoded;
  } catch {
    return undefined;
  }
  if (typeof payload.userId !== 'string' || !/^[a-f\d]{24}$/i.test(payload.userId)) return undefined;
  const version = payload.sessionVersion ?? 0;
  if (!Number.isSafeInteger(version) || version < 0) return undefined;
  const user = await User.findById(payload.userId).select('+sessionVersion').lean();
  if (!allowDeletion && (user?.deletionStartedAt || user?.deletedAt)) return undefined;
  // Legacy users/tokens start at version zero; a reset permanently invalidates them.
  return user && (user.sessionVersion ?? 0) === version ? payload.userId : undefined;
};
