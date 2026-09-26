import { Request, Response, NextFunction, RequestHandler } from 'express';

// Express 4 does not forward rejected handler promises automatically.
export const asyncHandler = <R extends Request = Request>(
  handler: (req: R, res: Response, next: NextFunction) => unknown,
): RequestHandler => (req, res, next) => {
  Promise.resolve().then(() => handler(req as R, res, next))
    .catch((error) => next(error || new Error('Async handler failed')));
};
