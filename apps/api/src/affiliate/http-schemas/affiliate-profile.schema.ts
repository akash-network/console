import { z } from "@hono/zod-openapi";

const AffiliateTermsSchema = z.object({
  commissionPercent: z.number(),
  commissionMonths: z.number(),
  referralTrialCreditsUsd: z.number()
});

const AffiliateStatsSchema = z.object({
  signups: z.number(),
  payingUsers: z.number(),
  totalCommissionUsd: z.number(),
  monthCommissionUsd: z.number()
});

const AffiliateCommissionSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  amountUsd: z.number(),
  reversedUsd: z.number()
});

export const AffiliateProfileResponseSchema = z.object({
  data: z
    .object({
      code: z.string(),
      terms: AffiliateTermsSchema,
      stats: AffiliateStatsSchema,
      commissions: z.array(AffiliateCommissionSchema)
    })
    .nullable()
});

export type AffiliateProfileResponse = z.infer<typeof AffiliateProfileResponseSchema>;
