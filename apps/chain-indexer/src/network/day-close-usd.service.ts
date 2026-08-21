import { and, eq, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { DailyPrices, NetworkRollups } from "@src/db/schema";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

const MICRO_UNITS_PER_TOKEN = sql`1000000::numeric`;

/**
 * Fills or restates `daily_usd_spent` on the network rollups from `daily_prices`, touching only the
 * days whose stored `akt_price_used` differs from the current price — so a restatement updates
 * exactly one row per affected day and a rerun is a no-op. uusdc and uact are stablecoins pegged
 * 1 USD per whole token, mirroring the legacy USD computation; uakt converts at the day's close price.
 */
@singleton()
export class DayCloseUsdService {
  readonly #logger: LoggerService;

  constructor(@inject(LoggerService) logger: LoggerService) {
    this.#logger = logger;
    this.#logger.setContext("DAY_CLOSE_USD");
  }

  async recompute(executor: ChainDatabase | ChainTransaction, date?: string): Promise<string[]> {
    const updated = await executor
      .update(NetworkRollups)
      .set({
        dailyUsdSpent: sql`${NetworkRollups.dailyUaktSpent} / ${MICRO_UNITS_PER_TOKEN} * ${DailyPrices.price} + (${NetworkRollups.dailyUusdcSpent} + ${NetworkRollups.dailyUactSpent}) / ${MICRO_UNITS_PER_TOKEN}`,
        aktPriceUsed: sql`${DailyPrices.price}`,
        usdComputedAt: new Date()
      })
      .from(DailyPrices)
      .where(
        and(
          eq(DailyPrices.denom, "uakt"),
          eq(DailyPrices.date, NetworkRollups.date),
          sql`${NetworkRollups.aktPriceUsed} IS DISTINCT FROM ${DailyPrices.price}`,
          date === undefined ? undefined : eq(NetworkRollups.date, date)
        )
      )
      .returning({ date: NetworkRollups.date });

    const dates = updated.map(row => row.date).sort();
    if (dates.length > 0) {
      this.#logger.info({ event: "DAILY_USD_RESTATED", count: dates.length, dates });
    }
    return dates;
  }
}
