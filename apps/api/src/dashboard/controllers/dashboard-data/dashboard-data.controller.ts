import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { AkashBlockService } from "@src/block/services/akash-block/akash-block.service";
import { DashboardDataResponse } from "@src/dashboard/http-schemas/dashboard-data/dashboard-data.schema";
import { emptyNetworkCapacity, StatsService } from "@src/dashboard/services/stats/stats.service";
import { emptyProviderGraphData, ProviderGraphDataService } from "@src/provider/services/provider-graph-data/provider-graph-data.service";
import { TransactionService } from "@src/transaction/services/transaction/transaction.service";
import { createLoggingExecutor } from "@src/utils/logging";

const logger = LoggerService.forContext("DashboardData");
const runOrLog = createLoggingExecutor(logger);

const emptyStats = {
  date: new Date().toISOString(),
  height: 0,
  activeLeaseCount: 0,
  totalLeaseCount: 0,
  dailyLeaseCount: 0,
  totalUAktSpent: 0,
  dailyUAktSpent: 0,
  totalUUsdcSpent: 0,
  dailyUUsdcSpent: 0,
  totalUUsdSpent: 0,
  dailyUUsdSpent: 0,
  activeCPU: 0,
  activeGPU: 0,
  activeMemory: 0,
  activeStorage: 0
};

const emptyDashboardData = {
  now: emptyStats,
  compare: emptyStats
};

@singleton()
export class DashboardDataController {
  constructor(
    private readonly statsService: StatsService,
    private readonly providerGraphDataService: ProviderGraphDataService,
    private readonly akashBlockService: AkashBlockService,
    private readonly transactionService: TransactionService
  ) {}

  async getDashboardData(): Promise<DashboardDataResponse> {
    const [{ now, compare }, chainStatsQuery, networkCapacity, networkCapacityStats, latestBlocks, latestTransactions] = await Promise.all([
      runOrLog(this.statsService.getDashboardData, { ...emptyDashboardData }),
      runOrLog(this.statsService.getChainStats, {
        bondedTokens: 0,
        totalSupply: 0,
        communityPool: 0,
        inflation: 0,
        stakingAPR: undefined
      }),
      runOrLog(this.statsService.getNetworkCapacity, { ...emptyNetworkCapacity }),
      runOrLog(() => this.providerGraphDataService.getProviderGraphData("count"), emptyProviderGraphData),
      runOrLog(() => this.akashBlockService.getBlocks(5), []),
      runOrLog(() => this.transactionService.getTransactions(5), [])
    ]);

    const chainStats = {
      ...chainStatsQuery,
      height: latestBlocks && latestBlocks.length > 0 ? latestBlocks[0].height : 0,
      transactionCount: latestBlocks && latestBlocks.length > 0 ? latestBlocks[0].totalTransactionCount : 0
    };

    return {
      chainStats,
      now,
      compare,
      networkCapacity,
      networkCapacityStats,
      latestBlocks,
      latestTransactions
    };
  }
}
