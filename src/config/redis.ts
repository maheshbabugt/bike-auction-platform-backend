import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;
let redisHealthy = false;

if (env.REDIS_URL) {
  redisClient = new Redis(env.REDIS_URL, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  redisClient.on('connect', () => {
    redisHealthy = true;
    logger.info('Redis connected');
  });

  redisClient.on('end', () => {
    redisHealthy = false;
  });

  redisClient.on('error', (error) => {
    redisHealthy = false;
    logger.warn({ error }, 'Redis unavailable; continuing without Redis');
  });
}

export const redis = redisClient;

export const isRedisAvailable = () => redisHealthy;

export const connectRedis = async () => {
  if (!redisClient || redisHealthy) {
    return;
  }

  try {
    await redisClient.connect();
  } catch (error) {
    redisHealthy = false;
    logger.warn({ error }, 'Redis connection failed; continuing without Redis');
  }
};
