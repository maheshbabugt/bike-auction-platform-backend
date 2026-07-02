import { AuctionStatus } from '../../generated/prisma';
import { prisma } from '../../config/prisma';

export const dashboardService = {
  async stats() {
    const [
      totalBikes,
      totalAuctions,
      liveAuctions,
      scheduledAuctions,
      endedAuctions,
      cancelledAuctions,
      totalBids,
      recentAuctions,
      recentBids,
    ] = await Promise.all([
      prisma.bike.count(),
      prisma.auction.count(),
      prisma.auction.count({ where: { status: AuctionStatus.LIVE } }),
      prisma.auction.count({ where: { status: AuctionStatus.SCHEDULED } }),
      prisma.auction.count({ where: { status: AuctionStatus.ENDED } }),
      prisma.auction.count({ where: { status: AuctionStatus.CANCELLED } }),
      prisma.bid.count(),
      prisma.auction.findMany({
        include: {
          bike: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.bid.findMany({
        include: {
          auction: {
            include: {
              bike: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      totalBikes,
      totalAuctions,
      liveAuctions,
      scheduledAuctions,
      endedAuctions,
      cancelledAuctions,
      totalBids,
      recentAuctions,
      recentBids,
    };
  },
};
