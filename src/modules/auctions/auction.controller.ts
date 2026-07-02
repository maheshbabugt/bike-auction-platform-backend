import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { successResponse } from '../../utils/response';
import { auctionService } from './auction.service';
import {
  auctionIdSchema,
  createAuctionSchema,
  listAuctionsSchema,
} from './auction.validation';

export const auctionController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { query } = listAuctionsSchema.parse({ query: req.query });
      const result = await auctionService.list(query);
      res.status(200).json(successResponse('Auctions fetched successfully', result));
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { params } = auctionIdSchema.parse({ params: req.params });
      const auction = await auctionService.getById(params.id);
      res.status(200).json(successResponse('Auction fetched successfully', { auction }));
    } catch (error) {
      next(error);
    }
  },

  async getBids(req: Request, res: Response, next: NextFunction) {
    try {
      const { params } = auctionIdSchema.parse({ params: req.params });
      const bids = await auctionService.getBids(params.id);
      res.status(200).json(successResponse('Auction bids fetched successfully', { bids }));
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication is required');
      }

      const { body } = createAuctionSchema.parse({ body: req.body });
      const auction = await auctionService.create(body, req.user.id);
      res.status(201).json(successResponse('Auction created successfully', { auction }));
    } catch (error) {
      next(error);
    }
  },

  async start(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication is required');
      }

      const { params } = auctionIdSchema.parse({ params: req.params });
      const auction = await auctionService.start(params.id, req.user.id);
      res.status(200).json(successResponse('Auction started successfully', { auction }));
    } catch (error) {
      next(error);
    }
  },

  async end(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication is required');
      }

      const { params } = auctionIdSchema.parse({ params: req.params });
      const auction = await auctionService.end(params.id, req.user.id);
      res.status(200).json(successResponse('Auction ended successfully', { auction }));
    } catch (error) {
      next(error);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication is required');
      }

      const { params } = auctionIdSchema.parse({ params: req.params });
      const auction = await auctionService.cancel(params.id, req.user.id);
      res.status(200).json(successResponse('Auction cancelled successfully', { auction }));
    } catch (error) {
      next(error);
    }
  },
};
