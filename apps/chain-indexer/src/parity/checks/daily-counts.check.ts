import { sql } from "drizzle-orm";

import { Blocks } from "@src/db/schema";
import type { LegacyDatabase } from "@src/parity/legacy-db";
import type { CheckResult, Mismatch, ParityCheck } from "@src/parity/report";
import type { ChainDatabase } from "@src/providers/db.provider";

interface DailyCount {
  day: string;
  blocks: number;
  transactions: number;
}

/** Per-UTC-day block and transaction counts on both databases over the heights both have indexed; the block table is the one table the two schemas share in meaning. */
export class DailyCountsCheck implements ParityCheck {
  readonly name = "daily-counts";
  readonly #db: ChainDatabase;
  readonly #legacy: LegacyDatabase;

  constructor(db: ChainDatabase, legacy: LegacyDatabase) {
    this.#db = db;
    this.#legacy = legacy;
  }

  async run(): Promise<CheckResult> {
    const [v2Range, legacyRange] = await Promise.all([this.#v2HeightRange(), this.#legacyHeightRange()]);
    if (!v2Range || !legacyRange) {
      return { name: this.name, status: "skipped", summary: "one of the databases has no blocks", mismatches: [] };
    }

    const from = Math.max(v2Range.min, legacyRange.min);
    const to = Math.min(v2Range.max, legacyRange.max);
    if (from > to) {
      return {
        name: this.name,
        status: "skipped",
        summary: `no shared heights (v2 ${v2Range.min}-${v2Range.max}, legacy ${legacyRange.min}-${legacyRange.max})`,
        mismatches: []
      };
    }

    const [v2Days, legacyDays] = await Promise.all([this.#v2DailyCounts(from, to), this.#legacyDailyCounts(from, to)]);
    const mismatches = compareDays(legacyDays, v2Days);

    return {
      name: this.name,
      status: mismatches.length === 0 ? "pass" : "fail",
      summary: `${legacyDays.length} days ${mismatches.length === 0 ? "agree" : `compared, ${mismatches.length} differences`} over heights ${from} to ${to}`,
      mismatches
    };
  }

  async #v2HeightRange(): Promise<{ min: number; max: number } | null> {
    const [row] = await this.#db
      .select({ min: sql<number | null>`min(${Blocks.height})::int`, max: sql<number | null>`max(${Blocks.height})::int` })
      .from(Blocks);
    return row?.min === null || row?.max === null ? null : { min: row.min, max: row.max };
  }

  async #legacyHeightRange(): Promise<{ min: number; max: number } | null> {
    const [row] = await this.#legacy<{ min: number | null; max: number | null }[]>`SELECT min(height)::int AS min, max(height)::int AS max FROM block`;
    return row.min === null || row.max === null ? null : { min: row.min, max: row.max };
  }

  async #v2DailyCounts(from: number, to: number): Promise<DailyCount[]> {
    const rows = await this.#db
      .select({
        day: sql<string>`to_char(${Blocks.datetime} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        blocks: sql<number>`count(*)::int`,
        transactions: sql<number>`coalesce(sum(${Blocks.txCount}), 0)::int`
      })
      .from(Blocks)
      .where(sql`${Blocks.height} BETWEEN ${from} AND ${to}`)
      .groupBy(sql`1`)
      .orderBy(sql`1`);
    return rows;
  }

  async #legacyDailyCounts(from: number, to: number): Promise<DailyCount[]> {
    return await this.#legacy<DailyCount[]>`
      SELECT to_char(datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS blocks, coalesce(sum("txCount"), 0)::int AS transactions
      FROM block
      WHERE height BETWEEN ${from} AND ${to}
      GROUP BY 1
      ORDER BY 1
    `;
  }
}

function compareDays(expected: DailyCount[], actual: DailyCount[]): Mismatch[] {
  const actualByDay = new Map(actual.map(day => [day.day, day]));
  const mismatches: Mismatch[] = [];

  for (const day of expected) {
    const counterpart = actualByDay.get(day.day);
    if (!counterpart) {
      mismatches.push({ subject: day.day, expected: { blocks: day.blocks, transactions: day.transactions }, actual: undefined });
      continue;
    }
    if (counterpart.blocks !== day.blocks) {
      mismatches.push({ subject: `${day.day}.blocks`, expected: day.blocks, actual: counterpart.blocks });
    }
    if (counterpart.transactions !== day.transactions) {
      mismatches.push({ subject: `${day.day}.transactions`, expected: day.transactions, actual: counterpart.transactions });
    }
    actualByDay.delete(day.day);
  }
  for (const [day, counts] of actualByDay) {
    mismatches.push({ subject: day, expected: undefined, actual: { blocks: counts.blocks, transactions: counts.transactions } });
  }

  return mismatches;
}
