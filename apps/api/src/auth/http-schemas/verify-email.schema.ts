import { z } from "zod";

export const VerifyEmailRequestSchema = z.object({
  data: z.object({
    email: z.string().trim().toLowerCase().email({ message: "Email is invalid." })
  })
});

export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const VerifyEmailResponseSchema = z.object({
  data: z.object({
    emailVerified: z.boolean()
  })
});

export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>;
