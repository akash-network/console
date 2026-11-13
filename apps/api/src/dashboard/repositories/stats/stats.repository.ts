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
  provider_count: number;
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

export type BmeDashboardRow = {
  datetime: Date;
  outstandingUact: number;
  vaultUakt: number;
  collateralRatio: number;
  totalUaktBurnedForUact: number;
  totalUactMinted: number;
  totalUactBurnedForUakt: number;
  totalUaktReminted: number;
};

export type SinkTotalsRow = {
  date: Date;
  pendingUakt: number;
  pendingTransfers: number;
  mintedUakt: number;
  mintedTransfers: number;
  voidedUakt: number;
  voidedTransfers: number;
  refundPendingUakt: number;
  refundPendingTransfers: number;
  refundedUakt: number;
  refundedTransfers: number;
  uniqueSenders: number;
};

export type SinkDashboardTotalsRow = SinkTotalsRow & { medianSecondsToMint: number | null };

export type SinkTransferSort = "latest" | "largest";

export type SinkTransferRow = {
  owner: string;
  height: number;
  sequence: number;
  recipient: string;
  amountUakt: number;
  status: string;
  createdAt: Date;
  statusHeight: number;
  statusUpdatedAt: Date;
};

export type SinkUnbondingSeries = "unbondStarted" | "unbondCompleting" | "cancelled" | "sentToSolana" | "sentBySendersWhoUnbonded";

export type SinkUnbondingDailyAmountRow = {
  series: SinkUnbondingSeries;
  date: string;
  amountUakt: number;
};

export type SinkUnbondingSummaryRow = {
  unbondingUakt: number;
  unbondingDelegators: number;
  senders: number;
  sendersWhoUnbonded: number;
  sentUakt: number;
  sentBySendersWhoUnbondedUakt: number;
};

type SinkDashboardPeriod = "now" | "compare" | "second_compare";

/** The chain merges unbondings of the same delegation started in the same block into one entry, and a cancellation names that entry by its creation height. */
const SINK_UNBONDING_CTES = `WITH unbond_entries AS (
          SELECT u."delegator", u."validator", u."height", u."completion_time", SUM(u."amount") AS "amount"
          FROM "staking_unbonding" u
          WHERE u."type" = 'unbond'
          GROUP BY u."delegator", u."validator", u."height", u."completion_time"
        ), cancellations AS (
          SELECT c."delegator", c."validator", c."creation_height", c."height", c."amount"
          FROM "staking_unbonding" c
          WHERE c."type" = 'cancel'
        ), net_entries AS (
          SELECT
            e.*,
            e."amount" - COALESCE((
              SELECT SUM(c."amount")
              FROM cancellations c
              WHERE c."delegator" = e."delegator" AND c."validator" = e."validator" AND c."creation_height" = e."height"
            ), 0) AS "netAmount"
          FROM unbond_entries e
        ), unbonders AS (
          SELECT DISTINCT e."delegator" FROM unbond_entries e
        ), counted_transfers AS (
          SELECT t."owner", t."amount", t."height", t."owner" IN (SELECT d."delegator" FROM unbonders d) AS "byUnbonder"
          FROM "sink_transfer" t
          WHERE t."status" NOT IN ('voided', 'refund_pending', 'refunded')
        )`;

const UTC_DAY = (column: string) => `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

const SINK_TRANSFER_ORDER: Record<SinkTransferSort, string> = {
  latest: `t."height" DESC, t."sequence" DESC`,
  largest: `t."amount" DESC, t."height" DESC, t."sequence" DESC`
};

const SINK_TOTALS_COLUMNS = `
          COALESCE(s."pending_amount", 0)::float AS "pendingUakt",
          COALESCE(s."pending_count", 0) AS "pendingTransfers",
          COALESCE(s."minted_amount", 0)::float AS "mintedUakt",
          COALESCE(s."minted_count", 0) AS "mintedTransfers",
          COALESCE(s."voided_amount", 0)::float AS "voidedUakt",
          COALESCE(s."voided_count", 0) AS "voidedTransfers",
          COALESCE(s."refund_pending_amount", 0)::float AS "refundPendingUakt",
          COALESCE(s."refund_pending_count", 0) AS "refundPendingTransfers",
          COALESCE(s."refunded_amount", 0)::float AS "refundedUakt",
          COALESCE(s."refunded_count", 0) AS "refundedTransfers"`;

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

  async findLatestBlockWithAttributes(attributes: (keyof Block)[], options?: { requireBme?: boolean }): Promise<Block | null> {
    return Block.findOne({
      attributes: [...new Set([...attributes, "datetime" as keyof Block])],
      where: {
        isProcessed: true,
        ...(options?.requireBme ? { vaultUakt: { [Op.ne]: null } } : { totalUUsdSpent: { [Op.not]: null } })
      },
      order: [["height", "DESC"]]
    });
  }

  async findDailyBlockSnapshots(attributes: (keyof Block)[], options?: { requireBme?: boolean }) {
    return Day.findAll({
      attributes: ["date"],
      include: [
        {
          model: Block,
          as: "lastBlock",
          attributes: attributes,
          required: true,
          where: options?.requireBme ? { vaultUakt: { [Op.ne]: null } } : undefined
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

  async findBmeDashboardData(): Promise<{ now: BmeDashboardRow; compare: BmeDashboardRow; secondCompare: BmeDashboardRow }> {
    const rows = await this.#chainDb.query<BmeDashboardRow & { period: string }>(
      `/* dashboard-stats:bme-dashboard */ WITH akt_price AS (
          SELECT "aktPrice" FROM "day"
          WHERE "aktPrice" IS NOT NULL AND "aktPrice" > 0
          ORDER BY "date" DESC
          LIMIT 1
        ), latest AS (
          SELECT b.*
          FROM "block" b
          WHERE b."vaultUakt" IS NOT NULL
            AND b."isProcessed" = true
          ORDER BY b."height" DESC
          LIMIT 1
        ), compare AS (
          SELECT b.*
          FROM "day" d
          INNER JOIN "block" b ON b."height" = d."lastBlockHeight"
          WHERE b."vaultUakt" IS NOT NULL
            AND d."date" <= (SELECT DATE("datetime") - INTERVAL '1 day' FROM latest)
          ORDER BY d."date" DESC
          LIMIT 1
        ), second_compare AS (
          SELECT b.*
          FROM "day" d
          INNER JOIN "block" b ON b."height" = d."lastBlockHeight"
          WHERE b."vaultUakt" IS NOT NULL
            AND d."date" <= (SELECT DATE("datetime") - INTERVAL '1 day' FROM compare)
          ORDER BY d."date" DESC
          LIMIT 1
        )
        SELECT 'now' AS "period",
          "datetime",
          COALESCE("outstandingUact", 0) AS "outstandingUact",
          COALESCE("vaultUakt", 0) AS "vaultUakt",
          CASE
            WHEN "outstandingUact" IS NULL OR "outstandingUact" = 0 THEN 0
            ELSE ROUND((COALESCE("vaultUakt", 0) * COALESCE((SELECT "aktPrice" FROM akt_price), 0) / "outstandingUact")::numeric, 6)::float
          END AS "collateralRatio",
          COALESCE("totalUaktBurnedForUact", 0) AS "totalUaktBurnedForUact",
          COALESCE("totalUactMinted", 0) AS "totalUactMinted",
          COALESCE("totalUactBurnedForUakt", 0) AS "totalUactBurnedForUakt",
          COALESCE("totalUaktReminted", 0) AS "totalUaktReminted"
        FROM latest
        UNION ALL
        SELECT 'compare' AS "period",
          "datetime",
          COALESCE("outstandingUact", 0) AS "outstandingUact",
          COALESCE("vaultUakt", 0) AS "vaultUakt",
          CASE
            WHEN "outstandingUact" IS NULL OR "outstandingUact" = 0 THEN 0
            ELSE ROUND((COALESCE("vaultUakt", 0) * COALESCE((SELECT "aktPrice" FROM akt_price), 0) / "outstandingUact")::numeric, 6)::float
          END AS "collateralRatio",
          COALESCE("totalUaktBurnedForUact", 0) AS "totalUaktBurnedForUact",
          COALESCE("totalUactMinted", 0) AS "totalUactMinted",
          COALESCE("totalUactBurnedForUakt", 0) AS "totalUactBurnedForUakt",
          COALESCE("totalUaktReminted", 0) AS "totalUaktReminted"
        FROM compare
        UNION ALL
        SELECT 'second_compare' AS "period",
          "datetime",
          COALESCE("outstandingUact", 0) AS "outstandingUact",
          COALESCE("vaultUakt", 0) AS "vaultUakt",
          CASE
            WHEN "outstandingUact" IS NULL OR "outstandingUact" = 0 THEN 0
            ELSE ROUND((COALESCE("vaultUakt", 0) * COALESCE((SELECT "aktPrice" FROM akt_price), 0) / "outstandingUact")::numeric, 6)::float
          END AS "collateralRatio",
          COALESCE("totalUaktBurnedForUact", 0) AS "totalUaktBurnedForUact",
          COALESCE("totalUactMinted", 0) AS "totalUactMinted",
          COALESCE("totalUactBurnedForUakt", 0) AS "totalUactBurnedForUakt",
          COALESCE("totalUaktReminted", 0) AS "totalUaktReminted"
        FROM second_compare`,
      { type: QueryTypes.SELECT }
    );

    const emptyRow: BmeDashboardRow = {
      datetime: new Date(),
      outstandingUact: 0,
      vaultUakt: 0,
      collateralRatio: 0,
      totalUaktBurnedForUact: 0,
      totalUactMinted: 0,
      totalUactBurnedForUakt: 0,
      totalUaktReminted: 0
    };

    const nowRow = rows.find(r => r.period === "now") ?? emptyRow;
    const compareRow = rows.find(r => r.period === "compare") ?? emptyRow;
    const secondCompareRow = rows.find(r => r.period === "second_compare") ?? emptyRow;

    return { now: nowRow, compare: compareRow, secondCompare: secondCompareRow };
  }

  async findSinkDailyTotals(): Promise<SinkTotalsRow[]> {
    return this.#chainDb.query<SinkTotalsRow>(
      `/* dashboard-stats:sink-daily-totals */ WITH first_transfers AS MATERIALIZED (
          SELECT MIN(t."height") AS "height"
          FROM "sink_transfer" t
          GROUP BY t."owner"
        )
        SELECT
          d."date",${SINK_TOTALS_COLUMNS},
          (
            SELECT COUNT(*)::int
            FROM first_transfers f
            WHERE f."height" <= COALESCE(d."lastBlockHeight", d."lastBlockHeightYet")
          ) AS "uniqueSenders"
        FROM "day" d
        CROSS JOIN LATERAL (
          SELECT t.*
          FROM "sink_totals_snapshot" t
          WHERE t."height" <= COALESCE(d."lastBlockHeight", d."lastBlockHeightYet")
          ORDER BY t."height" DESC
          LIMIT 1
        ) s
        WHERE d."firstBlockHeight" <= (
          SELECT b."height"
          FROM "block" b
          WHERE b."isProcessed" = true
          ORDER BY b."height" DESC
          LIMIT 1
        )
        ORDER BY d."date" ASC`,
      { type: QueryTypes.SELECT }
    );
  }

  async findSinkDashboardData(): Promise<{ now: SinkDashboardTotalsRow; compare: SinkDashboardTotalsRow; secondCompare: SinkDashboardTotalsRow }> {
    const rows = await this.#chainDb.query<SinkDashboardTotalsRow & { period: SinkDashboardPeriod }>(
      `/* dashboard-stats:sink-dashboard */ WITH latest AS (
          SELECT b."datetime"
          FROM "block" b
          WHERE b."isProcessed" = true
          ORDER BY b."height" DESC
          LIMIT 1
        ), period_dates AS (
          SELECT 'now' AS "period", latest."datetime" AS "date" FROM latest
          UNION ALL
          SELECT 'compare' AS "period", latest."datetime" - INTERVAL '24 hours' AS "date" FROM latest
          UNION ALL
          SELECT 'second_compare' AS "period", latest."datetime" - INTERVAL '48 hours' AS "date" FROM latest
        ), periods AS (
          SELECT
            pd."period",
            pd."date",
            (
              SELECT b."height"
              FROM "block" b
              WHERE b."datetime" <= pd."date"
              ORDER BY b."datetime" DESC
              LIMIT 1
            ) AS "height"
          FROM period_dates pd
        )
        SELECT
          p."period",
          p."date",${SINK_TOTALS_COLUMNS},
          (
            SELECT COUNT(DISTINCT t."owner")::int
            FROM "sink_transfer" t
            WHERE t."height" <= p."height"
          ) AS "uniqueSenders",
          (
            SELECT (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM minted."datetime" - created."datetime")))::float
            FROM "sink_transfer" t
            INNER JOIN "block" created ON created."height" = t."height"
            INNER JOIN "block" minted ON minted."height" = t."status_height"
            WHERE t."status" = 'minted' AND t."status_height" <= p."height"
          ) AS "medianSecondsToMint"
        FROM periods p
        LEFT JOIN LATERAL (
          SELECT t.*
          FROM "sink_totals_snapshot" t
          WHERE t."height" <= p."height"
          ORDER BY t."height" DESC
          LIMIT 1
        ) s ON true`,
      { type: QueryTypes.SELECT }
    );

    const findPeriod = (period: SinkDashboardPeriod): SinkDashboardTotalsRow => {
      const { period: _period, ...totals } = rows.find(row => row.period === period) ?? { period, ...emptySinkTotals(), medianSecondsToMint: null };
      return totals;
    };

    return { now: findPeriod("now"), compare: findPeriod("compare"), secondCompare: findPeriod("second_compare") };
  }

  async findSinkTransfers(query: { skip: number; limit: number; sort: SinkTransferSort }): Promise<SinkTransferRow[]> {
    return this.#chainDb.query<SinkTransferRow>(
      `/* dashboard-stats:sink-transfers */ SELECT
          t."owner",
          t."height",
          t."sequence",
          t."recipient",
          t."amount"::float AS "amountUakt",
          t."status",
          created."datetime" AS "createdAt",
          t."status_height" AS "statusHeight",
          updated."datetime" AS "statusUpdatedAt"
        FROM "sink_transfer" t
        INNER JOIN "block" created ON created."height" = t."height"
        INNER JOIN "block" updated ON updated."height" = t."status_height"
        ORDER BY ${SINK_TRANSFER_ORDER[query.sort]}
        LIMIT :limit OFFSET :skip`,
      { type: QueryTypes.SELECT, replacements: { limit: query.limit, skip: query.skip } }
    );
  }

  async countSinkTransfers(): Promise<number> {
    const [{ count }] = await this.#chainDb.query<{ count: number }>(
      `/* dashboard-stats:sink-transfers-count */ SELECT COUNT(*)::int AS "count" FROM "sink_transfer"`,
      { type: QueryTypes.SELECT }
    );

    return count;
  }

  async findSinkUnbondingDailyAmounts(): Promise<SinkUnbondingDailyAmountRow[]> {
    return this.#chainDb.query<SinkUnbondingDailyAmountRow>(
      `/* dashboard-stats:sink-unbondings-daily */ ${SINK_UNBONDING_CTES}
        SELECT 'unbondStarted' AS "series", ${UTC_DAY(`b."datetime"`)} AS "date", SUM(e."amount")::float AS "amountUakt"
        FROM unbond_entries e
        INNER JOIN "block" b ON b."height" = e."height"
        GROUP BY 2
        UNION ALL
        SELECT 'unbondCompleting', ${UTC_DAY(`e."completion_time"`)}, SUM(e."netAmount")::float
        FROM net_entries e
        GROUP BY 2
        UNION ALL
        SELECT 'cancelled', ${UTC_DAY(`b."datetime"`)}, SUM(c."amount")::float
        FROM cancellations c
        INNER JOIN "block" b ON b."height" = c."height"
        GROUP BY 2
        UNION ALL
        SELECT 'sentToSolana', ${UTC_DAY(`b."datetime"`)}, SUM(t."amount")::float
        FROM counted_transfers t
        INNER JOIN "block" b ON b."height" = t."height"
        GROUP BY 2
        UNION ALL
        SELECT 'sentBySendersWhoUnbonded', ${UTC_DAY(`b."datetime"`)}, SUM(t."amount")::float
        FROM counted_transfers t
        INNER JOIN "block" b ON b."height" = t."height"
        WHERE t."byUnbonder"
        GROUP BY 2`,
      { type: QueryTypes.SELECT }
    );
  }

  async findSinkUnbondingSummary(): Promise<SinkUnbondingSummaryRow> {
    const [summary] = await this.#chainDb.query<SinkUnbondingSummaryRow>(
      `/* dashboard-stats:sink-unbondings-summary */ ${SINK_UNBONDING_CTES}, latest AS (
          SELECT b."datetime"
          FROM "block" b
          WHERE b."isProcessed" = true
          ORDER BY b."height" DESC
          LIMIT 1
        ), still_unbonding AS (
          SELECT e.*
          FROM net_entries e
          WHERE e."completion_time" > (SELECT latest."datetime" FROM latest) AND e."netAmount" > 0
        )
        SELECT
          COALESCE((SELECT SUM(e."netAmount") FROM still_unbonding e), 0)::float AS "unbondingUakt",
          (SELECT COUNT(DISTINCT e."delegator") FROM still_unbonding e)::int AS "unbondingDelegators",
          (SELECT COUNT(DISTINCT t."owner") FROM counted_transfers t)::int AS "senders",
          (SELECT COUNT(DISTINCT t."owner") FROM counted_transfers t WHERE t."byUnbonder")::int AS "sendersWhoUnbonded",
          COALESCE((SELECT SUM(t."amount") FROM counted_transfers t), 0)::float AS "sentUakt",
          COALESCE((SELECT SUM(t."amount") FROM counted_transfers t WHERE t."byUnbonder"), 0)::float AS "sentBySendersWhoUnbondedUakt"`,
      { type: QueryTypes.SELECT }
    );

    return summary;
  }

  async findClosedLeases(owner: string, query: { dseq?: string; startDate: Date; endDate: Date }, options: { limit: number }) {
    const { dseq, startDate, endDate } = query;
    return Lease.findAll({
      attributes: ["dseq", "oseq", "gseq", "providerAddress", "createdHeight", "closedHeight"],
      where: {
        owner,
        closedHeight: { [Op.not]: null },
        "$createdBlock.datetime$": { [Op.gte]: startDate },
        "$closedBlock.datetime$": { [Op.lte]: endDate },
        ...(dseq ? { dseq } : {})
      },
      include: [
        { model: Block, as: "createdBlock", attributes: ["datetime"] },
        { model: Block, as: "closedBlock", attributes: ["datetime"] }
      ],
      order: [
        ["createdHeight", "ASC"],
        ["closedHeight", "ASC"],
        ["id", "ASC"]
      ],
      limit: options.limit
    });
  }
}

function emptySinkTotals(): SinkTotalsRow {
  return {
    date: new Date(),
    pendingUakt: 0,
    pendingTransfers: 0,
    mintedUakt: 0,
    mintedTransfers: 0,
    voidedUakt: 0,
    voidedTransfers: 0,
    refundPendingUakt: 0,
    refundPendingTransfers: 0,
    refundedUakt: 0,
    refundedTransfers: 0,
    uniqueSenders: 0
  };
}
