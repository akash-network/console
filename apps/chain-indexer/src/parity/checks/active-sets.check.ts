import { and, isNull, lte, or, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { Deployments, Leases, Providers } from "@src/db/schema";
import type { LegacyDatabase } from "@src/parity/legacy-db";
import type { CheckResult, Mismatch, ParityCheck } from "@src/parity/report";
import type { ChainDatabase } from "@src/providers/db.provider";

interface EntitySet {
  name: string;
  v2: { table: PgTable; createdHeight: PgColumn; closedHeight: PgColumn };
  legacyCountAt: (legacy: LegacyDatabase, height: number) => Promise<number>;
}

const ENTITY_SETS: EntitySet[] = [
  {
    name: "deployments",
    v2: { table: Deployments, createdHeight: Deployments.createdHeight, closedHeight: Deployments.closedHeight },
    legacyCountAt: (legacy, height) =>
      legacyCount(
        legacy`SELECT count(*)::int AS count FROM deployment WHERE "createdHeight" <= ${height} AND ("closedHeight" IS NULL OR "closedHeight" > ${height})`
      )
  },
  {
    name: "leases",
    v2: { table: Leases, createdHeight: Leases.createdHeight, closedHeight: Leases.closedHeight },
    legacyCountAt: (legacy, height) =>
      legacyCount(
        legacy`SELECT count(*)::int AS count FROM lease WHERE "createdHeight" <= ${height} AND ("closedHeight" IS NULL OR "closedHeight" > ${height})`
      )
  },
  {
    name: "providers",
    v2: { table: Providers, createdHeight: Providers.createdHeight, closedHeight: Providers.deletedHeight },
    legacyCountAt: (legacy, height) =>
      legacyCount(
        legacy`SELECT count(*)::int AS count FROM provider WHERE "createdHeight" <= ${height} AND ("deletedHeight" IS NULL OR "deletedHeight" > ${height})`
      )
  }
];

/** How many deployments, leases and providers were open at each fixed height on both systems: a lifecycle check that does not depend on either tip. */
export class ActiveSetsCheck implements ParityCheck {
  readonly name = "active-sets";
  readonly #db: ChainDatabase;
  readonly #legacy: LegacyDatabase;
  readonly #heights: number[];

  constructor(db: ChainDatabase, legacy: LegacyDatabase, heights: number[]) {
    this.#db = db;
    this.#legacy = legacy;
    this.#heights = heights;
  }

  async run(): Promise<CheckResult> {
    if (this.#heights.length === 0) {
      return { name: this.name, status: "skipped", summary: "no heights configured", mismatches: [] };
    }

    const mismatches: Mismatch[] = [];
    for (const height of this.#heights) {
      for (const set of ENTITY_SETS) {
        const [expected, actual] = await Promise.all([set.legacyCountAt(this.#legacy, height), this.#v2CountAt(set, height)]);
        if (expected !== actual) {
          mismatches.push({ subject: `${set.name}@${height}`, expected, actual });
        }
      }
    }

    return {
      name: this.name,
      status: mismatches.length === 0 ? "pass" : "fail",
      summary: `${ENTITY_SETS.length} entity sets ${mismatches.length === 0 ? "agree" : `compared, ${mismatches.length} differences`} at heights ${this.#heights.join(", ")}`,
      mismatches
    };
  }

  async #v2CountAt(set: EntitySet, height: number): Promise<number> {
    const [row] = await this.#db
      .select({ count: sql<number>`count(*)::int` })
      .from(set.v2.table)
      .where(and(lte(set.v2.createdHeight, height), or(isNull(set.v2.closedHeight), sql`${set.v2.closedHeight} > ${height}`)));
    return row.count;
  }
}

async function legacyCount(query: Promise<{ count: number }[]>): Promise<number> {
  const [row] = await query;
  return row.count;
}
