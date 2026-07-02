import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { dashboardController } from './dashboard.controller';

export const adminDashboardRoutes = Router();

adminDashboardRoutes.use(authMiddleware, requireRole('ADMIN'));
adminDashboardRoutes.get('/stats', dashboardController.stats);
