import { NextFunction, Request, Response } from 'express';
import { AuthRole } from './auth.middleware';
import { ApiError } from '../utils/ApiError';

export const requireRole =
  (...roles: AuthRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new ApiError(401, 'Authentication is required'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'You do not have permission to access this resource'));
      return;
    }

    next();
  };
