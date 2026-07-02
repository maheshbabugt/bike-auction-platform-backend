import { Prisma } from '../generated/prisma';
import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { errorResponse } from '../utils/response';

const getPrismaErrorMessage = (error: Prisma.PrismaClientKnownRequestError) => {
  switch (error.code) {
    case 'P2002':
      return 'A record with this value already exists';
    case 'P2025':
      return 'Requested record was not found';
    default:
      return 'Database request failed';
  }
};

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json(errorResponse(error.message));
    return;
  }

  if (error instanceof ZodError) {
    const message = error.issues.map((issue) => issue.message).join(', ');
    res.status(400).json(errorResponse(message || 'Validation failed'));
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const statusCode = error.code === 'P2025' ? 404 : 400;
    res.status(statusCode).json(errorResponse(getPrismaErrorMessage(error)));
    return;
  }

  logger.error({ error }, 'Unhandled request error');

  res
    .status(500)
    .json(
      errorResponse(
        env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message || 'Internal server error',
      ),
    );
};
