import { QueryTypes } from "sequelize";
import { singleton } from "tsyringe";

import { chainDb } from "@src/db/dbConnection";

export interface BillingUsageRawResult {
  date: string;
  activeLeases: number;
  dailyAktSpent: number;
  totalAktSpent: number;
  dailyUsdcSpent: number;
  totalUsdcSpent: number;
  dailyUsdSpent: number;
  totalUsdSpent: number;
}

@singleton()
export class UsageRepository {
  async getHistory(address: string, startDate: string, endDate: string) {
    const query = `
      WITH date_range AS (
        SELECT generate_series(
          :startDate::date,
          :endDate::date,
          '1 day'::interval
        )::date as date
      ),
      current_block AS (
        SELECT MAX(height) as height
        FROM block
      ),
      daily_leases AS (
        SELECT
          d.date,
          l.owner,
          l.denom,
          l.price,
          l."createdHeight",
          CASE
            WHEN l.id IS NULL THEN 0
            ELSE LEAST(d."lastBlockHeightYet", COALESCE(l."closedHeight", l."predictedClosedHeight")) -
                 GREATEST(d."firstBlockHeight", l."createdHeight")
            END as blocks_in_day,
          d."aktPrice"
        FROM date_range dr
               LEFT JOIN day d ON dr.date = d.date
               LEFT JOIN lease l ON
          l.owner = :address AND
          l."createdHeight" < COALESCE(d."lastBlockHeightYet", 999999999) AND
          COALESCE(l."closedHeight", l."predictedClosedHeight") > COALESCE(d."firstBlockHeight", 0)
      ),
      daily_costs AS (
        SELECT
          date,
          ROUND(CAST(SUM(CASE
            WHEN denom = 'uakt'
            THEN blocks_in_day * price / 1000000.0
            ELSE 0
            END) as numeric), 2) as daily_akt_spent,
          ROUND(CAST(SUM(CASE
            WHEN denom = 'uusdc'
            THEN blocks_in_day * price / 1000000.0
            ELSE 0
            END) as numeric), 2) as daily_usdc_spent,
          ROUND(CAST(SUM(CASE
            WHEN denom = 'uakt'
            THEN blocks_in_day * price * COALESCE("aktPrice", 0) / 1000000.0
            WHEN denom = 'uusdc'
            THEN blocks_in_day * price / 1000000.0
            ELSE 0
            END) as numeric), 2) as daily_usd_spent
        FROM daily_leases
        GROUP BY date
      )
      SELECT
        dr.date::DATE AS "date",
        COUNT(dl.owner) AS "activeLeases",
        COALESCE(dc.daily_akt_spent, 0) as "dailyAktSpent",
        COALESCE(SUM(dc.daily_akt_spent) OVER (ORDER BY dr.date), 0) as "totalAktSpent",
        COALESCE(dc.daily_usdc_spent, 0) as "dailyUsdcSpent",
        COALESCE(SUM(dc.daily_usdc_spent) OVER (ORDER BY dr.date), 0) as "totalUsdcSpent",
        COALESCE(dc.daily_usd_spent, 0) as "dailyUsdSpent",
        COALESCE(SUM(dc.daily_usd_spent) OVER (ORDER BY dr.date), 0) as "totalUsdSpent"
      FROM date_range dr
             LEFT JOIN daily_leases dl ON dl.date = dr.date
             LEFT JOIN daily_costs dc ON dc.date = dr.date
      GROUP BY
        dr.date,
        dc.daily_akt_spent,
        dc.daily_usdc_spent,
        dc.daily_usd_spent
      ORDER BY dr.date ASC;
    `;

    const results = await chainDb.query<BillingUsageRawResult>(query, {
      type: QueryTypes.SELECT,
      replacements: { address, startDate, endDate }
    });

    return results.map(row => ({
      date: row.date,
      activeLeases: row.activeLeases,
      dailyAktSpent: parseFloat(String(row.dailyAktSpent)),
      totalAktSpent: parseFloat(String(row.totalAktSpent)),
      dailyUsdcSpent: parseFloat(String(row.dailyUsdcSpent)),
      totalUsdcSpent: parseFloat(String(row.totalUsdcSpent)),
      dailyUsdSpent: parseFloat(String(row.dailyUsdSpent)),
      totalUsdSpent: parseFloat(String(row.totalUsdSpent))
    }));
  }
}
