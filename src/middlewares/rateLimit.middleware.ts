import { NextFunction, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { connectRedis, isRedisAvailable, redis } from '../config/redis';
import { ApiError } from '../utils/ApiError';

const BID_LIMIT = 5;
const BID_WINDOW_SECONDS = 10;

const fallbackBidRateLimiter = rateLimit({
  windowMs: BID_WINDOW_SECONDS * 1000,
  limit: BID_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auctionId = req.params.auctionId ?? 'unknown-auction';
    const userId = req.user?.id ?? ipKeyGenerator(req.ip ?? 'anonymous');
    return `rate:bid:${auctionId}:${userId}`;
  },
  message: {
    success: false,
    message: 'Too many bids. Please wait before bidding again.',
  },
});

export const bidRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const auctionId = req.params.auctionId;
  const userId = req.user?.id;

  if (!redis || !auctionId || !userId) {
    fallbackBidRateLimiter(req, res, next);
    return;
  }

  await connectRedis();

  if (!isRedisAvailable()) {
    fallbackBidRateLimiter(req, res, next);
    return;
  }

  try {
    const key = `rate:bid:${auctionId}:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, BID_WINDOW_SECONDS);
    }

    if (count > BID_LIMIT) {
      next(new ApiError(429, 'Too many bids. Please wait before bidding again.'));
      return;
    }

    next();
  } catch {
    fallbackBidRateLimiter(req, res, next);
  }
};
