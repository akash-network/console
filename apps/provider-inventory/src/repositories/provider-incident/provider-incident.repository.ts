import { and, eq, getTableName, inArray, isNull, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { providerIncidents } from "@src/model-schemas/provider-incident/provider-incident.schema";
import { type Database, PG_CLIENT } from "@src/providers/postgres.provider";
import { DbDriver } from "../db-driver/db-driver";

const INCIDENTS_TABLE = getTableName(providerIncidents);

export interface RecentIncidentRow {
  provider: string;
  startedAt: string;
  endedAt: string | null;
}

@singleton()
export class ProviderIncidentRepository {
  readonly driver: DbDriver;
  readonly #sql: Database;

  constructor(driver: DbDriver, @inject(PG_CLIENT) sql: Database) {
    this.driver = driver;
    this.#sql = sql;
  }

  /**
   * Returns raw incident intervals for the given providers within the rolling window (default 8 days).
   * Ongoing incidents (`ended_at IS NULL`) are always included with `endedAt: null`.
   * Rows are flat and ordered by `(provider, started_at ASC)` so callers can group in returned order.
   */
  async findRecentByProviders(owners: string[], days = 8): Promise<RecentIncidentRow[]> {
    if (owners.length === 0) return [];

    const sql = this.#sql;
    return sql<RecentIncidentRow[]>`
      SELECT
        ${sql(providerIncidents.provider.name)} AS provider,
        to_char(${sql(providerIncidents.startedAt.name)} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "startedAt",
        to_char(${sql(providerIncidents.endedAt.name)} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "endedAt"
      FROM ${sql(INCIDENTS_TABLE)}
      WHERE ${sql(providerIncidents.provider.name)} IN ${sql(owners)}
        AND (${sql(providerIncidents.endedAt.name)} IS NULL OR ${sql(providerIncidents.endedAt.name)} >= now() - make_interval(days => ${days}))
      ORDER BY ${sql(providerIncidents.provider.name)}, ${sql(providerIncidents.startedAt.name)} ASC
    `;
  }

  async openIncident(provider: string): Promise<void> {
    await this.driver.getDb().insert(providerIncidents).values({ provider }).onConflictDoNothing().returning({ provider: providerIncidents.provider });
  }

  async closeIncident(provider: string | string[]): Promise<void> {
    if (Array.isArray(provider) && provider.length === 0) return;

    const where = Array.isArray(provider) ? inArray(providerIncidents.provider, provider) : eq(providerIncidents.provider, provider);

    await this.driver
      .getDb()
      .update(providerIncidents)
      .set({ endedAt: sql`now()` })
      .where(and(where, isNull(providerIncidents.endedAt)));
  }

  async closeAllOpen(): Promise<void> {
    await this.driver
      .getDb()
      .update(providerIncidents)
      .set({ endedAt: sql`now()` })
      .where(isNull(providerIncidents.endedAt));
  }
}
