import { z } from "@hono/zod-openapi";

const MAX_REFERRAL_PAGE_LIMIT = 100;
const DEFAULT_REFERRAL_PAGE_LIMIT = 20;

export const ListAffiliateReferralsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_REFERRAL_PAGE_LIMIT)
    .default(DEFAULT_REFERRAL_PAGE_LIMIT)
    .openapi({ description: `Referrals per page, at most ${MAX_REFERRAL_PAGE_LIMIT}.` }),
  offset: z.coerce.number().int().min(0).default(0).openapi({ description: "How many of the newest referrals to skip." })
});

const AffiliateReferralSchema = z.object({
  code: z.string().openapi({ description: "A short code that tells the affiliate's referrals apart without identifying anyone." }),
  joinedAt: z.string(),
  status: z.enum(["on_trial", "paying", "inactive"]).openapi({
    description: "`paying` once a card payment settled, `on_trial` while the free trial runs, `inactive` otherwise."
  }),
  commissionEndsAt: z.string().openapi({ description: "When payments by this referral stop earning commission." }),
  commissionMonthsLeft: z.number().int().openapi({ description: "Months left before commissionEndsAt, a partial month counted as one, 0 once it has passed." }),
  paidUsd: z.number().openapi({ description: "What the referral paid by card, net of refunds, teams they created included." }),
  earnedUsd: z.number().openapi({ description: "Commission earned on those payments, held or credited, net of what was taken back." })
});

export const ListAffiliateReferralsResponseSchema = z.object({
  data: z.object({
    referrals: z.array(AffiliateReferralSchema).openapi({ description: "Newest first." }),
    pagination: z.object({
      total: z.number().int(),
      limit: z.number().int(),
      offset: z.number().int()
    })
  })
});

export type ListAffiliateReferralsQuery = z.infer<typeof ListAffiliateReferralsQuerySchema>;
export type ListAffiliateReferralsResponse = z.infer<typeof ListAffiliateReferralsResponseSchema>;
