import bcrypt from 'bcrypt';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import {
  AuctionStatus,
  BikeCondition,
  FuelType,
  Prisma,
  Role,
} from '../src/generated/prisma';
import { app } from '../src/app';
import { prisma } from '../src/config/prisma';

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'Test@12345';
const testBikeImageUrl = 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87';

const emails = {
  admin: `admin-${suffix}@test.bikeauction.com`,
  buyer: `buyer-${suffix}@test.bikeauction.com`,
  buyer2: `buyer2-${suffix}@test.bikeauction.com`,
  registered: `registered-${suffix}@test.bikeauction.com`,
};

const registrations: string[] = [];
const createdAuctionIds: string[] = [];
let adminToken = '';
let buyerToken = '';
let buyer2Token = '';
let adminId = '';
let buyerId = '';
let buyer2Id = '';
let liveAuctionId = '';
let endedAuctionId = '';

const compactRegistration = (prefix: string) =>
  `${prefix}-${suffix}`.replace(/[^A-Za-z0-9-]/g, '').slice(0, 30);

const cleanupIntegrationData = async () => {
  const testUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@test.bikeauction.com' } },
    select: { id: true },
  });
  const userIds = testUsers.map((user) => user.id);

  const testBikes = await prisma.bike.findMany({
    where: {
      OR: [
        { registrationNumber: { startsWith: 'TST-' } },
        { description: { contains: 'Integration test' } },
        { description: { contains: 'Created by integration test' } },
      ],
    },
    select: { id: true },
  });
  const bikeIds = testBikes.map((bike) => bike.id);
  const auctionFilters: Prisma.AuctionWhereInput[] = [];

  if (userIds.length > 0) {
    auctionFilters.push({ createdById: { in: userIds } });
  }

  if (bikeIds.length > 0) {
    auctionFilters.push({ bikeId: { in: bikeIds } });
  }

  const testAuctions = await prisma.auction.findMany({
    where: auctionFilters.length > 0 ? { OR: auctionFilters } : { id: { in: [] } },
    select: { id: true },
  });
  const auctionIds = testAuctions.map((auction) => auction.id);
  const bidFilters: Prisma.BidWhereInput[] = [];
  const auditLogFilters: Prisma.AuditLogWhereInput[] = [];

  if (auctionIds.length > 0) {
    bidFilters.push({ auctionId: { in: auctionIds } });
    auditLogFilters.push({ entityId: { in: auctionIds } });
  }

  if (userIds.length > 0) {
    bidFilters.push({ userId: { in: userIds } });
    auditLogFilters.push({ actorUserId: { in: userIds } });
  }

  if (bikeIds.length > 0) {
    auditLogFilters.push({ entityId: { in: bikeIds } });
  }

  await prisma.bid.deleteMany({
    where: bidFilters.length > 0 ? { OR: bidFilters } : { id: { in: [] } },
  });
  await prisma.auction.deleteMany({ where: { id: { in: auctionIds } } });
  await prisma.auditLog.deleteMany({
    where: auditLogFilters.length > 0 ? { OR: auditLogFilters } : { id: { in: [] } },
  });
  await prisma.bike.deleteMany({ where: { id: { in: bikeIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
};

const createBike = async (registrationNumber: string) => {
  registrations.push(registrationNumber);

  return prisma.bike.create({
    data: {
      brand: 'Test Yamaha',
      model: `R15 ${registrationNumber}`,
      year: 2022,
      registrationNumber,
      kmsDriven: 1000,
      fuelType: FuelType.PETROL,
      condition: BikeCondition.GOOD,
      basePrice: 100000,
      imageUrl: testBikeImageUrl,
      description: 'Integration test bike',
      createdById: adminId,
    },
  });
};

beforeAll(async () => {
  await cleanupIntegrationData();

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Integration Admin',
      email: emails.admin,
      passwordHash,
      role: Role.ADMIN,
    },
  });
  const buyer = await prisma.user.create({
    data: {
      name: 'Integration Buyer',
      email: emails.buyer,
      passwordHash,
      role: Role.BUYER,
    },
  });
  const buyer2 = await prisma.user.create({
    data: {
      name: 'Integration Buyer Two',
      email: emails.buyer2,
      passwordHash,
      role: Role.BUYER,
    },
  });

  adminId = admin.id;
  buyerId = buyer.id;
  buyer2Id = buyer2.id;

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: emails.admin, password });
  const buyerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: emails.buyer, password });
  const buyer2Login = await request(app)
    .post('/api/auth/login')
    .send({ email: emails.buyer2, password });

  adminToken = adminLogin.body.data.token;
  buyerToken = buyerLogin.body.data.token;
  buyer2Token = buyer2Login.body.data.token;

  const auctionBike = await createBike(compactRegistration('TST-AUC'));
  const liveAuction = await prisma.auction.create({
    data: {
      bikeId: auctionBike.id,
      startingPrice: 100000,
      currentHighestBid: 100000,
      minimumIncrement: 1000,
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 60 * 60_000),
      status: AuctionStatus.LIVE,
      createdById: adminId,
    },
  });
  liveAuctionId = liveAuction.id;
  createdAuctionIds.push(liveAuction.id);

  const endedBike = await createBike(compactRegistration('TST-END'));
  const endedAuction = await prisma.auction.create({
    data: {
      bikeId: endedBike.id,
      startingPrice: 100000,
      currentHighestBid: 100000,
      minimumIncrement: 1000,
      startTime: new Date(Date.now() - 2 * 60 * 60_000),
      endTime: new Date(Date.now() - 60_000),
      status: AuctionStatus.ENDED,
      createdById: adminId,
    },
  });
  endedAuctionId = endedAuction.id;
  createdAuctionIds.push(endedAuction.id);
});

afterAll(async () => {
  await cleanupIntegrationData();
  await prisma.$disconnect();
});

describe('health', () => {
  it('returns ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });
});

describe('auth', () => {
  it('registers, logs in, and returns current user', async () => {
    const register = await request(app).post('/api/auth/register').send({
      name: 'Registered Test Buyer',
      email: emails.registered,
      password,
    });

    expect(register.status).toBe(201);
    expect(register.body.data.token).toBeTruthy();
    expect(register.body.data.user.passwordHash).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({
      email: emails.registered,
      password,
    });

    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTruthy();

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(emails.registered);
  });
});

describe('admin protection and bikes', () => {
  it('rejects unauthenticated and buyer access to admin bike creation', async () => {
    const body = {
      brand: 'Test Brand',
      model: 'Admin Only',
      year: 2023,
      registrationNumber: compactRegistration('TST-NOAUTH'),
      kmsDriven: 10,
      fuelType: 'PETROL',
      condition: 'GOOD',
      basePrice: 100000,
    };

    const unauthenticated = await request(app).post('/api/admin/bikes').send(body);
    expect(unauthenticated.status).toBe(401);

    const buyer = await request(app)
      .post('/api/admin/bikes')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(body);
    expect(buyer.status).toBe(403);
  });

  it('allows admin to create a bike', async () => {
    const registrationNumber = compactRegistration('TST-BIKE');
    registrations.push(registrationNumber);

    const response = await request(app)
      .post('/api/admin/bikes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        brand: 'Test KTM',
        model: 'Duke Test',
        year: 2024,
        registrationNumber,
        kmsDriven: 500,
        fuelType: 'PETROL',
        condition: 'EXCELLENT',
        basePrice: 120000,
        imageUrl: testBikeImageUrl,
        description: 'Created by integration test',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.bike.registrationNumber).toBe(registrationNumber);
  });
});

describe('auction creation', () => {
  it('rejects buyer auction creation and allows admin creation', async () => {
    const bike = await createBike(compactRegistration('TST-ADM-AUC'));
    const body = {
      bikeId: bike.id,
      startingPrice: 100000,
      minimumIncrement: 1000,
      startTime: new Date(Date.now() + 60_000).toISOString(),
      endTime: new Date(Date.now() + 3_600_000).toISOString(),
    };

    const buyer = await request(app)
      .post('/api/admin/auctions')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(body);
    expect(buyer.status).toBe(403);

    const admin = await request(app)
      .post('/api/admin/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
    expect(admin.status).toBe(201);
    createdAuctionIds.push(admin.body.data.auction.id);
  });
});

describe('bid placement', () => {
  it('rejects unauthenticated users', async () => {
    const response = await request(app)
      .post(`/api/auctions/${liveAuctionId}/bids`)
      .send({ amount: 101000 });

    expect(response.status).toBe(401);
  });

  it('rejects admin users', async () => {
    const response = await request(app)
      .post(`/api/auctions/${liveAuctionId}/bids`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 101000 });

    expect(response.status).toBe(403);
  });

  it('allows a buyer to place a valid bid', async () => {
    const response = await request(app)
      .post(`/api/auctions/${liveAuctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amount: 101000 });

    expect(response.status).toBe(201);
    expect(Number(response.body.data.bid.amount)).toBe(101000);
  });

  it('rejects a low bid', async () => {
    const response = await request(app)
      .post(`/api/auctions/${liveAuctionId}/bids`)
      .set('Authorization', `Bearer ${buyer2Token}`)
      .send({ amount: 101500 });

    expect(response.status).toBe(400);
  });

  it('rejects bids on ended auctions', async () => {
    const response = await request(app)
      .post(`/api/auctions/${endedAuctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amount: 101000 });

    expect(response.status).toBe(409);
  });
});
