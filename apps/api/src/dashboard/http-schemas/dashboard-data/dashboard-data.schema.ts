import { z } from "zod";

const LegacyNetworkCapacityResponseSchema = z.object({
  activeProviderCount: z.number(),
  activeCPU: z.number(),
  activeGPU: z.number(),
  activeMemory: z.number(),
  activeStorage: z.number(),
  pendingCPU: z.number(),
  pendingGPU: z.number(),
  pendingMemory: z.number(),
  pendingStorage: z.number(),
  availableCPU: z.number(),
  availableGPU: z.number(),
  availableMemory: z.number(),
  availableStorage: z.number(),
  totalCPU: z.number(),
  totalGPU: z.number(),
  totalMemory: z.number(),
  totalStorage: z.number(),
  activeEphemeralStorage: z.number(),
  pendingEphemeralStorage: z.number(),
  availableEphemeralStorage: z.number(),
  activePersistentStorage: z.number(),
  pendingPersistentStorage: z.number(),
  availablePersistentStorage: z.number(),
  totalEphemeralStorage: z.number(),
  totalPersistentStorage: z.number()
});

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
  networkCapacity: LegacyNetworkCapacityResponseSchema,
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
