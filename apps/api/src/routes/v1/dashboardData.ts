import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { LoggerService } from "@src/core/services/logger/logger.service";
import { getBlocks } from "@src/services/db/blocksService";
import { getNetworkCapacity } from "@src/services/db/providerStatusService";
import { getDashboardData, getProviderGraphData } from "@src/services/db/statsService";
import { getTransactions } from "@src/services/db/transactionsService";
import { getChainStats } from "@src/services/external/apiNodeService";
import { createLoggingExecutor } from "@src/utils/logging";


const logger = new LoggerService({ context: "Dashboard" });
const runOrLog = createLoggingExecutor(logger)

const route = createRoute({
  method: "get",
  path: "/dashboard-data",
  tags: ["Analytics"],
  responses: {
    200: {
      description: "Returns dashboard data",
      content: {
        "application/json": {
          schema: z.object({
            chainStats: z.object({
              height: z.number(),
              transactionCount: z.number(),
              bondedTokens: z.number(),
              totalSupply: z.number(),
              communityPool: z.number(),
              inflation: z.number(),
              stakingAPR: z.number()
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
            netwqorkCapacity: z.object({
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
              totalStorage: z.number()
            }),
            networkCapacityStats: z.object({
              currentValue: z.any(), // TODO string | number ?
              compareValue: z.any(), // TODO string | number ?
              snapshots: z.array(
                z.object({
                  date: z.string(),
                  value: z.any() // TODO string | number ?
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
          })
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const [{ now, compare }, chainStatsQuery, networkCapacity, networkCapacityStats, latestBlocks, latestTransactions] = await Promise.all([
    runOrLog(getDashboardData),
    runOrLog(getChainStats, {
      bondedTokens: undefined,
      totalSupply: undefined,
      communityPool: undefined,
      inflation: undefined,
      stakingAPR: undefined
    }),
    runOrLog(getNetworkCapacity),
    runOrLog(() => getProviderGraphData("count")),
    runOrLog(() => getBlocks(5)),
    runOrLog(() => getTransactions(5))
  ]);
  const chainStats = {
    ...chainStatsQuery,
    height: latestBlocks && latestBlocks.length > 0 ? latestBlocks[0].height : undefined,
    transactionCount: latestBlocks && latestBlocks.length > 0 ? latestBlocks[0].totalTransactionCount : undefined,
  }

  return c.json({
    chainStats,
    now,
    compare,
    networkCapacity,
    networkCapacityStats,
    latestBlocks,
    latestTransactions
  });
});