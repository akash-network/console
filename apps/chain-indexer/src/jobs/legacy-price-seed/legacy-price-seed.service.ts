import { inject, singleton } from "tsyringe";

import { DailyPrices } from "@src/db/schema";
import { DayCloseUsdService } from "@src/network/day-close-usd.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

const PRICE_DENOM = "uakt";

export interface LegacyDailyPrice {
  date: string;
  price: number;
}

export interface SeedOutcome {
  received: number;
  inserted: number;
  skipped: number;
}

/** Fills the days the price job cannot reach (CoinGecko serves about a year) from the legacy indexer's daily AKT prices, never overwriting a day already priced. */
@singleton()
export class LegacyPriceSeedService {
  readonly #db: ChainDatabase;
  readonly #dayCloseUsd: DayCloseUsdService;
  readonly #logger: LoggerService;

  constructor(@inject(CHAIN_DB) db: ChainDatabase, @inject(DayCloseUsdService) dayCloseUsd: DayCloseUsdService, @inject(LoggerService) logger: LoggerService) {
    this.#db = db;
    this.#dayCloseUsd = dayCloseUsd;
    this.#logger = logger;
    this.#logger.setContext("LEGACY_PRICE_SEED");
  }

  async seed(prices: LegacyDailyPrice[]): Promise<SeedOutcome> {
    if (prices.length === 0) {
      return { received: 0, inserted: 0, skipped: 0 };
    }

    const inserted = await this.#db
      .insert(DailyPrices)
      .values(prices.map(price => ({ date: price.date, denom: PRICE_DENOM, price: String(price.price), updatedAt: new Date() })))
      .onConflictDoNothing()
      .returning({ date: DailyPrices.date });
    const restated = await this.#dayCloseUsd.recompute(this.#db);

    const outcome = { received: prices.length, inserted: inserted.length, skipped: prices.length - inserted.length };
    this.#logger.info({ event: "LEGACY_PRICES_SEEDED", ...outcome, restated: restated.length });
    return outcome;
  }
}
