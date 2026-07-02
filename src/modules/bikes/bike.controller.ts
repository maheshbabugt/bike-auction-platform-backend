import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { successResponse } from '../../utils/response';
import { bikeService } from './bike.service';
import {
  bikeIdSchema,
  createBikeSchema,
  listBikesSchema,
  updateBikeSchema,
} from './bike.validation';

export const bikeController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { query } = listBikesSchema.parse({ query: req.query });
      const result = await bikeService.list(query);

      res.status(200).json(successResponse('Bikes fetched successfully', result));
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { params } = bikeIdSchema.parse({ params: req.params });
      const bike = await bikeService.getById(params.id);

      res.status(200).json(successResponse('Bike fetched successfully', { bike }));
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication is required');
      }

      const { body } = createBikeSchema.parse({ body: req.body });
      const bike = await bikeService.create(body, req.user.id);

      res.status(201).json(successResponse('Bike created successfully', { bike }));
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication is required');
      }

      const { params, body } = updateBikeSchema.parse({
        params: req.params,
        body: req.body,
      });
      const bike = await bikeService.update(params.id, body, req.user.id);

      res.status(200).json(successResponse('Bike updated successfully', { bike }));
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication is required');
      }

      const { params } = bikeIdSchema.parse({ params: req.params });
      await bikeService.delete(params.id, req.user.id);

      res.status(200).json(successResponse('Bike deleted successfully'));
    } catch (error) {
      next(error);
    }
  },
};
