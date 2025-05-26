import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { AkashBlockService } from "@src/block/services/akash-block/akash-block.service";
import { DashboardDataResponse } from "@src/dashboard/http-schemas/dashboard-data/dashboard-data.schema";
import { StatsService } from "@src/dashboard/services/stats/stats.service";
import { ProviderGraphDataResponse } from "@src/provider/http-schemas/provider-graph-data.schema";
import { ProviderGraphDataService } from "@src/provider/services/provider-graph-data/provider-graph-data.service";
import { TransactionService } from "@src/transaction/services/transaction/transaction.service";
import { createLoggingExecutor } from "@src/utils/logging";

const logger = LoggerService.forContext("DashboardData");
const runOrLog = createLoggingExecutor(logger);

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
      runOrLog(this.statsService.getDashboardData, {} as Awaited<ReturnType<typeof this.statsService.getDashboardData>>),
      runOrLog(this.statsService.getChainStats, {
        bondedTokens: undefined,
        totalSupply: undefined,
        communityPool: undefined,
        inflation: undefined,
        stakingAPR: undefined
      }),
      runOrLog(this.statsService.getNetworkCapacity, {} as Awaited<ReturnType<typeof this.statsService.getNetworkCapacity>>),
      runOrLog(() => this.providerGraphDataService.getProviderGraphData("count"), {} as Awaited<ProviderGraphDataResponse>),
      runOrLog(() => this.akashBlockService.getBlocks(5), []),
      runOrLog(() => this.transactionService.getTransactions(5), [])
    ]);

    const chainStats = {
      ...chainStatsQuery,
      height: latestBlocks && latestBlocks.length > 0 ? latestBlocks[0].height : undefined,
      transactionCount: latestBlocks && latestBlocks.length > 0 ? latestBlocks[0].totalTransactionCount : undefined
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
