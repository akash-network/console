import { z } from "zod";

export const VerifyEmailResponseSchema = z.object({
  data: z.object({
    emailVerified: z.boolean()
  })
});

export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>;

export const SendVerificationCodeResponseSchema = z.object({
  data: z.object({
    codeSentAt: z.string()
  })
});

export type SendVerificationCodeResponse = z.infer<typeof SendVerificationCodeResponseSchema>;

export const VerifyEmailCodeResponseSchema = z.object({
  data: z.object({
    emailVerified: z.boolean()
  })
});

export type VerifyEmailCodeResponse = z.infer<typeof VerifyEmailCodeResponseSchema>;
