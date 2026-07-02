import { AuctionStatus, Prisma } from '../generated/prisma';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { emitAuctionEnded, emitAuctionStarted } from '../sockets/auction.socket';
import { logger } from '../utils/logger';

const AUCTION_LIFECYCLE_INTERVAL_MS = 30_000;

let lifecycleInterval: NodeJS.Timeout | null = null;

const toNumber = (value: Prisma.Decimal | number) => Number(value);

const autoStartScheduledAuctions = async (now: Date) => {
  const auctions = await prisma.auction.findMany({
    where: {
      status: AuctionStatus.SCHEDULED,
      startTime: { lte: now },
    },
    select: { id: true },
  });

  for (const auction of auctions) {
    try {
      const updatedAuction = await prisma.$transaction(async (tx) => {
        const result = await tx.auction.updateMany({
          where: { id: auction.id, status: AuctionStatus.SCHEDULED },
          data: { status: AuctionStatus.LIVE },
        });

        if (result.count === 0) {
          return null;
        }

        await tx.auditLog.create({
          data: {
            action: 'AUCTION_AUTO_STARTED',
            entityType: 'Auction',
            entityId: auction.id,
          },
        });

        return tx.auction.findUnique({ where: { id: auction.id } });
      });

      if (!updatedAuction) {
        continue;
      }

      emitAuctionStarted(auction.id, {
        auctionId: auction.id,
        status: 'LIVE',
      });
      logger.info({ auctionId: auction.id }, 'AUCTION_AUTO_STARTED');
    } catch (error) {
      logger.error({ error, auctionId: auction.id }, 'Auction auto-start failed');
    }
  }
};

const autoEndLiveAuctions = async (now: Date) => {
  const auctions = await prisma.auction.findMany({
    where: {
      status: AuctionStatus.LIVE,
      endTime: { lte: now },
    },
    select: { id: true },
  });

  for (const auction of auctions) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existingAuction = await tx.auction.findFirst({
          where: { id: auction.id, status: AuctionStatus.LIVE },
        });

        if (!existingAuction) {
          return null;
        }

        const highestBid = await tx.bid.findFirst({
          where: { auctionId: auction.id },
          orderBy: { amount: 'desc' },
        });

        await tx.auction.update({
          where: { id: auction.id },
          data: {
            status: AuctionStatus.ENDED,
            winnerUserId: highestBid?.userId ?? null,
            currentHighestBid:
              highestBid?.amount ?? existingAuction.currentHighestBid,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'AUCTION_AUTO_ENDED',
            entityType: 'Auction',
            entityId: auction.id,
            metadata: {
              winnerUserId: highestBid?.userId ?? null,
              winningBid: highestBid ? highestBid.amount : null,
            },
          },
        });

        return { highestBid };
      });

      if (!result) {
        continue;
      }

      emitAuctionEnded(auction.id, {
        auctionId: auction.id,
        status: 'ENDED',
        winnerUserId: result.highestBid?.userId ?? null,
        winningBid: result.highestBid ? toNumber(result.highestBid.amount) : null,
      });
      logger.info({ auctionId: auction.id }, 'AUCTION_AUTO_ENDED');
    } catch (error) {
      logger.error({ error, auctionId: auction.id }, 'Auction auto-end failed');
    }
  }
};

export const runAuctionLifecycleCycle = async () => {
  try {
    const now = new Date();
    await autoStartScheduledAuctions(now);
    await autoEndLiveAuctions(now);
  } catch (error) {
    logger.error({ error }, 'Auction lifecycle cycle failed');
  }
};

export const startAuctionLifecycleJob = () => {
  if (env.nodeEnv === 'test' || lifecycleInterval) {
    return;
  }

  void runAuctionLifecycleCycle();
  lifecycleInterval = setInterval(() => {
    void runAuctionLifecycleCycle();
  }, AUCTION_LIFECYCLE_INTERVAL_MS);

  logger.info('Auction lifecycle job started');
};

export const stopAuctionLifecycleJob = () => {
  if (!lifecycleInterval) {
    return;
  }

  clearInterval(lifecycleInterval);
  lifecycleInterval = null;
};
