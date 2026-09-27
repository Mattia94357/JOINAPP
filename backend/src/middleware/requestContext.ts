import crypto from 'crypto';
import { RequestHandler } from 'express';

const safeRequestId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(value)
  ? value
  : undefined;

export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = safeRequestId(req.headers['x-request-id']) || crypto.randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};
