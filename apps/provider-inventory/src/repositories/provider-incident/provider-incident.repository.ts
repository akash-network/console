import { and, eq, getTableName, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
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

export interface DailyDowntimeRow {
  provider: string;
  date: string; // local calendar date, "YYYY-MM-DD"
  hasOpenIncident: boolean; // true if the provider has ANY currently-open incident
  incidentCount: number; // incident intervals overlapping that day
  downtimeSeconds: number; // clipped-to-day downtime in seconds (max 86400/day)
}

@singleton()
export class ProviderIncidentRepository {
  readonly driver: DbDriver;
  readonly #sql: Database;

  constructor(driver: DbDriver, @inject(PG_CLIENT) sql: Database) {
    this.driver = driver;
    this.#sql = sql;
  }

  async findDailyDowntimeByProviders(providers: string[], timeZone = "UTC"): Promise<DailyDowntimeRow[]> {
    if (providers.length === 0) return [];

    const daysAgo = 7; // 7-day rolling window (today + 6 prior days)
    const sql = this.#sql;
    return sql<DailyDowntimeRow[]>`
      WITH day_bounds AS MATERIALIZED (
        SELECT
          (date_trunc('day', now() AT TIME ZONE ${timeZone}::text) - make_interval(days => g.idx))::date AS day,
          (date_trunc('day', now() AT TIME ZONE ${timeZone}::text) - make_interval(days => g.idx)) AT TIME ZONE ${timeZone}::text AS day_start,
          (date_trunc('day', now() AT TIME ZONE ${timeZone}::text) - make_interval(days => g.idx) + interval '1 day') AT TIME ZONE ${timeZone}::text AS day_end
        FROM generate_series(0, ${daysAgo - 1}) AS g(idx)
      ),
      recent AS (
        SELECT
          ${sql(providerIncidents.provider.name)} AS provider,
          ${sql(providerIncidents.startedAt.name)} AS started_at,
          ${sql(providerIncidents.endedAt.name)} IS NULL AS is_open,
          COALESCE(${sql(providerIncidents.endedAt.name)}, now()) AS ended_at
        FROM ${sql(INCIDENTS_TABLE)}
        WHERE ${sql(providerIncidents.provider.name)} IN ${sql(providers)}
          AND (${sql(providerIncidents.endedAt.name)} IS NULL
               OR ${sql(providerIncidents.endedAt.name)} >= (date_trunc('day', now() AT TIME ZONE ${timeZone}::text) - make_interval(days => 6)) AT TIME ZONE ${timeZone}::text)
      )
      SELECT
        i.provider,
        to_char(d.day, 'YYYY-MM-DD') AS "date",
        bool_or(bool_or(i.is_open)) OVER (PARTITION BY i.provider) AS "hasOpenIncident",
        count(*)::int AS "incidentCount",
        SUM(EXTRACT(EPOCH FROM (
          LEAST(i.ended_at, d.day_end) - GREATEST(i.started_at, d.day_start)
        )))::int AS "downtimeSeconds"
      FROM recent i
      JOIN day_bounds d
        ON i.started_at < d.day_end
       AND i.ended_at  > d.day_start
      GROUP BY i.provider, d.day
      ORDER BY i.provider, d.day
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

  async deleteEndedBefore(retentionDays: number): Promise<number> {
    const deleted = await this.driver
      .getDb()
      .delete(providerIncidents)
      .where(and(isNotNull(providerIncidents.endedAt), lt(providerIncidents.endedAt, sql`now() - make_interval(days => ${retentionDays})`)))
      .returning({ provider: providerIncidents.provider });

    return deleted.length;
  }
}
