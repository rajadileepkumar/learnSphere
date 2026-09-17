import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const listEnrollmentsQuerySchema = paginationQuerySchema.extend({
  courseId: z.string().uuid().optional(),
});
export type ListEnrollmentsQuery = z.infer<typeof listEnrollmentsQuerySchema>;

export const listReviewsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

export const moderateReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
