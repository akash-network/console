import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AkashBlockService } from "@src/block/services/akash-block/akash-block.service";
import type { ChainIndexerDashboardStatsService } from "@src/chain-indexer/services/dashboard-stats/chain-indexer-dashboard-stats.service";
import type { ChainIndexerDelegationService } from "@src/chain-indexer/services/delegation/chain-indexer-delegation.service";
import { DashboardDataController } from "@src/dashboard/controllers/dashboard-data/dashboard-data.controller";
import type { DashboardDataResponse } from "@src/dashboard/http-schemas/dashboard-data/dashboard-data.schema";
import { emptyNetworkCapacity, type StatsService } from "@src/dashboard/services/stats/stats.service";
import { emptyProviderGraphData, type ProviderGraphDataService } from "@src/provider/services/provider-graph-data/provider-graph-data.service";
import type { TransactionService } from "@src/transaction/services/transaction/transaction.service";

describe(DashboardDataController.name, () => {
  it("serves the now and compare blocks from chain-indexer when the endpoint is delegated", async () => {
    const { controller, statsService, chainIndexerStats } = setup({ delegated: true });

    const result = await controller.getDashboardData();

    expect(result.now.height).toBe(2000);
    expect(result.compare.height).toBe(1900);
    expect(chainIndexerStats.getDashboardData).toHaveBeenCalledOnce();
    expect(statsService.getDashboardData).not.toHaveBeenCalled();
  });

  it("serves the now and compare blocks from the legacy indexer when the endpoint is not delegated", async () => {
    const { controller, statsService, chainIndexerStats } = setup({ delegated: false });

    const result = await controller.getDashboardData();

    expect(result.now.height).toBe(1000);
    expect(statsService.getDashboardData).toHaveBeenCalledOnce();
    expect(chainIndexerStats.getDashboardData).not.toHaveBeenCalled();
  });

  function stats(height: number): DashboardDataResponse["now"] {
    return {
      date: "2026-09-26T00:00:00.000Z",
      height,
      activeLeaseCount: 0,
      totalLeaseCount: 0,
      dailyLeaseCount: 0,
      totalUAktSpent: 0,
      dailyUAktSpent: 0,
      totalUActSpent: 0,
      dailyUActSpent: 0,
      totalUUsdcSpent: 0,
      dailyUUsdcSpent: 0,
      totalUUsdSpent: 0,
      dailyUUsdSpent: 0,
      activeCPU: 0,
      activeGPU: 0,
      activeMemory: 0,
      activeStorage: 0
    };
  }

  function setup(input: { delegated: boolean }) {
    const statsService = mock<StatsService>();
    statsService.getDashboardData.mockResolvedValue({ now: stats(1000), compare: stats(900) });
    statsService.getChainStats.mockResolvedValue({ bondedTokens: 0, totalSupply: 0, communityPool: 0, inflation: 0, stakingAPR: undefined });
    statsService.getLegacyNetworkCapacity.mockResolvedValue(emptyNetworkCapacity);
    const providerGraphDataService = mock<ProviderGraphDataService>();
    providerGraphDataService.getProviderGraphData.mockResolvedValue(emptyProviderGraphData);
    const akashBlockService = mock<AkashBlockService>();
    akashBlockService.getBlocks.mockResolvedValue([]);
    const transactionService = mock<TransactionService>();
    transactionService.getTransactions.mockResolvedValue([]);
    const chainIndexerStats = mock<ChainIndexerDashboardStatsService>();
    chainIndexerStats.getDashboardData.mockResolvedValue({ now: stats(2000), compare: stats(1900) });
    const delegation = mock<ChainIndexerDelegationService>();
    delegation.isEnabled.mockReturnValue(input.delegated);
    const controller = new DashboardDataController(
      statsService,
      providerGraphDataService,
      akashBlockService,
      transactionService,
      delegation,
      chainIndexerStats
    );
    return { controller, statsService, chainIndexerStats };
  }
});
