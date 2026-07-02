import { AuctionStatus, Prisma } from '../../generated/prisma';
import { prisma } from '../../config/prisma';
import { emitAuctionCancelled, emitAuctionEnded, emitAuctionStarted } from '../../sockets/auction.socket';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { CreateAuctionInput, ListAuctionsQuery } from './auction.validation';

const auctionInclude = {
  bike: true,
  winner: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  _count: {
    select: {
      bids: true,
    },
  },
} satisfies Prisma.AuctionInclude;

const auctionDetailInclude = {
  bike: true,
  winner: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  bids: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.AuctionInclude;

const statusPriority: Record<AuctionStatus, number> = {
  LIVE: 1,
  SCHEDULED: 2,
  ENDED: 3,
  CANCELLED: 4,
};

const toNumber = (value: Prisma.Decimal | number) => Number(value);

export const auctionService = {
  async list(query: ListAuctionsQuery) {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.AuctionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.bike = {
        OR: [
          { brand: { contains: query.search, mode: 'insensitive' } },
          { model: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: auctionInclude,
        orderBy: [{ startTime: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auction.count({ where }),
    ]);

    items.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getById(id: string) {
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: auctionDetailInclude,
    });

    if (!auction) {
      throw new ApiError(404, 'Auction not found');
    }

    return auction;
  },

  async getBids(id: string) {
    const auction = await prisma.auction.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!auction) {
      throw new ApiError(404, 'Auction not found');
    }

    return prisma.bid.findMany({
      where: { auctionId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async create(input: CreateAuctionInput, createdById: string) {
    const bike = await prisma.bike.findUnique({
      where: { id: input.bikeId },
      include: {
        auctions: {
          where: {
            status: { in: [AuctionStatus.SCHEDULED, AuctionStatus.LIVE] },
          },
          select: { id: true },
        },
      },
    });

    if (!bike) {
      throw new ApiError(404, 'Bike not found');
    }

    if (bike.auctions.length > 0) {
      throw new ApiError(
        409,
        'Bike already has a scheduled or live auction',
      );
    }

    if (input.startingPrice < toNumber(bike.basePrice)) {
      throw new ApiError(400, 'Starting price must be at least the bike base price');
    }

    const auction = await prisma.$transaction(async (tx) => {
      const createdAuction = await tx.auction.create({
        data: {
          bikeId: input.bikeId,
          startingPrice: input.startingPrice,
          currentHighestBid: input.startingPrice,
          minimumIncrement: input.minimumIncrement,
          startTime: input.startTime,
          endTime: input.endTime,
          status: AuctionStatus.SCHEDULED,
          winnerUserId: null,
          createdById,
        },
        include: auctionInclude,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: createdById,
          action: 'AUCTION_CREATED',
          entityType: 'Auction',
          entityId: createdAuction.id,
          metadata: {
            bikeId: createdAuction.bikeId,
            startingPrice: createdAuction.startingPrice,
          },
        },
      });

      return createdAuction;
    });

    logger.info({ auctionId: auction.id, createdById }, 'AUCTION_CREATED');
    return auction;
  },

  async start(id: string, actorUserId: string) {
    const auction = await prisma.$transaction(async (tx) => {
      const existingAuction = await tx.auction.findUnique({ where: { id } });

      if (!existingAuction) {
        throw new ApiError(404, 'Auction not found');
      }

      if (existingAuction.status !== AuctionStatus.SCHEDULED) {
        throw new ApiError(409, 'Only scheduled auctions can be started');
      }

      const updatedAuction = await tx.auction.update({
        where: { id },
        data: { status: AuctionStatus.LIVE },
        include: auctionInclude,
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'AUCTION_STARTED',
          entityType: 'Auction',
          entityId: id,
          metadata: {
            manualOverride: existingAuction.startTime > new Date(),
          },
        },
      });

      return updatedAuction;
    });

    emitAuctionStarted(id, { auctionId: id, status: 'LIVE' });
    logger.info({ auctionId: id, actorUserId }, 'AUCTION_STARTED');
    return auction;
  },

  async end(id: string, actorUserId: string) {
    const auction = await prisma.$transaction(async (tx) => {
      const existingAuction = await tx.auction.findUnique({ where: { id } });

      if (!existingAuction) {
        throw new ApiError(404, 'Auction not found');
      }

      const endableStatuses: AuctionStatus[] = [AuctionStatus.LIVE, AuctionStatus.SCHEDULED];
      if (!endableStatuses.includes(existingAuction.status)) {
        throw new ApiError(409, 'Only live or scheduled auctions can be ended');
      }

      const highestBid = await tx.bid.findFirst({
        where: { auctionId: id },
        orderBy: { amount: 'desc' },
      });

      const updatedAuction = await tx.auction.update({
        where: { id },
        data: {
          status: AuctionStatus.ENDED,
          winnerUserId: highestBid?.userId ?? null,
          currentHighestBid: highestBid?.amount ?? existingAuction.currentHighestBid,
        },
        include: auctionInclude,
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'AUCTION_ENDED',
          entityType: 'Auction',
          entityId: id,
          metadata: {
            winnerUserId: highestBid?.userId ?? null,
            winningBid: highestBid ? highestBid.amount : null,
          },
        },
      });

      return { updatedAuction, highestBid };
    });

    emitAuctionEnded(id, {
      auctionId: id,
      status: 'ENDED',
      winnerUserId: auction.highestBid?.userId ?? null,
      winningBid: auction.highestBid ? toNumber(auction.highestBid.amount) : null,
    });
    logger.info({ auctionId: id, actorUserId }, 'AUCTION_ENDED');
    return auction.updatedAuction;
  },

  async cancel(id: string, actorUserId: string) {
    const auction = await prisma.$transaction(async (tx) => {
      const existingAuction = await tx.auction.findUnique({ where: { id } });

      if (!existingAuction) {
        throw new ApiError(404, 'Auction not found');
      }

      const cancellableStatuses: AuctionStatus[] = [AuctionStatus.SCHEDULED, AuctionStatus.LIVE];
      if (!cancellableStatuses.includes(existingAuction.status)) {
        throw new ApiError(409, 'Only scheduled or live auctions can be cancelled');
      }

      const updatedAuction = await tx.auction.update({
        where: { id },
        data: { status: AuctionStatus.CANCELLED },
        include: auctionInclude,
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'AUCTION_CANCELLED',
          entityType: 'Auction',
          entityId: id,
        },
      });

      return updatedAuction;
    });

    emitAuctionCancelled(id, { auctionId: id, status: 'CANCELLED' });
    logger.info({ auctionId: id, actorUserId }, 'AUCTION_CANCELLED');
    return auction;
  },
};
