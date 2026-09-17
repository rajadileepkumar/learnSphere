import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().max(2000).optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    reviewText: z.string().max(2000).optional(),
  })
  .refine((data) => data.rating !== undefined || data.reviewText !== undefined, {
    message: 'Provide a rating or review text to update',
  });
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
