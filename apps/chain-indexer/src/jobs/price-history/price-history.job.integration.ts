import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "@src/config/env.config";
import { DailyPrices, NetworkRollups } from "@src/db/schema";
import { PriceHistoryJob } from "@src/jobs/price-history/price-history.job";
import { DayCloseUsdService } from "@src/network/day-close-usd.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import type { Fetch } from "@src/providers/fetch.provider";
import type { LoggerService } from "@src/providers/logging.provider";

describe(PriceHistoryJob.name, () => {
  it("stores each utc day's close price and restates the usd of the rollups it prices", async () => {
    const { job, db, fetch } = await setup({
      prices: [
        [Date.UTC(2026, 7, 10, 0, 0), 1.5],
        [Date.UTC(2026, 7, 11, 0, 0), 2.0],
        [Date.UTC(2026, 7, 11, 23, 0), 2.5]
      ]
    });

    await job.run(new AbortController().signal);

    expect(await db.select({ date: DailyPrices.date, denom: DailyPrices.denom, price: DailyPrices.price }).from(DailyPrices).orderBy(DailyPrices.date)).toEqual(
      [
        { date: "2026-08-10", denom: "uakt", price: "1.500000000000000000" },
        { date: "2026-08-11", denom: "uakt", price: "2.500000000000000000" }
      ]
    );
    const [rollup] = await db.select({ dailyUsdSpent: NetworkRollups.dailyUsdSpent, aktPriceUsed: NetworkRollups.aktPriceUsed }).from(NetworkRollups);
    expect(rollup).toEqual({ dailyUsdSpent: "25.000000000000000000", aktPriceUsed: "2.500000000000000000" });
    expect(fetch).toHaveBeenCalledWith(
      "https://coingecko.test/api/v3/coins/akash-network/market_chart?vs_currency=usd&days=360",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("leaves unchanged prices alone and only rewrites the days whose price moved", async () => {
    const { job, db, logger } = await setup({ prices: [[Date.UTC(2026, 7, 11, 0, 0), 2.5]] });
    await job.run(new AbortController().signal);
    const [{ updatedAt: firstUpdatedAt }] = await db.select({ updatedAt: DailyPrices.updatedAt }).from(DailyPrices);

    await job.run(new AbortController().signal);

    const [{ updatedAt }] = await db.select({ updatedAt: DailyPrices.updatedAt }).from(DailyPrices);
    expect(updatedAt).toEqual(firstUpdatedAt);
    expect(logger.info).toHaveBeenLastCalledWith(expect.objectContaining({ event: "PRICE_HISTORY_SYNCED", days: 1, changed: 0 }));
  });

  it("fails the run when the price api answers an error", async () => {
    const { job, db } = await setup({ status: 429, body: "rate limited" });

    await expect(job.run(new AbortController().signal)).rejects.toThrow(/429/);
    expect(await db.select().from(DailyPrices)).toEqual([]);
  });

  async function setup(input: { prices?: Array<[number, number]>; status?: number; body?: string }) {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.delete(NetworkRollups);
    await db.delete(DailyPrices);
    await db.insert(NetworkRollups).values({
      date: "2026-08-11",
      closeHeight: 10,
      closeAt: new Date("2026-08-11T23:59:59Z"),
      activeLeaseCount: 0,
      totalLeaseCount: 0,
      dailyLeaseCount: 0,
      activeProviderCount: 0,
      activeCpuUnits: 0,
      activeGpuUnits: 0,
      activeMemoryBytes: 0,
      activeEphemeralStorageBytes: 0,
      activePersistentStorageBytes: 0,
      totalUaktSpent: "10000000",
      totalUusdcSpent: "0",
      totalUactSpent: "0",
      dailyUaktSpent: "10000000",
      dailyUusdcSpent: "0",
      dailyUactSpent: "0"
    });

    const fetch = vi.fn<Fetch>(
      async () =>
        new Response(input.status ? input.body : JSON.stringify({ prices: input.prices ?? [] }), {
          status: input.status ?? 200,
          headers: { "content-type": input.status ? "text/plain" : "application/json" }
        })
    );
    const config = envSchema.parse({ POSTGRES_DB_URI: process.env.POSTGRES_DB_URI, INDEXER_ROLE: "jobs", COINGECKO_API_URL: "https://coingecko.test/api/v3" });
    const logger = mock<LoggerService>();
    const job = new PriceHistoryJob(db, fetch, config, container.resolve(DayCloseUsdService), logger);

    return { job, db, fetch, logger };
  }
});
