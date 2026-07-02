import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AuctionStatus,
  BikeCondition,
  FuelType,
  PrismaClient,
  Role,
} from '../src/generated/prisma';
import { bidService } from '../src/modules/bids/bid.service';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function main() {
  const passwordHash = await bcrypt.hash('Concurrency@123', 10);
  const admin = await prisma.user.create({
    data: {
      name: 'Concurrency Admin',
      email: `concurrency-admin-${suffix}@test.local`,
      passwordHash,
      role: Role.ADMIN,
    },
  });
  const buyer1 = await prisma.user.create({
    data: {
      name: 'Concurrency Buyer 1',
      email: `concurrency-buyer1-${suffix}@test.local`,
      passwordHash,
      role: Role.BUYER,
    },
  });
  const buyer2 = await prisma.user.create({
    data: {
      name: 'Concurrency Buyer 2',
      email: `concurrency-buyer2-${suffix}@test.local`,
      passwordHash,
      role: Role.BUYER,
    },
  });
  const bike = await prisma.bike.create({
    data: {
      brand: 'Concurrency',
      model: 'Lock Test',
      year: 2024,
      registrationNumber: `CONC-${suffix}`.slice(0, 30),
      kmsDriven: 1,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.EXCELLENT,
      basePrice: 100000,
      createdById: admin.id,
    },
  });
  const auction = await prisma.auction.create({
    data: {
      bikeId: bike.id,
      startingPrice: 100000,
      currentHighestBid: 100000,
      minimumIncrement: 1000,
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 3_600_000),
      status: AuctionStatus.LIVE,
      createdById: admin.id,
    },
  });

  try {
    const results = await Promise.allSettled([
      bidService.placeBid(auction.id, buyer1.id, 101000),
      bidService.placeBid(auction.id, buyer2.id, 102000),
    ]);
    const finalAuction = await prisma.auction.findUniqueOrThrow({
      where: { id: auction.id },
    });
    const highestBid = Number(finalAuction.currentHighestBid);

    console.log(
      JSON.stringify(
        { results: results.map((result) => result.status), highestBid },
        null,
        2,
      ),
    );

    if (highestBid !== 102000) {
      throw new Error(`Expected highest bid 102000, got ${highestBid}`);
    }
  } finally {
    await prisma.bid.deleteMany({ where: { auctionId: auction.id } });
    await prisma.auction.delete({ where: { id: auction.id } });
    await prisma.bike.delete({ where: { id: bike.id } });
    await prisma.auditLog.deleteMany({
      where: { actorUserId: { in: [admin.id, buyer1.id, buyer2.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [admin.id, buyer1.id, buyer2.id] } },
    });
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
