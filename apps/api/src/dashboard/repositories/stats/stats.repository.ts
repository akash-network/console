import { AkashBlock as Block, Lease, Provider, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { Day } from "@akashnetwork/database/dbSchemas/base";
import { sub } from "date-fns";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { inject, injectable } from "tsyringe";

import { CHAIN_DB } from "@src/chain";
import type { DashboardConfig } from "@src/dashboard/providers/config.provider";
import { DASHBOARD_CONFIG } from "@src/dashboard/providers/config.provider";
import { toUTC } from "@src/utils";

export type GpuUtilizationRow = {
  date: Date;
  cpuUtilization: number;
  cpu: number;
  gpuUtilization: number;
  gpu: number;
  count: number;
  node_count: number;
};

export type CollateralRatioRow = {
  date: Date;
  collateralRatio: number;
};

export type BmeStatusHistoryRow = {
  height: number;
  date: Date;
  previousStatus: string;
  newStatus: string;
  collateralRatio: number;
};

@injectable()
export class StatsRepository {
  readonly #chainDb: Sequelize;
  readonly #dashboardConfig: DashboardConfig;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize, @inject(DASHBOARD_CONFIG) dashboardConfig: DashboardConfig) {
    this.#chainDb = chainDb;
    this.#dashboardConfig = dashboardConfig;
  }

  async findLatestProcessedBlock() {
    return Block.findOne({
      where: {
        isProcessed: true,
        totalUUsdSpent: { [Op.not]: null }
      },
      order: [["height", "DESC"]]
    });
  }

  async findFirstBlockSince(since: Date) {
    return Block.findOne({
      order: [["datetime", "ASC"]],
      where: {
        datetime: { [Op.gte]: since }
      }
    });
  }

  async findDailyBlockSnapshots(attributes: (keyof Block)[]) {
    return Day.findAll({
      attributes: ["date"],
      include: [
        {
          model: Block,
          as: "lastBlock",
          attributes: attributes,
          required: true
        }
      ],
      order: [["date", "ASC"]]
    });
  }

  async findGpuUtilization(): Promise<GpuUtilizationRow[]> {
    return this.#chainDb.query<GpuUtilizationRow>(
      `/* dashboard-stats:gpu-utilization */ SELECT
          d."date",
          ROUND(
            COALESCE((SUM("activeCPU") + SUM("pendingCPU")) * 100.0 /
            NULLIF(SUM("activeCPU") + SUM("pendingCPU") + SUM("availableCPU"), 0), 0),
            2
          )::float AS "cpuUtilization",
          COALESCE(SUM("activeCPU") + SUM("pendingCPU") + SUM("availableCPU"), 0)::integer AS "cpu",
          ROUND(
            COALESCE((SUM("activeGPU") + SUM("pendingGPU")) * 100.0 /
            NULLIF(SUM("activeGPU") + SUM("pendingGPU") + SUM("availableGPU"), 0), 0),
            2
          )::float AS "gpuUtilization",
          COALESCE(SUM("activeGPU") + SUM("pendingGPU") + SUM("availableGPU"), 0)::integer AS "gpu",
          COUNT(*) as provider_count,
          COALESCE(COUNT(DISTINCT "nodeId"), 0) as node_count
        FROM "day" d
        INNER JOIN (
          SELECT DISTINCT ON("hostUri",DATE("checkDate"))
            DATE("checkDate") AS date,
            ps."activeCPU", ps."pendingCPU", ps."availableCPU",
            ps."activeGPU", ps."pendingGPU", ps."availableGPU",
            ps."isOnline",
            n.id as "nodeId"
          FROM "providerSnapshot" ps
          INNER JOIN "provider" ON "provider"."owner"=ps."owner"
          INNER JOIN "providerSnapshotNode" n ON n."snapshotId"=ps.id AND n."gpuAllocatable" > 0
          LEFT JOIN "providerSnapshotNodeGPU" gpu ON gpu."snapshotNodeId" = n.id
          WHERE ps."isLastSuccessOfDay" = TRUE
          ORDER BY "hostUri",DATE("checkDate"),"checkDate" DESC
        ) "dailyProviderStats"
        ON DATE(d."date")="dailyProviderStats"."date"
        GROUP BY d."date"
        ORDER BY d."date" ASC`,
      {
        type: QueryTypes.SELECT
      }
    );
  }

  async findCollateralRatio(): Promise<CollateralRatioRow[]> {
    return this.#chainDb.query<CollateralRatioRow>(
      `/* dashboard-stats:collateral-ratio */ SELECT
          d."date",
          CASE
            WHEN b."outstandingUact" IS NULL OR b."outstandingUact" = 0 THEN 0
            ELSE ROUND((COALESCE(b."vaultUakt", 0) * COALESCE(d."aktPrice", 0) / b."outstandingUact")::numeric, 6)::float
          END AS "collateralRatio"
        FROM "day" d
        INNER JOIN "block" b ON b."height" = d."lastBlockHeight"
        WHERE b."vaultUakt" IS NOT NULL
        ORDER BY d."date" ASC`,
      {
        type: QueryTypes.SELECT
      }
    );
  }

  async findActiveProvidersWithSnapshots() {
    return Provider.findAll({
      where: {
        deletedHeight: null
      },
      include: [
        {
          required: true,
          model: ProviderSnapshot,
          as: "lastSuccessfulSnapshot",
          where: { checkDate: { [Op.gte]: toUTC(sub(new Date(), { minutes: this.#dashboardConfig.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES })) } }
        }
      ]
    });
  }

  async findBmeStatusHistory(): Promise<BmeStatusHistoryRow[]> {
    return this.#chainDb.query<BmeStatusHistoryRow>(
      `/* dashboard-stats:bme-status-history */ SELECT
          bsc."height",
          b."datetime" AS "date",
          bsc."previous_status" AS "previousStatus",
          bsc."new_status" AS "newStatus",
          bsc."collateral_ratio"::float AS "collateralRatio"
        FROM "bme_status_change" bsc
        INNER JOIN "block" b ON b."height" = bsc."height"
        ORDER BY bsc."height" ASC`,
      {
        type: QueryTypes.SELECT
      }
    );
  }

  async findClosedLeases(owner: string, query: { dseq?: string; startDate: Date; endDate: Date }) {
    const { dseq, startDate, endDate } = query;
    return Lease.findAll({
      where: {
        owner: owner,
        closedHeight: { [Op.not]: null },
        "$createdBlock.datetime$": { [Op.gte]: startDate },
        "$closedBlock.datetime$": { [Op.lte]: endDate },
        ...(dseq ? { dseq: dseq } : {})
      },
      include: [
        { model: Block, as: "createdBlock" },
        { model: Block, as: "closedBlock" }
      ]
    });
  }
}
