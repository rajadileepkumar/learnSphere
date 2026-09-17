import { z } from 'zod';

export const createConversationSchema = z.object({
  courseId: z.string().uuid().optional(),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const postMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});
export type PostMessageInput = z.infer<typeof postMessageSchema>;

export const feedbackSchema = z.object({
  rating: z.enum(['up', 'down']),
  comment: z.string().max(1000).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;
