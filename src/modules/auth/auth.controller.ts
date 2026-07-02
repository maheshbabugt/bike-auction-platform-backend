import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { successResponse } from '../../utils/response';
import { authService } from './auth.service';
import { loginSchema, registerSchema } from './auth.validation';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { body } = registerSchema.parse({ body: req.body });
      const result = await authService.register(body);

      res
        .status(201)
        .json(successResponse('Registration successful', result));
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { body } = loginSchema.parse({ body: req.body });
      const result = await authService.login(body);

      res.status(200).json(successResponse('Login successful', result));
    } catch (error) {
      next(error);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication is required');
      }

      const user = await authService.me(req.user.id);

      res
        .status(200)
        .json(successResponse('Current user fetched successfully', { user }));
    } catch (error) {
      next(error);
    }
  },
};
