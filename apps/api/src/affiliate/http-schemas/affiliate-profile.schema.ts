import { z } from "@hono/zod-openapi";

const AffiliateTermsSchema = z.object({
  commissionPercent: z.number(),
  commissionMonths: z.number(),
  referralTrialCreditsUsd: z.number()
});

export const AffiliateProfileResponseSchema = z.object({
  data: z
    .object({
      code: z.string(),
      terms: AffiliateTermsSchema
    })
    .nullable()
});

export type AffiliateProfileResponse = z.infer<typeof AffiliateProfileResponseSchema>;
