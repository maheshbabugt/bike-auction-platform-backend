import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '../../generated/prisma';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { LoginInput, RegisterInput } from './auth.validation';

const PASSWORD_SALT_ROUNDS = 12;

type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
};

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

const createToken = (user: Pick<SafeUser, 'id' | 'role'>) => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };

  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    env.JWT_SECRET,
    options,
  );
};

export const authService = {
  async register(input: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ApiError(409, 'Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: Role.BUYER,
        },
        select: safeUserSelect,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: createdUser.id,
          action: 'USER_REGISTERED',
          entityType: 'User',
          entityId: createdUser.id,
          metadata: {
            email: createdUser.email,
            role: createdUser.role,
          },
        },
      });

      return createdUser;
    });

    return {
      token: createToken(user),
      user,
    };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      logger.warn({ email: input.email }, 'Login failed: user not found');
      throw new ApiError(401, 'Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      logger.warn({ userId: user.id }, 'Login failed: invalid password');
      throw new ApiError(401, 'Invalid email or password');
    }

    logger.info({ userId: user.id }, 'Login succeeded');

    const safeUser: SafeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      token: createToken(safeUser),
      user: safeUser,
    };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: safeUserSelect,
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return user;
  },
};
