import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import {
  AuctionStatus,
  BikeCondition,
  FuelType,
  PrismaClient,
  Role,
} from '../src/generated/prisma';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });
const PASSWORD_SALT_ROUNDS = 12;

const demoEmails = [
  'admin@bikeauction.com',
  'buyer@bikeauction.com',
  'buyer2@bikeauction.com',
  'dhana@bikeauction.com',
];

const demoRegistrations = [
  'KA01YA1501',
  'KA02RE3502',
  'KA03KT2003',
  'KA04BP2004',
  'KA05HC3505',
  'KA06TV1606',
  'KA07SG1507',
  'KA08YM1508',
  'KA09JW4209',
  'KA10HA11010',
  'KA11HX20011',
  'KA12OS10012',
];

const createDateAtLocalTime = (
  daysOffset: number,
  hour: number,
  minute = 0,
) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60 * 1000);

const addHours = (date: Date, hours: number) => addMinutes(date, hours * 60);

async function cleanupDemoData() {
  const [demoUsers, demoBikes] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: demoEmails } },
      select: { id: true },
    }),
    prisma.bike.findMany({
      where: { registrationNumber: { in: demoRegistrations } },
      select: { id: true },
    }),
  ]);

  const demoUserIds = demoUsers.map((user) => user.id);
  const demoBikeIds = demoBikes.map((bike) => bike.id);
  const demoAuctions = await prisma.auction.findMany({
    where: { bikeId: { in: demoBikeIds } },
    select: { id: true },
  });
  const demoAuctionIds = demoAuctions.map((auction) => auction.id);

  await prisma.bid.deleteMany({
    where: {
      OR: [
        { userId: { in: demoUserIds } },
        { auctionId: { in: demoAuctionIds } },
      ],
    },
  });
  await prisma.auction.deleteMany({
    where: { id: { in: demoAuctionIds } },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorUserId: { in: demoUserIds } },
        { entityId: { in: [...demoUserIds, ...demoBikeIds, ...demoAuctionIds] } },
        { action: { startsWith: 'DEMO_' } },
      ],
    },
  });
}

async function upsertDemoUsers() {
  const [adminPasswordHash, buyerPasswordHash] = await Promise.all([
    bcrypt.hash('Admin@123', PASSWORD_SALT_ROUNDS),
    bcrypt.hash('Buyer@123', PASSWORD_SALT_ROUNDS),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@bikeauction.com' },
    update: {
      name: 'Demo Admin',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
    create: {
      name: 'Demo Admin',
      email: 'admin@bikeauction.com',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@bikeauction.com' },
    update: {
      name: 'Demo Buyer',
      passwordHash: buyerPasswordHash,
      role: Role.BUYER,
    },
    create: {
      name: 'Demo Buyer',
      email: 'buyer@bikeauction.com',
      passwordHash: buyerPasswordHash,
      role: Role.BUYER,
    },
  });

  const buyer2 = await prisma.user.upsert({
    where: { email: 'buyer2@bikeauction.com' },
    update: {
      name: 'Demo Buyer Two',
      passwordHash: buyerPasswordHash,
      role: Role.BUYER,
    },
    create: {
      name: 'Demo Buyer Two',
      email: 'buyer2@bikeauction.com',
      passwordHash: buyerPasswordHash,
      role: Role.BUYER,
    },
  });

  const buyer3 = await prisma.user.upsert({
    where: { email: 'dhana@bikeauction.com' },
    update: {
      name: 'Dhana Demo Buyer',
      passwordHash: buyerPasswordHash,
      role: Role.BUYER,
    },
    create: {
      name: 'Dhana Demo Buyer',
      email: 'dhana@bikeauction.com',
      passwordHash: buyerPasswordHash,
      role: Role.BUYER,
    },
  });

  return { admin, buyers: [buyer, buyer2, buyer3] };
}

async function upsertDemoBikes(adminId: string) {
  const bikes = [
    {
      brand: 'Yamaha',
      model: 'R15 V4',
      year: 2023,
      registrationNumber: 'KA01YA1501',
      kmsDriven: 6200,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.EXCELLENT,
      basePrice: 158000,
      imageUrl:
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80',
      description: 'Sharp faired sport bike with ABS and recent service.',
    },
    {
      brand: 'Royal Enfield',
      model: 'Classic 350',
      year: 2021,
      registrationNumber: 'KA02RE3502',
      kmsDriven: 14200,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.GOOD,
      basePrice: 172000,
      imageUrl:
        'https://images.unsplash.com/photo-1517846693594-1567da72af75?auto=format&fit=crop&w=1200&q=80',
      description: 'Chrome-accented cruiser with service records.',
    },
    {
      brand: 'KTM',
      model: 'Duke 200',
      year: 2022,
      registrationNumber: 'KA03KT2003',
      kmsDriven: 9800,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.GOOD,
      basePrice: 138000,
      imageUrl:
        'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1200&q=80',
      description: 'Punchy street bike with strong brakes and new tyres.',
    },
    {
      brand: 'Bajaj',
      model: 'Pulsar NS200',
      year: 2020,
      registrationNumber: 'KA04BP2004',
      kmsDriven: 18600,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.GOOD,
      basePrice: 93000,
      imageUrl:
        'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=1200&q=80',
      description: 'Value performance street bike with clean documents.',
    },
    {
      brand: 'Honda',
      model: 'CB350',
      year: 2022,
      registrationNumber: 'KA05HC3505',
      kmsDriven: 7400,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.EXCELLENT,
      basePrice: 182000,
      imageUrl:
        'https://images.unsplash.com/photo-1622185135505-2d795003994a?auto=format&fit=crop&w=1200&q=80',
      description: 'Refined retro roadster with low running.',
    },
    {
      brand: 'TVS',
      model: 'Apache RTR 160',
      year: 2021,
      registrationNumber: 'KA06TV1606',
      kmsDriven: 15400,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.GOOD,
      basePrice: 78000,
      imageUrl:
        'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?auto=format&fit=crop&w=1200&q=80',
      description: 'Agile commuter-sport motorcycle with fresh insurance.',
    },
    {
      brand: 'Suzuki',
      model: 'Gixxer SF',
      year: 2020,
      registrationNumber: 'KA07SG1507',
      kmsDriven: 20300,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.FAIR,
      basePrice: 85000,
      imageUrl:
        'https://images.unsplash.com/photo-1615172282427-9a57ef2d142e?auto=format&fit=crop&w=1200&q=80',
      description: 'Fully faired daily rider with good fuel economy.',
    },
    {
      brand: 'Yamaha',
      model: 'MT-15',
      year: 2023,
      registrationNumber: 'KA08YM1508',
      kmsDriven: 5200,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.EXCELLENT,
      basePrice: 148000,
      imageUrl:
        'https://images.unsplash.com/photo-1619771914272-e3c1ba17ba4d?auto=format&fit=crop&w=1200&q=80',
      description: 'Lightweight naked Yamaha with LED lighting.',
    },
    {
      brand: 'Jawa',
      model: '42',
      year: 2021,
      registrationNumber: 'KA09JW4209',
      kmsDriven: 13200,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.GOOD,
      basePrice: 152000,
      imageUrl:
        'https://cdn.bikedekho.com/processedimages/jawa-motorcycles/jawa-42/source/jawa-4268a70dba46c95.jpg',
      description: 'Modern classic with tasteful touring accessories.',
    },
    {
      brand: 'Honda',
      model: 'Activa 6G',
      year: 2022,
      registrationNumber: 'KA10HA11010',
      kmsDriven: 11200,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.GOOD,
      basePrice: 62000,
      imageUrl:
        'https://images.unsplash.com/photo-1558981852-426c6c22a060?auto=format&fit=crop&w=1200&q=80',
      description: 'Reliable scooter with practical storage and low upkeep.',
    },
    {
      brand: 'Hero',
      model: 'Xpulse 200 4V',
      year: 2023,
      registrationNumber: 'KA11HX20011',
      kmsDriven: 6800,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.EXCELLENT,
      basePrice: 118000,
      imageUrl:
        'https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=1200&q=80',
      description: 'Adventure-ready dual sport with tall stance.',
    },
    {
      brand: 'Ola',
      model: 'S1 Pro',
      year: 2023,
      registrationNumber: 'KA12OS10012',
      kmsDriven: 4100,
      fuelType: FuelType.ELECTRIC,
      condition: BikeCondition.EXCELLENT,
      basePrice: 98000,
      imageUrl:
        'https://imgd.aeplcdn.com/1056x594/n/cw/ec/196991/s1-pro-left-side-view-3.png?isig=0&q=80',
      description: 'Electric scooter with connected features and clean bodywork.',
    },
  ];

  return Promise.all(
    bikes.map((bike) =>
      prisma.bike.upsert({
        where: { registrationNumber: bike.registrationNumber },
        update: { ...bike, createdById: adminId },
        create: { ...bike, createdById: adminId },
      }),
    ),
  );
}

async function createAuctionWithBids(params: {
  bikeId: string;
  createdById: string;
  buyers: { id: string }[];
  startingPrice: number;
  minimumIncrement: number;
  startTime: Date;
  endTime: Date;
  status: AuctionStatus;
  bidAmounts?: number[];
}) {
  const highestBid = params.bidAmounts?.length
    ? Math.max(...params.bidAmounts)
    : null;
  const winnerIndex = highestBid
    ? params.bidAmounts?.findIndex((amount) => amount === highestBid) ?? -1
    : -1;
  const winnerUserId = highestBid ? params.buyers[winnerIndex]?.id ?? null : null;

  const auction = await prisma.auction.create({
    data: {
      bikeId: params.bikeId,
      startingPrice: params.startingPrice,
      currentHighestBid:
        params.status === AuctionStatus.SCHEDULED
          ? params.startingPrice
          : highestBid ?? params.startingPrice,
      minimumIncrement: params.minimumIncrement,
      startTime: params.startTime,
      endTime: params.endTime,
      status: params.status,
      winnerUserId:
        params.status === AuctionStatus.SCHEDULED ? null : winnerUserId,
      createdById: params.createdById,
    },
  });

  if (params.bidAmounts?.length && params.status !== AuctionStatus.SCHEDULED) {
    await prisma.bid.createMany({
      data: params.bidAmounts.map((amount, index) => ({
        auctionId: auction.id,
        userId: params.buyers[index % params.buyers.length].id,
        amount,
      })),
    });
  }

  return auction;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run seed in production');
  }

  await cleanupDemoData();

  const { admin, buyers } = await upsertDemoUsers();
  const bikes = await upsertDemoBikes(admin.id);
  const now = new Date();
  const todayAt11 = createDateAtLocalTime(0, 11);
  const todayAt11End = createDateAtLocalTime(0, 23);
  const today11Status =
    now < todayAt11
      ? AuctionStatus.SCHEDULED
      : now < todayAt11End
        ? AuctionStatus.LIVE
        : AuctionStatus.ENDED;

  await createAuctionWithBids({
    bikeId: bikes[0].id,
    createdById: admin.id,
    buyers,
    startingPrice: 158000,
    minimumIncrement: 1000,
    startTime: addMinutes(now, -30),
    endTime: addHours(now, 3),
    status: AuctionStatus.LIVE,
    bidAmounts: [160000, 162000],
  });

  await createAuctionWithBids({
    bikeId: bikes[1].id,
    createdById: admin.id,
    buyers,
    startingPrice: 172000,
    minimumIncrement: 1500,
    startTime: addMinutes(now, -10),
    endTime: addHours(now, 2),
    status: AuctionStatus.LIVE,
    bidAmounts: [174000, 176500, 179000],
  });

  await createAuctionWithBids({
    bikeId: bikes[2].id,
    createdById: admin.id,
    buyers,
    startingPrice: 138000,
    minimumIncrement: 1000,
    startTime: addHours(now, -1),
    endTime: addHours(now, 4),
    status: AuctionStatus.LIVE,
    bidAmounts: [140000],
  });

  await createAuctionWithBids({
    bikeId: bikes[3].id,
    createdById: admin.id,
    buyers,
    startingPrice: 93000,
    minimumIncrement: 1000,
    startTime:
      today11Status === AuctionStatus.ENDED ? addHours(now, -2) : todayAt11,
    endTime:
      today11Status === AuctionStatus.ENDED ? addMinutes(now, -20) : todayAt11End,
    status: today11Status,
    bidAmounts:
      today11Status === AuctionStatus.SCHEDULED ? undefined : [95000, 98000],
  });

  await createAuctionWithBids({
    bikeId: bikes[4].id,
    createdById: admin.id,
    buyers,
    startingPrice: 182000,
    minimumIncrement: 2000,
    startTime: createDateAtLocalTime(1, 10),
    endTime: createDateAtLocalTime(1, 14),
    status: AuctionStatus.SCHEDULED,
  });

  await createAuctionWithBids({
    bikeId: bikes[5].id,
    createdById: admin.id,
    buyers,
    startingPrice: 78000,
    minimumIncrement: 1000,
    startTime: createDateAtLocalTime(1, 15),
    endTime: createDateAtLocalTime(1, 19),
    status: AuctionStatus.SCHEDULED,
  });

  await createAuctionWithBids({
    bikeId: bikes[6].id,
    createdById: admin.id,
    buyers,
    startingPrice: 85000,
    minimumIncrement: 1000,
    startTime: createDateAtLocalTime(1, 20),
    endTime: createDateAtLocalTime(1, 23),
    status: AuctionStatus.SCHEDULED,
  });

  await createAuctionWithBids({
    bikeId: bikes[7].id,
    createdById: admin.id,
    buyers,
    startingPrice: 148000,
    minimumIncrement: 1000,
    startTime: createDateAtLocalTime(-2, 10),
    endTime: createDateAtLocalTime(-1, 18),
    status: AuctionStatus.ENDED,
    bidAmounts: [150000, 154000, 157000],
  });

  await createAuctionWithBids({
    bikeId: bikes[8].id,
    createdById: admin.id,
    buyers,
    startingPrice: 152000,
    minimumIncrement: 1500,
    startTime: createDateAtLocalTime(-3, 12),
    endTime: createDateAtLocalTime(-2, 20),
    status: AuctionStatus.ENDED,
    bidAmounts: [154000, 158000, 161000],
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: 'DEMO_REALISTIC_SEED_CREATED',
      entityType: 'Seed',
      metadata: {
        users: 4,
        bikes: bikes.length,
      },
    },
  });

  console.log('Realistic demo seed completed');
  console.log('Admin: admin@bikeauction.com / Admin@123');
  console.log('Buyer: buyer@bikeauction.com / Buyer@123');
  console.log('Buyer 2: buyer2@bikeauction.com / Buyer@123');
  console.log('Buyer 3: dhana@bikeauction.com / Buyer@123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
