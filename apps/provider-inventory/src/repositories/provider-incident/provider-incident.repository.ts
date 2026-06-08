import type { LoggerService } from "@akashnetwork/logging";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { inject, singleton } from "tsyringe";

import { providerIncidents } from "@src/model-schemas/provider-incident/provider-incident.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";

@singleton()
export class ProviderIncidentRepository {
  readonly #logger: LoggerService;
  readonly #db: PostgresJsDatabase;

  constructor(@inject(DRIZZLE_DB) db: PostgresJsDatabase, @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory) {
    this.#db = db;
    this.#logger = loggerFactory({ context: "ProviderIncidentRepository" });
  }

  async openIncident(provider: string): Promise<void> {
    const [opened] = await this.#db.insert(providerIncidents).values({ provider }).onConflictDoNothing().returning({ provider: providerIncidents.provider });

    if (opened) {
      this.#logger.info({ event: "PROVIDER_INCIDENT_OPENED", provider });
    }
  }

  async closeIncident(provider: string | string[]): Promise<void> {
    if (Array.isArray(provider) && provider.length === 0) return;

    const where = Array.isArray(provider) ? inArray(providerIncidents.provider, provider) : eq(providerIncidents.provider, provider);

    await this.#db
      .update(providerIncidents)
      .set({ endedAt: sql`now()` })
      .where(and(where, isNull(providerIncidents.endedAt)));
  }

  async closeAllOpen(): Promise<void> {
    await this.#db
      .update(providerIncidents)
      .set({ endedAt: sql`now()` })
      .where(isNull(providerIncidents.endedAt));
    this.#logger.info({ event: "PROVIDER_INCIDENTS_CLOSED_ALL_OPEN" });
  }
}
