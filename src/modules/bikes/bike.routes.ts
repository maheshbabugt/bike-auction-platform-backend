import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { bikeController } from './bike.controller';

export const publicBikeRoutes = Router();
export const adminBikeRoutes = Router();

publicBikeRoutes.get('/', bikeController.list);
publicBikeRoutes.get('/:id', bikeController.getById);

adminBikeRoutes.use(authMiddleware, requireRole('ADMIN'));
adminBikeRoutes.post('/', bikeController.create);
adminBikeRoutes.put('/:id', bikeController.update);
adminBikeRoutes.delete('/:id', bikeController.delete);
