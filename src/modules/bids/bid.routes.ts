import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { bidController } from './bid.controller';

export const bidRoutes = Router();

bidRoutes.get('/me', authMiddleware, requireRole('BUYER'), bidController.myBids);
