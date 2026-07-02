import { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../utils/response';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  async stats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await dashboardService.stats();
      res
        .status(200)
        .json(successResponse('Dashboard stats fetched successfully', stats));
    } catch (error) {
      next(error);
    }
  },
};
