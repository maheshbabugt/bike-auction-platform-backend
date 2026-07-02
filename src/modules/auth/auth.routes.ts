import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authController } from './auth.controller';

export const authRoutes = Router();

authRoutes.post('/register', authController.register);
authRoutes.post('/login', authController.login);
authRoutes.get('/me', authMiddleware, authController.me);
