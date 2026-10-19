import { z } from "@hono/zod-openapi";

export const ReferralResponseSchema = z.object({
  data: z
    .object({
      trialCreditsUsd: z.number()
    })
    .nullable()
});

export type ReferralResponse = z.infer<typeof ReferralResponseSchema>;
