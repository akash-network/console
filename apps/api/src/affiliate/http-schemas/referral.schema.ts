import { z } from "@hono/zod-openapi";

export const ReferralResponseSchema = z.object({
  data: z
    .object({
      trialCreditsUsd: z.number()
    })
    .nullable()
});

export type ReferralResponse = z.infer<typeof ReferralResponseSchema>;

export const GetReferralCodeParamsSchema = z.object({
  code: z.string().openapi({ description: "Referral code from an affiliate's link", example: "friendcode" })
});

export const GetReferralCodeResponseSchema = z.object({
  data: z.object({
    valid: z.boolean(),
    trialCreditsUsd: z.number().optional()
  })
});

export type GetReferralCodeResponse = z.infer<typeof GetReferralCodeResponseSchema>;
