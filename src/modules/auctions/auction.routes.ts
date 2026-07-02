import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { bidRateLimiter } from '../../middlewares/rateLimit.middleware';
import { bidController } from '../bids/bid.controller';
import { auctionController } from './auction.controller';

export const auctionRoutes = Router();
export const adminAuctionRoutes = Router();

auctionRoutes.get('/', auctionController.list);
auctionRoutes.get('/:id', auctionController.getById);
auctionRoutes.get('/:id/bids', auctionController.getBids);
auctionRoutes.post(
  '/:auctionId/bids',
  authMiddleware,
  requireRole('BUYER'),
  bidRateLimiter,
  bidController.placeBid,
);

adminAuctionRoutes.use(authMiddleware, requireRole('ADMIN'));
adminAuctionRoutes.post('/', auctionController.create);
adminAuctionRoutes.post('/:id/start', auctionController.start);
adminAuctionRoutes.post('/:id/end', auctionController.end);
adminAuctionRoutes.post('/:id/cancel', auctionController.cancel);
