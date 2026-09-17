import { z } from 'zod';

export const listCoursesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['newest', 'popular']).default('newest'),
});

export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
