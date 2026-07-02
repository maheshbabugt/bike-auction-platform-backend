import { z } from 'zod';

export const placeBidSchema = z.object({
  params: z.object({
    auctionId: z.string().uuid('Auction id must be valid'),
  }),
  body: z.object({
    amount: z.coerce
      .number()
      .int('Bid amount must be an integer')
      .positive('Bid amount must be greater than 0'),
  }),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>['body'];
