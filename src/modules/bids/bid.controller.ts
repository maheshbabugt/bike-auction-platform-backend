import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { successResponse } from '../../utils/response';
import { bidService } from './bid.service';
import { placeBidSchema } from './bid.validation';

export const bidController = {
  async placeBid(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication is required');
      }

      if (req.user.role !== 'BUYER') {
        throw new ApiError(403, 'Admins cannot place bids');
      }

      const { params, body } = placeBidSchema.parse({
        params: req.params,
        body: req.body,
      });
      const bid = await bidService.placeBid(params.auctionId, req.user.id, body.amount);

      res.status(201).json(successResponse('Bid placed successfully', { bid }));
    } catch (error) {
      next(error);
    }
  },

  async myBids(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication is required');
      }

      const bids = await bidService.getMyBids(req.user.id);
      res.status(200).json(successResponse('Bid history fetched successfully', { bids }));
    } catch (error) {
      next(error);
    }
  },
};
