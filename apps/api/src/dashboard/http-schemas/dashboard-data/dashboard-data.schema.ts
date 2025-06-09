import { z } from "zod";

import { NetworkCapacityResponseSchema } from "../network-capacity/network-capacity.schema";

export const DashboardDataResponseSchema = z.object({
  chainStats: z.object({
    height: z.number(),
    transactionCount: z.number(),
    bondedTokens: z.number(),
    totalSupply: z.number(),
    communityPool: z.number(),
    inflation: z.number(),
    stakingAPR: z.number().optional()
  }),
  now: z.object({
    date: z.string(),
    height: z.number(),
    activeLeaseCount: z.number(),
    totalLeaseCount: z.number(),
    dailyLeaseCount: z.number(),
    totalUAktSpent: z.number(),
    dailyUAktSpent: z.number(),
    totalUUsdcSpent: z.number(),
    dailyUUsdcSpent: z.number(),
    totalUUsdSpent: z.number(),
    dailyUUsdSpent: z.number(),
    activeCPU: z.number(),
    activeGPU: z.number(),
    activeMemory: z.number(),
    activeStorage: z.number()
  }),
  compare: z.object({
    date: z.string(),
    height: z.number(),
    activeLeaseCount: z.number(),
    totalLeaseCount: z.number(),
    dailyLeaseCount: z.number(),
    totalUAktSpent: z.number(),
    dailyUAktSpent: z.number(),
    totalUUsdcSpent: z.number(),
    dailyUUsdcSpent: z.number(),
    totalUUsdSpent: z.number(),
    dailyUUsdSpent: z.number(),
    activeCPU: z.number(),
    activeGPU: z.number(),
    activeMemory: z.number(),
    activeStorage: z.number()
  }),
  networkCapacity: NetworkCapacityResponseSchema,
  networkCapacityStats: z.object({
    currentValue: z.number(),
    compareValue: z.number(),
    snapshots: z.array(
      z.object({
        date: z.string(),
        value: z.number()
      })
    ),
    now: z.object({
      count: z.number(),
      cpu: z.number(),
      gpu: z.number(),
      memory: z.number(),
      storage: z.number()
    }),
    compare: z.object({
      count: z.number(),
      cpu: z.number(),
      gpu: z.number(),
      memory: z.number(),
      storage: z.number()
    })
  }),
  latestBlocks: z.array(
    z.object({
      height: z.number(),
      proposer: z.object({
        address: z.string(),
        operatorAddress: z.string(),
        moniker: z.string().nullable(),
        avatarUrl: z.string().nullable()
      }),
      transactionCount: z.number(),
      totalTransactionCount: z.number(),
      datetime: z.string()
    })
  ),
  latestTransactions: z.array(
    z.object({
      height: z.number(),
      datetime: z.string(),
      hash: z.string(),
      isSuccess: z.boolean(),
      error: z.string().nullable(),
      gasUsed: z.number(),
      gasWanted: z.number(),
      fee: z.number(),
      memo: z.string(),
      messages: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          amount: z.number()
        })
      )
    })
  )
});

export type DashboardDataResponse = z.infer<typeof DashboardDataResponseSchema>;
