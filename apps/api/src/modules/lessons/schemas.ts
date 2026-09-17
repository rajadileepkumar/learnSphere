import { z } from 'zod';

export const lessonProgressSchema = z
  .object({
    progressPercent: z.number().min(0).max(100).optional(),
    lastPositionSeconds: z.number().int().min(0).optional(),
  })
  .refine((v) => v.progressPercent !== undefined || v.lastPositionSeconds !== undefined, {
    message: 'At least one of progressPercent or lastPositionSeconds is required',
  });

export type LessonProgressInput = z.infer<typeof lessonProgressSchema>;

export const lessonNoteSchema = z.object({
  content: z.string().max(20000),
});
export type LessonNoteInput = z.infer<typeof lessonNoteSchema>;
