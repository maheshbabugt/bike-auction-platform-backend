import { BikeCondition, FuelType } from '../../generated/prisma';
import { z } from 'zod';

const currentYear = new Date().getFullYear();

const optionalUrl = z
  .string()
  .trim()
  .url('Image URL must be valid')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const bikeIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Bike id must be valid'),
  }),
});

export const listBikesSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    brand: z.string().trim().optional(),
    fuelType: z.nativeEnum(FuelType).optional(),
    condition: z.nativeEnum(BikeCondition).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
});

export const createBikeSchema = z.object({
  body: z.object({
    brand: z.string().trim().min(1, 'Brand is required'),
    model: z.string().trim().min(1, 'Model is required'),
    year: z.coerce
      .number()
      .int()
      .min(1990, 'Year must be 1990 or later')
      .max(currentYear + 1, `Year cannot be later than ${currentYear + 1}`),
    registrationNumber: z
      .string()
      .trim()
      .min(1, 'Registration number is required'),
    kmsDriven: z.coerce.number().int().min(0, 'KMs driven cannot be negative'),
    fuelType: z.nativeEnum(FuelType),
    condition: z.nativeEnum(BikeCondition),
    basePrice: z.coerce.number().positive('Base price must be greater than 0'),
    imageUrl: optionalUrl,
    description: z.string().trim().optional(),
  }),
});

export const updateBikeSchema = z.object({
  params: bikeIdSchema.shape.params,
  body: createBikeSchema.shape.body.partial().refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required',
  ),
});

export type ListBikesQuery = z.infer<typeof listBikesSchema>['query'];
export type CreateBikeInput = z.infer<typeof createBikeSchema>['body'];
export type UpdateBikeInput = z.infer<typeof updateBikeSchema>['body'];
