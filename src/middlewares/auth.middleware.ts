import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export type AuthRole = 'BUYER' | 'ADMIN';

export type AuthUser = {
  id: string;
  role: AuthRole;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const isAuthRole = (role: unknown): role is AuthRole =>
  role === 'BUYER' || role === 'ADMIN';

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const authHeader = req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    next(new ApiError(401, 'Authentication token is required'));
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    next(new ApiError(401, 'Authentication token is required'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const id =
      typeof decoded.userId === 'string'
        ? decoded.userId
        : typeof decoded.id === 'string'
          ? decoded.id
          : decoded.sub;

    if (typeof id !== 'string' || !isAuthRole(decoded.role)) {
      next(new ApiError(401, 'Invalid authentication token'));
      return;
    }

    req.user = { id, role: decoded.role };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired authentication token'));
  }
};
