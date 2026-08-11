import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { DependencyContainer, InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { PgClientService } from "@src/db/pg-client.service";
import * as schema from "@src/db/schema";
import { APP_CONFIG } from "@src/providers/app-config.provider";

const createDatabase = (c: DependencyContainer) => drizzle(c.resolve(PgClientService).client, { schema });

export type ChainDatabase = ReturnType<typeof createDatabase>;
export const CHAIN_DB: InjectionToken<ChainDatabase> = Symbol("CHAIN_DB");

container.register(CHAIN_DB, {
  useFactory: instancePerContainerCachingFactory(createDatabase)
});

export async function migrateDb(): Promise<void> {
  const config = container.resolve(APP_CONFIG);
  const migrationClient = postgres(config.POSTGRES_DB_URI, { max: 1 });
  const migrationDatabase = drizzle(migrationClient, { schema });

  try {
    await migrate(migrationDatabase, { migrationsFolder: config.DRIZZLE_MIGRATIONS_FOLDER });
  } finally {
    await migrationClient.end();
  }
}
