import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { DailyPrices } from "@src/db/schema";
import { LegacyPriceSeedService } from "@src/jobs/legacy-price-seed/legacy-price-seed.service";
import { DayCloseUsdService } from "@src/network/day-close-usd.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";

describe(LegacyPriceSeedService.name, () => {
  it("inserts the days the price table lacks and leaves the ones it already has", async () => {
    const { service, db } = await setup();
    await db.insert(DailyPrices).values({ date: "2021-01-02", denom: "uakt", price: "0.5" });

    const outcome = await service.seed([
      { date: "2021-01-01", price: 0.25 },
      { date: "2021-01-02", price: 0.9 },
      { date: "2021-01-03", price: 1 }
    ]);

    expect(outcome).toEqual({ received: 3, inserted: 2, skipped: 1 });
    expect(await db.select({ date: DailyPrices.date, price: DailyPrices.price }).from(DailyPrices).orderBy(DailyPrices.date)).toEqual([
      { date: "2021-01-01", price: "0.250000000000000000" },
      { date: "2021-01-02", price: "0.500000000000000000" },
      { date: "2021-01-03", price: "1.000000000000000000" }
    ]);
  });

  it("is a no-op on a second run", async () => {
    const { service } = await setup();
    await service.seed([{ date: "2021-01-01", price: 0.25 }]);

    expect(await service.seed([{ date: "2021-01-01", price: 0.25 }])).toEqual({ received: 1, inserted: 0, skipped: 1 });
  });

  async function setup() {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.delete(DailyPrices);
    const service = new LegacyPriceSeedService(db, container.resolve(DayCloseUsdService), mock<LoggerService>());
    return { service, db };
  }
});
