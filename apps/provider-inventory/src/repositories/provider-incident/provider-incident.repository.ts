import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { providerIncidents } from "@src/model-schemas/provider-incident/provider-incident.schema";
import { DbDriver } from "../db-driver/db-driver";

@singleton()
export class ProviderIncidentRepository {
  readonly driver: DbDriver;

  constructor(driver: DbDriver) {
    this.driver = driver;
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
