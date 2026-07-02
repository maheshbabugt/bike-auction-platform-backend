import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  REDIS_URL: z.string().url().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const missingValues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');

  throw new Error(`Invalid environment configuration: ${missingValues}`);
}

const rawEnv = parsedEnv.data;

export const env = {
  ...rawEnv,
  port: rawEnv.PORT,
  nodeEnv: rawEnv.NODE_ENV,
  databaseUrl: rawEnv.DATABASE_URL,
  jwtSecret: rawEnv.JWT_SECRET,
  jwtExpiresIn: rawEnv.JWT_EXPIRES_IN,
  frontendUrl: rawEnv.FRONTEND_URL,
  redisUrl: rawEnv.REDIS_URL,
};

export type Env = typeof env;
