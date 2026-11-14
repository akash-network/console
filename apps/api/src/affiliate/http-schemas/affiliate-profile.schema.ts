import { z } from "@hono/zod-openapi";

const AffiliateTermsSchema = z.object({
  commissionPercent: z.number(),
  commissionMonths: z.number(),
  referralTrialCreditsUsd: z.number(),
  commissionHoldDays: z.number().openapi({ description: "How many days each commission stays on hold before it is credited." })
});

const AffiliateStatsSchema = z.object({
  signups: z.number(),
  payingUsers: z.number(),
  totalCommissionUsd: z.number(),
  monthCommissionUsd: z.number(),
  creditedUsd: z.number().openapi({ description: "Commission credited to the personal balance, net of what was taken back." }),
  onHoldUsd: z.number().openapi({ description: "Commission still on hold, net of refunds during the hold." }),
  nextRelease: z
    .object({ releasesAt: z.string(), amountUsd: z.number() })
    .nullable()
    .openapi({ description: "The next held commission due for release, null when none has a release date ahead." })
});

const AffiliateCommissionSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  amountUsd: z.number(),
  reversedUsd: z.number(),
  status: z.enum(["on_hold", "credited", "canceled", "reversed"]),
  releasesAt: z
    .string()
    .nullable()
    .openapi({ description: "When a held commission is due for release, null once that date has passed or when it is not on hold." }),
  creditedAt: z.string().nullable().openapi({ description: "When the commission was credited to the personal balance." }),
  paymentUsd: z.number().nullable().openapi({ description: "The card payment the commission was earned on." })
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
