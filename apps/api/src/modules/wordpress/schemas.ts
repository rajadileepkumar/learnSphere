import { z } from 'zod';

export const webhookPayloadSchema = z.object({
  id: z.string().min(1),
  event: z.enum(['course.published', 'course.updated', 'course.unpublished', 'lesson.updated', 'instructor.updated']),
  wpId: z.number().int(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
