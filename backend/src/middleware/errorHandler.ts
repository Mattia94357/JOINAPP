import { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body.' });
  if (error?.name === 'CastError' || error?.name === 'ValidationError') {
    return res.status(400).json({ message: 'Invalid request data.' });
  }
  if (error?.message === 'Origin is not allowed.') return res.status(403).json({ message: 'Origin is not allowed.' });
  if (process.env.NODE_ENV !== 'production') console.error('[server] Unexpected error', error);
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
};
