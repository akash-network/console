import { Block } from "@akashnetwork/database/dbSchemas";
import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import subHours from "date-fns/subHours";
import assert from "http-assert";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { inject, singleton } from "tsyringe";

import { CHAIN_DB } from "@src/chain";
import { ProviderDashboardResponse } from "@src/provider/http-schemas/provider-dashboard.schema";
import { ProviderEarningsService } from "@src/provider/services/provider-earnings/provider-earnings.service";

@singleton()
export class ProviderDashboardService {
  readonly #chainDb: Sequelize;

  constructor(
    @inject(CHAIN_DB) chainDb: Sequelize,
    private readonly providerEarningsService: ProviderEarningsService
  ) {
    this.#chainDb = chainDb;
  }

  async getProviderDashboard(owner: string): Promise<ProviderDashboardResponse> {
    const provider = await Provider.findOne({
      where: { owner }
    });
    assert(provider, 404, "Provider not found");

    const latestBlock = await Block.findOne({
      where: {
        isProcessed: true,
        totalUUsdSpent: { [Op.not]: null }
      },
      order: [["height", "DESC"]]
    });
    assert(latestBlock, 404, "Latest block not found");

    const [earlierBlock24h, earlierBlock48h] = await Promise.all([
      Block.findOne({
        order: [["datetime", "ASC"]],
        where: {
          datetime: { [Op.gte]: subHours(latestBlock.datetime, 24) }
        }
      }),
      Block.findOne({
        order: [["datetime", "ASC"]],
        where: {
          datetime: { [Op.gte]: subHours(latestBlock.datetime, 48) }
        }
      })
    ]);
    assert(earlierBlock24h, 404, "Earlier block 24h not found");
    assert(earlierBlock48h, 404, "Earlier block 48h not found");

    const [
      activeStats,
      previousActiveStats,
      currentTotalLeaseCount,
      previousTotalLeaseCount,
      secondPreviousTotalLeaseCount,
      currentTotalEarnings,
      previousTotalEarnings,
      secondPreviousTotalEarnings
    ] = await Promise.all([
      this.getActiveResourcesAtHeight(provider.owner, latestBlock.height),
      this.getActiveResourcesAtHeight(provider.owner, earlierBlock24h.height),
      this.getTotalLeaseCountAtHeight(provider.owner, latestBlock.height),
      this.getTotalLeaseCountAtHeight(provider.owner, earlierBlock24h.height),
      this.getTotalLeaseCountAtHeight(provider.owner, earlierBlock48h.height),
      this.providerEarningsService.getEarningsAtHeight(provider.owner, provider.createdHeight, latestBlock.height),
      this.providerEarningsService.getEarningsAtHeight(provider.owner, provider.createdHeight, earlierBlock24h.height),
      this.providerEarningsService.getEarningsAtHeight(provider.owner, provider.createdHeight, earlierBlock48h.height)
    ]);

    return {
      current: {
        date: latestBlock.datetime.toISOString(),
        height: latestBlock.height,
        activeLeaseCount: activeStats.count,
        totalLeaseCount: currentTotalLeaseCount,
        dailyLeaseCount: currentTotalLeaseCount - previousTotalLeaseCount,
        totalUAktEarned: currentTotalEarnings.uakt,
        dailyUAktEarned: currentTotalEarnings.uakt - previousTotalEarnings.uakt,
        totalUUsdcEarned: currentTotalEarnings.uusdc,
        dailyUUsdcEarned: currentTotalEarnings.uusdc - previousTotalEarnings.uusdc,
        totalUUsdEarned: currentTotalEarnings.uusd,
        dailyUUsdEarned: currentTotalEarnings.uusd - previousTotalEarnings.uusd,
        activeCPU: activeStats.cpu,
        activeGPU: activeStats.gpu,
        activeMemory: activeStats.memory,
        activeEphemeralStorage: activeStats.ephemeralStorage,
        activePersistentStorage: activeStats.persistentStorage,
        activeStorage: activeStats.ephemeralStorage + activeStats.persistentStorage
      },
      previous: {
        date: earlierBlock24h.datetime.toISOString(),
        height: earlierBlock24h.height,
        activeLeaseCount: previousActiveStats.count,
        totalLeaseCount: previousTotalLeaseCount,
        dailyLeaseCount: previousTotalLeaseCount - secondPreviousTotalLeaseCount,
        totalUAktEarned: previousTotalEarnings.uakt,
        dailyUAktEarned: previousTotalEarnings.uakt - secondPreviousTotalEarnings.uakt,
        totalUUsdcEarned: previousTotalEarnings.uusdc,
        dailyUUsdcEarned: previousTotalEarnings.uusdc - secondPreviousTotalEarnings.uusdc,
        totalUUsdEarned: previousTotalEarnings.uusd,
        dailyUUsdEarned: previousTotalEarnings.uusd - secondPreviousTotalEarnings.uusd,
        activeCPU: previousActiveStats.cpu,
        activeGPU: previousActiveStats.gpu,
        activeMemory: previousActiveStats.memory,
        activeEphemeralStorage: previousActiveStats.ephemeralStorage,
        activePersistentStorage: previousActiveStats.persistentStorage,
        activeStorage: previousActiveStats.ephemeralStorage + previousActiveStats.persistentStorage
      }
    };
  }

  private async getTotalLeaseCountAtHeight(provider: string, height: number) {
    const [{ count: totalLeaseCount }] = await this.#chainDb.query<{
      count: number;
    }>(`/* provider-stats:total-lease-count-at-height */ SELECT COUNT(*) FROM lease l WHERE "providerAddress"=:provider AND l."createdHeight" <= :height`, {
      type: QueryTypes.SELECT,
      replacements: { provider, height }
    });

    return totalLeaseCount;
  }

  private async getActiveResourcesAtHeight(provider: string, height: number) {
    const [activeStats] = await this.#chainDb.query<{
      count: number;
      cpu: number;
      memory: number;
      ephemeralStorage: number;
      persistentStorage: number;
      gpu: number;
    }>(
      `/* provider-stats:active-resources-at-height */
    SELECT
        COUNT(*) AS "count",
        SUM("cpuUnits") AS "cpu",
        SUM("memoryQuantity") AS "memory",
        SUM("ephemeralStorageQuantity") AS "ephemeralStorage",
        SUM("persistentStorageQuantity") AS "persistentStorage",
        SUM("gpuUnits") AS "gpu"
    FROM lease
    WHERE
        "providerAddress"=:provider
        AND "createdHeight" <= :height
        AND COALESCE("closedHeight", "predictedClosedHeight") > :height`,
      {
        type: QueryTypes.SELECT,
        replacements: { provider, height }
      }
    );

    return activeStats;
  }
}
