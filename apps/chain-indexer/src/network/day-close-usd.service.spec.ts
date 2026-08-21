import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { DailyPrices } from "@src/db/schema";
import { DayCloseUsdService } from "@src/network/day-close-usd.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";

describe(DayCloseUsdService.name, () => {
  it("updates only rollups whose stored price differs from the daily price", async () => {
    const { service, executor, captured } = setup({ updatedRows: [{ date: "2026-08-14" }, { date: "2026-08-13" }] });

    const dates = await service.recompute(executor);

    expect(dates).toEqual(["2026-08-13", "2026-08-14"]);
    expect(captured.from).toBe(DailyPrices);
    expect(renderSql(captured.where as SQL)).toContain('"akash"."daily_prices"."denom" = ');
    expect(renderSql(captured.where as SQL)).toContain('"akash"."daily_prices"."date" = "akash"."network_rollups"."date"');
    expect(renderSql(captured.where as SQL)).toContain('"akash"."network_rollups"."akt_price_used" IS DISTINCT FROM "akash"."daily_prices"."price"');
  });

  it("converts micro-denom daily spend into whole USD at the day price", async () => {
    const { service, executor, captured } = setup({});

    await service.recompute(executor);

    const set = captured.set as Record<string, unknown>;
    expect(renderSql(set.dailyUsdSpent as SQL)).toBe(
      '"akash"."network_rollups"."daily_uakt_spent" / 1000000::numeric * "akash"."daily_prices"."price" + ("akash"."network_rollups"."daily_uusdc_spent" + "akash"."network_rollups"."daily_uact_spent") / 1000000::numeric'
    );
    expect(renderSql(set.aktPriceUsed as SQL)).toBe('"akash"."daily_prices"."price"');
    expect(set.usdComputedAt).toBeInstanceOf(Date);
  });

  it("scopes the restatement to a single day when a date is given", async () => {
    const { service, executor, captured } = setup({ updatedRows: [{ date: "2026-08-13" }] });

    const dates = await service.recompute(executor, "2026-08-13");

    expect(dates).toEqual(["2026-08-13"]);
    expect(renderSql(captured.where as SQL)).toContain('"akash"."network_rollups"."date" = ');
  });

  it("logs nothing when no day needed restating", async () => {
    const { service, executor, logger } = setup({ updatedRows: [] });

    const dates = await service.recompute(executor);

    expect(dates).toEqual([]);
    expect(logger.info).not.toHaveBeenCalled();
  });

  function setup(input: { updatedRows?: { date: string }[] }) {
    const captured: { set?: unknown; from?: unknown; where?: unknown } = {};

    const executor = {
      update: () => ({
        set: (values: unknown) => {
          captured.set = values;
          return {
            from: (table: unknown) => {
              captured.from = table;
              return {
                where: (condition: unknown) => {
                  captured.where = condition;
                  return { returning: () => Promise.resolve(input.updatedRows ?? []) };
                }
              };
            }
          };
        }
      })
    };

    const logger = mock<LoggerService>();
    const service = new DayCloseUsdService(logger);
    return { service, executor: executor as unknown as ChainDatabase, captured, logger };
  }

  function renderSql(fragment: SQL): string {
    return new PgDialect().sqlToQuery(fragment).sql;
  }
});
