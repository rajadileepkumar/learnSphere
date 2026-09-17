import { z } from 'zod';

export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        optionIds: z.array(z.string().uuid()).min(1),
      }),
    )
    .min(1),
});

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
