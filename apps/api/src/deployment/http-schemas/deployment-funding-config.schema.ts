import { z } from "zod";

export const DeploymentFundingConfigResponseSchema = z.object({
  data: z.object({
    targetRunwayHours: z.number().openapi({
      description: "Hours of runtime automatic funding reserves for a deployment once its lease starts"
    }),
    balanceHeadroomUsd: z.number().openapi({
      description: "USD amount automatic funding leaves untouched in the available balance so new deployments can still be created"
    }),
    defaultDepositUsd: z.number().openapi({
      description: "USD amount every deployment is bootstrapped with at creation, before funding tops it up toward the target runway"
    })
  })
});

export type DeploymentFundingConfigResponse = z.infer<typeof DeploymentFundingConfigResponseSchema>;
