import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let io: Server | null = null;

const auctionRoom = (auctionId: string) => `auction:${auctionId}`;

const hasAuctionId = (payload: unknown): payload is { auctionId: string } =>
  typeof payload === 'object' &&
  payload !== null &&
  typeof (payload as { auctionId?: unknown }).auctionId === 'string';

export const initializeAuctionSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Socket connected');
    socket.emit('connected', { socketId: socket.id });

    socket.on('join_auction', (payload) => {
      if (!hasAuctionId(payload)) {
        return;
      }

      socket.join(auctionRoom(payload.auctionId));
      socket.emit('joined_auction', { auctionId: payload.auctionId });
    });

    socket.on('leave_auction', (payload) => {
      if (!hasAuctionId(payload)) {
        return;
      }

      socket.leave(auctionRoom(payload.auctionId));
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Socket disconnected');
    });
  });

  return io;
};

const emitToAuction = (auctionId: string, event: string, payload: object) => {
  io?.to(auctionRoom(auctionId)).emit(event, payload);
};

export type BidPlacedPayload = {
  auctionId: string;
  amount: number;
  bidderName: string;
  userId: string;
  createdAt: Date;
};

export const emitBidPlaced = (auctionId: string, payload: BidPlacedPayload) => {
  emitToAuction(auctionId, 'bid_placed', payload);
};

export const emitAuctionStarted = (
  auctionId: string,
  payload: { auctionId: string; status: 'LIVE' },
) => {
  emitToAuction(auctionId, 'auction_started', payload);
};

export const emitAuctionEnded = (
  auctionId: string,
  payload: {
    auctionId: string;
    status: 'ENDED';
    winnerUserId: string | null;
    winningBid: number | null;
  },
) => {
  emitToAuction(auctionId, 'auction_ended', payload);
};

export const emitAuctionCancelled = (
  auctionId: string,
  payload: { auctionId: string; status: 'CANCELLED' },
) => {
  emitToAuction(auctionId, 'auction_cancelled', payload);
};
