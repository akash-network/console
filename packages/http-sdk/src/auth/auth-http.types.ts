import { z } from "zod";

export const VerifyEmailResponseSchema = z.object({
  data: z.object({
    emailVerified: z.boolean()
  })
});

export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>;
