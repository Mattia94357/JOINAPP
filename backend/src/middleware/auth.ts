import { Request, Response, NextFunction } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import { getRequesterId } from '../services/sessions';
import { asyncHandler } from './asyncHandler';

export interface AuthRequest<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
  Locals extends Record<string, unknown> = Record<string, unknown>,
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
  user?: {
    id: string;
    email?: string;
  };
  userId?: string;
}

const auth = asyncHandler(async (
  req: AuthRequest,
  res: Response<{ message: string }>,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const deletionRetry = req.method === 'DELETE' && req.baseUrl === '/api/users' && req.path === '/me';
  const userId = await getRequesterId(req, deletionRetry);
  if (!userId) {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }
  req.userId = userId;
  req.user = { id: userId };
  next();
});

export default auth;
