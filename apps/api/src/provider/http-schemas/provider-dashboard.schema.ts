import { z } from "zod";

import { openApiExampleProviderAddress } from "@src/utils/constants";

export const ProviderDashboardParamsSchema = z.object({
  owner: z.string().openapi({ example: openApiExampleProviderAddress })
});

export const ProviderDashboardResponseSchema = z.object({
  current: z.object({
    date: z.string(),
    height: z.number(),
    activeLeaseCount: z.number(),
    totalLeaseCount: z.number(),
    dailyLeaseCount: z.number(),
    totalUAktEarned: z.number(),
    dailyUAktEarned: z.number(),
    totalUUsdcEarned: z.number(),
    dailyUUsdcEarned: z.number(),
    totalUUsdEarned: z.number(),
    dailyUUsdEarned: z.number(),
    activeCPU: z.number(),
    activeGPU: z.number(),
    activeMemory: z.number(),
    activeEphemeralStorage: z.number(),
    activePersistentStorage: z.number(),
    activeStorage: z.number()
  }),
  previous: z.object({
    date: z.string(),
    height: z.number(),
    activeLeaseCount: z.number(),
    totalLeaseCount: z.number(),
    dailyLeaseCount: z.number(),
    totalUAktEarned: z.number(),
    dailyUAktEarned: z.number(),
    totalUUsdcEarned: z.number(),
    dailyUUsdcEarned: z.number(),
    totalUUsdEarned: z.number(),
    dailyUUsdEarned: z.number(),
    activeCPU: z.number(),
    activeGPU: z.number(),
    activeMemory: z.number(),
    activeEphemeralStorage: z.number(),
    activePersistentStorage: z.number(),
    activeStorage: z.number()
  })
});

export type ProviderDashboardResponse = z.infer<typeof ProviderDashboardResponseSchema>;
