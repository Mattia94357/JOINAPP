import { ErrorRequestHandler } from 'express';
import { ImageUploadLimitError } from '../services/imageUploadLimits';
import { ImageInputError } from '../services/imageValidation';

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof ImageUploadLimitError) return res.status(error.status).json({ message: error.message });
  if (error instanceof ImageInputError) return res.status(error.status).json({ message: error.message });
  if (error?.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body.' });
  if (error?.name === 'CastError' || error?.name === 'ValidationError') {
    return res.status(400).json({ message: 'Invalid request data.' });
  }
  if (error?.message === 'Origin is not allowed.') return res.status(403).json({ message: 'Origin is not allowed.' });
  console.error('[server] Unexpected error', {
    timestamp: new Date().toISOString(),
    requestId: res.locals.requestId || 'unavailable',
    method: req.method,
    path: `${req.baseUrl || ''}${req.path || ''}`,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    category: typeof error?.code === 'string' || typeof error?.code === 'number' ? String(error.code) : 'unexpected',
  });
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
};
