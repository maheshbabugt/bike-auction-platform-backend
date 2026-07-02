import { AuctionStatus } from '../../generated/prisma';
import { z } from 'zod';

const dateInput = z.coerce.date();

export const auctionIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Auction id must be valid'),
  }),
});

export const listAuctionsSchema = z.object({
  query: z.object({
    status: z.nativeEnum(AuctionStatus).optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
});

export const createAuctionSchema = z
  .object({
    body: z.object({
      bikeId: z.string().uuid('Bike id must be valid'),
      startingPrice: z.coerce
        .number()
        .positive('Starting price must be greater than 0'),
      minimumIncrement: z.coerce
        .number()
        .positive('Minimum increment must be greater than 0'),
      startTime: dateInput,
      endTime: dateInput,
    }),
  })
  .refine((data) => data.body.startTime < data.body.endTime, {
    message: 'Start time must be before end time',
    path: ['body', 'endTime'],
  });

export type ListAuctionsQuery = z.infer<typeof listAuctionsSchema>['query'];
export type CreateAuctionInput = z.infer<typeof createAuctionSchema>['body'];
