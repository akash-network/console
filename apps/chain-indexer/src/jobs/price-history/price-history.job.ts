import { sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { DailyPrices } from "@src/db/schema";
import type { PricePoint } from "@src/jobs/price-history/close-prices-by-day";
import { closePricesByDay } from "@src/jobs/price-history/close-prices-by-day";
import { DayCloseUsdService } from "@src/network/day-close-usd.service";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import type { Fetch } from "@src/providers/fetch.provider";
import { FETCH } from "@src/providers/fetch.provider";
import { LoggerService } from "@src/providers/logging.provider";

const PRICE_DENOM = "uakt";
/** The most CoinGecko's public market chart returns at daily granularity; older days come from the legacy seed. */
const MARKET_CHART_DAYS = 360;

interface MarketChartResponse {
  prices: PricePoint[];
}

/** Keeps `daily_prices` at CoinGecko's daily USD close for the coin and restates the rollup days whose price moved. */
@singleton()
export class PriceHistoryJob {
  readonly #db: ChainDatabase;
  readonly #fetch: Fetch;
  readonly #config: EnvConfig;
  readonly #dayCloseUsd: DayCloseUsdService;
  readonly #logger: LoggerService;

  constructor(
    @inject(CHAIN_DB) db: ChainDatabase,
    @inject(FETCH) fetch: Fetch,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(DayCloseUsdService) dayCloseUsd: DayCloseUsdService,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#fetch = fetch;
    this.#config = config;
    this.#dayCloseUsd = dayCloseUsd;
    this.#logger = logger;
    this.#logger.setContext("PRICE_HISTORY");
  }

  async run(signal: AbortSignal): Promise<void> {
    const coinId = this.#config.PRICE_COINGECKO_ID;
    const url = `${this.#config.COINGECKO_API_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=${MARKET_CHART_DAYS}`;
    const response = await this.#fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Price history request failed with status ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }

    const { prices } = (await response.json()) as MarketChartResponse;
    const closes = closePricesByDay(prices);
    const changed = await this.#upsertPrices(closes);
    const restated = await this.#dayCloseUsd.recompute(this.#db);

    this.#logger.info({ event: "PRICE_HISTORY_SYNCED", coinId, days: closes.size, changed: changed.length, restated: restated.length });
  }

  /** Only a moved price rewrites a row, so `updated_at` records when a day's price last actually changed. */
  async #upsertPrices(closes: Map<string, number>): Promise<string[]> {
    if (closes.size === 0) {
      return [];
    }

    const rows = [...closes].map(([date, price]) => ({ date, denom: PRICE_DENOM, price: String(price), updatedAt: new Date() }));
    const changed = await this.#db
      .insert(DailyPrices)
      .values(rows)
      .onConflictDoUpdate({
        target: [DailyPrices.date, DailyPrices.denom],
        set: { price: sql`excluded.price`, updatedAt: sql`excluded.updated_at` },
        setWhere: sql`${DailyPrices.price} IS DISTINCT FROM excluded.price`
      })
      .returning({ date: DailyPrices.date });

    return changed.map(row => row.date);
  }
}
