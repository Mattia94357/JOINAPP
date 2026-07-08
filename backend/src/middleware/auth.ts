import { Request, Response, NextFunction } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/security';
import User from '../models/User';

export interface AuthRequest<
  Params = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Query,
  Locals extends Record<string, unknown> = Record<string, unknown>,
> extends Request<Params, ResBody, ReqBody, ReqQuery, Locals> {
  userId?: string;
}

const auth = async (
  req: AuthRequest,
  res: Response<{ message: string }>,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId: string };
    if (!payload.userId || !(await User.exists({ _id: payload.userId }))) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
    req.userId = payload.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export default auth;
