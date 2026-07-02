import { AuctionStatus, Prisma } from '../../generated/prisma';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import {
  CreateBikeInput,
  ListBikesQuery,
  UpdateBikeInput,
} from './bike.validation';

const bikeInclude = {
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  _count: {
    select: {
      auctions: true,
    },
  },
} satisfies Prisma.BikeInclude;

const bikeDetailInclude = {
  ...bikeInclude,
  auctions: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 3,
    select: {
      id: true,
      status: true,
      startingPrice: true,
      currentHighestBid: true,
      startTime: true,
      endTime: true,
    },
  },
} satisfies Prisma.BikeInclude;

const normalizeRegistrationNumber = (registrationNumber: string) =>
  registrationNumber.trim().toUpperCase();

export const bikeService = {
  async list(query: ListBikesQuery) {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.BikeWhereInput = {};

    if (query.search) {
      where.OR = [
        { brand: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
        {
          registrationNumber: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.brand) {
      where.brand = { equals: query.brand, mode: 'insensitive' };
    }

    if (query.fuelType) {
      where.fuelType = query.fuelType;
    }

    if (query.condition) {
      where.condition = query.condition;
    }

    const [items, total] = await Promise.all([
      prisma.bike.findMany({
        where,
        include: bikeInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bike.count({ where }),
    ]);

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
    const bike = await prisma.bike.findUnique({
      where: { id },
      include: bikeDetailInclude,
    });

    if (!bike) {
      throw new ApiError(404, 'Bike not found');
    }

    return bike;
  },

  async create(input: CreateBikeInput, createdById: string) {
    const registrationNumber = normalizeRegistrationNumber(
      input.registrationNumber,
    );

    const existingBike = await prisma.bike.findUnique({
      where: { registrationNumber },
      select: { id: true },
    });

    if (existingBike) {
      throw new ApiError(409, 'Registration number is already in use');
    }

    const bike = await prisma.$transaction(async (tx) => {
      const createdBike = await tx.bike.create({
        data: {
          ...input,
          registrationNumber,
          createdById,
        },
        include: bikeInclude,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: createdById,
          action: 'BIKE_CREATED',
          entityType: 'Bike',
          entityId: createdBike.id,
          metadata: {
            registrationNumber: createdBike.registrationNumber,
          },
        },
      });

      return createdBike;
    });

    logger.info({ bikeId: bike.id, createdById }, 'Bike created');
    return bike;
  },

  async update(id: string, input: UpdateBikeInput, actorUserId: string) {
    const existingBike = await prisma.bike.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingBike) {
      throw new ApiError(404, 'Bike not found');
    }

    const data: Prisma.BikeUpdateInput = { ...input };

    if (input.registrationNumber) {
      const registrationNumber = normalizeRegistrationNumber(
        input.registrationNumber,
      );
      const duplicateBike = await prisma.bike.findUnique({
        where: { registrationNumber },
        select: { id: true },
      });

      if (duplicateBike && duplicateBike.id !== id) {
        throw new ApiError(409, 'Registration number is already in use');
      }

      data.registrationNumber = registrationNumber;
    }

    const bike = await prisma.$transaction(async (tx) => {
      const updatedBike = await tx.bike.update({
        where: { id },
        data,
        include: bikeInclude,
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'BIKE_UPDATED',
          entityType: 'Bike',
          entityId: updatedBike.id,
          metadata: {
            updatedFields: Object.keys(input),
          },
        },
      });

      return updatedBike;
    });

    logger.info({ bikeId: bike.id, actorUserId }, 'Bike updated');
    return bike;
  },

  async delete(id: string, actorUserId: string) {
    const bike = await prisma.bike.findUnique({
      where: { id },
      include: {
        auctions: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!bike) {
      throw new ApiError(404, 'Bike not found');
    }

    const activeAuctionStatuses: AuctionStatus[] = [
      AuctionStatus.LIVE,
      AuctionStatus.SCHEDULED,
    ];
    const hasActiveAuction = bike.auctions.some((auction) =>
      activeAuctionStatuses.includes(auction.status),
    );

    if (hasActiveAuction) {
      throw new ApiError(
        409,
        'Cannot delete a bike with a live or scheduled auction',
      );
    }

    await prisma.$transaction(async (tx) => {
      const auctionIds = bike.auctions.map((auction) => auction.id);

      if (auctionIds.length > 0) {
        await tx.bid.deleteMany({
          where: { auctionId: { in: auctionIds } },
        });
        await tx.auction.deleteMany({
          where: { id: { in: auctionIds } },
        });
      }

      await tx.bike.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'BIKE_DELETED',
          entityType: 'Bike',
          entityId: id,
          metadata: {
            registrationNumber: bike.registrationNumber,
          },
        },
      });
    });

    logger.info({ bikeId: id, actorUserId }, 'Bike deleted');
  },
};
