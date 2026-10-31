import { z } from "zod";

export const SendVerificationCodeResponseSchema = z.object({
  data: z.object({
    codeSentAt: z.string()
  })
});

export type SendVerificationCodeResponse = z.infer<typeof SendVerificationCodeResponseSchema>;
