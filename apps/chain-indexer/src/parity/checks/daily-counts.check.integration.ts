import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it, onTestFinished } from "vitest";

import { Blocks } from "@src/db/schema";
import { DailyCountsCheck } from "@src/parity/checks/daily-counts.check";
import { createLegacyDatabase } from "@src/parity/legacy-db";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

describe(DailyCountsCheck.name, () => {
  it("passes when both databases agree on every day's block and transaction counts over the shared height range", async () => {
    const { check } = await setup({
      v2: [block(1, "2026-08-10T00:00:00Z", 1), block(2, "2026-08-10T12:00:00Z", 2), block(3, "2026-08-11T00:00:00Z", 0), block(4, "2026-08-12T00:00:00Z", 5)],
      legacy: [block(1, "2026-08-10T00:00:00Z", 1), block(2, "2026-08-10T12:00:00Z", 2), block(3, "2026-08-11T00:00:00Z", 0)]
    });

    const result = await check.run();

    expect(result).toEqual({ name: "daily-counts", status: "pass", summary: "2 days agree over heights 1 to 3", mismatches: [] });
  });

  it("fails with the days whose counts differ", async () => {
    const { check } = await setup({
      v2: [block(1, "2026-08-10T00:00:00Z", 1), block(2, "2026-08-10T12:00:00Z", 2), block(3, "2026-08-11T00:00:00Z", 4)],
      legacy: [block(1, "2026-08-10T00:00:00Z", 1), block(2, "2026-08-10T12:00:00Z", 3), block(3, "2026-08-11T00:00:00Z", 4)]
    });

    const result = await check.run();

    expect(result.status).toBe("fail");
    expect(result.mismatches).toEqual([{ subject: "2026-08-10.transactions", expected: 4, actual: 3 }]);
  });

  it("is skipped when the databases share no heights", async () => {
    const { check } = await setup({ v2: [block(10, "2026-08-10T00:00:00Z", 0)], legacy: [block(1, "2026-08-01T00:00:00Z", 0)] });

    expect((await check.run()).status).toBe("skipped");
  });

  interface BlockFixture {
    height: number;
    datetime: string;
    txCount: number;
  }

  function block(height: number, datetime: string, txCount: number): BlockFixture {
    return { height, datetime, txCount };
  }

  async function setup(input: { v2: BlockFixture[]; legacy: BlockFixture[] }) {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.delete(Blocks);
    await db.insert(Blocks).values(
      input.v2.map(row => ({
        height: row.height,
        datetime: new Date(row.datetime),
        hash: Buffer.from([row.height]),
        parentHash: null,
        proposerAddress: "P",
        txCount: row.txCount
      }))
    );

    await db.execute(sql`DROP TABLE IF EXISTS public.block`);
    await db.execute(sql`CREATE TABLE public.block (height integer PRIMARY KEY, datetime timestamptz NOT NULL, "txCount" integer NOT NULL)`);
    for (const row of input.legacy) {
      await db.execute(sql`INSERT INTO public.block (height, datetime, "txCount") VALUES (${row.height}, ${row.datetime}::timestamptz, ${row.txCount})`);
    }

    const legacy = createLegacyDatabase(process.env.POSTGRES_DB_URI!);
    onTestFinished(() => legacy.end());
    const check = new DailyCountsCheck(db, legacy);
    return { check };
  }
});
