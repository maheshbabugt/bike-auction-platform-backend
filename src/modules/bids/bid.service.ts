import { AuctionStatus, Prisma } from '../../generated/prisma';
import { prisma } from '../../config/prisma';
import { emitBidPlaced } from '../../sockets/auction.socket';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';

const toNumber = (value: Prisma.Decimal | number) => Number(value);

type LockedAuctionRow = {
  id: string;
  status: AuctionStatus;
  currentHighestBid: Prisma.Decimal;
  minimumIncrement: Prisma.Decimal;
  startTime: Date;
  endTime: Date;
};

export const bidService = {
  async placeBid(auctionId: string, userId: string, amount: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });

    if (!user) {
      logger.warn({ auctionId, userId, reason: 'user_not_found' }, 'BID_REJECTED');
      throw new ApiError(401, 'Authentication is required');
    }

    if (user.role !== 'BUYER') {
      logger.warn({ auctionId, userId, reason: 'admin_cannot_bid' }, 'BID_REJECTED');
      throw new ApiError(403, 'Admins cannot place bids');
    }

    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockedAuctionRow[]>`
        SELECT id, status, "currentHighestBid", "minimumIncrement", "startTime", "endTime"
        FROM "Auction"
        WHERE id = ${auctionId}::uuid
        FOR UPDATE
      `;
      const auction = rows[0];

      if (!auction) {
        logger.warn({ auctionId, userId, reason: 'auction_not_found' }, 'BID_REJECTED');
        throw new ApiError(404, 'Auction not found');
      }

      if (auction.status !== AuctionStatus.LIVE) {
        logger.warn({ auctionId, userId, reason: 'auction_not_live' }, 'BID_REJECTED');
        throw new ApiError(409, 'Auction is not live');
      }

      const now = new Date();
      if (now < auction.startTime || now > auction.endTime) {
        logger.warn({ auctionId, userId, reason: 'auction_not_active_by_time' }, 'BID_REJECTED');
        throw new ApiError(409, 'Auction is not currently active');
      }

      const minimumBid = toNumber(auction.currentHighestBid) + toNumber(auction.minimumIncrement);
      if (amount < minimumBid) {
        logger.warn({ auctionId, userId, amount, minimumBid, reason: 'bid_too_low' }, 'BID_REJECTED');
        throw new ApiError(400, `Bid must be at least ${minimumBid}`);
      }

      const bid = await tx.bid.create({
        data: {
          auctionId,
          userId,
          amount,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await tx.auction.update({
        where: { id: auctionId },
        data: {
          currentHighestBid: amount,
          winnerUserId: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'BID_PLACED',
          entityType: 'Bid',
          entityId: bid.id,
          metadata: {
            auctionId,
            amount,
          },
        },
      });

      return bid;
    });

    logger.info({ auctionId, userId, bidId: result.id, amount }, 'BID_PLACED');
    emitBidPlaced(auctionId, {
      auctionId,
      amount,
      bidderName: result.user.name,
      userId,
      createdAt: result.createdAt,
    });

    return result;
  },

  async getMyBids(userId: string) {
    return prisma.bid.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        auction: {
          include: {
            bike: true,
          },
        },
      },
    });
  },
};
