import { Request, Response, NextFunction } from 'express';

// Wraps async route handlers so errors propagate to Express error middleware.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
