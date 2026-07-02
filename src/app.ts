import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { adminDashboardRoutes } from './modules/admin/dashboard.routes';
import { authRoutes } from './modules/auth/auth.routes';
import {
  adminAuctionRoutes,
  auctionRoutes,
} from './modules/auctions/auction.routes';
import { bidRoutes } from './modules/bids/bid.routes';
import {
  adminBikeRoutes,
  publicBikeRoutes,
} from './modules/bikes/bike.routes';
import { ApiError } from './utils/ApiError';
import { successResponse } from './utils/response';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json(successResponse('Service is healthy', { status: 'ok' }));
});

app.use('/api/auth', authRoutes);
app.use('/api/bikes', publicBikeRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/bikes', adminBikeRoutes);
app.use('/api/admin/auctions', adminAuctionRoutes);

app.use((_req, _res, next) => {
  next(new ApiError(404, 'Route not found'));
});

app.use(errorMiddleware);
