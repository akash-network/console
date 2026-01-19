import { LoggerService } from "@akashnetwork/logging";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { ADMIN_CONFIG } from "@src/core/providers/config.provider";
import * as schema from "./schema";

export const POSTGRES_DB: InjectionToken<ReturnType<typeof drizzle>> = Symbol("POSTGRES_DB");
export const APP_PG_CLIENT: InjectionToken<ReturnType<typeof postgres>> = Symbol("APP_PG_CLIENT");

const logger = LoggerService.forContext("DB");

container.register(APP_PG_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(ADMIN_CONFIG);
    return postgres(config.POSTGRES_DB_URI);
  })
});

container.register(POSTGRES_DB, {
  useFactory: instancePerContainerCachingFactory(c => {
    const client = c.resolve(APP_PG_CLIENT);
    return drizzle(client, { schema });
  })
});

export async function connectToDatabase(): Promise<void> {
  const client = container.resolve(APP_PG_CLIENT);
  logger.info("Connecting to database...");
  // Test the connection by running a simple query
  await client.unsafe("SELECT 1");
  logger.info("Database connection established.");
}

export { schema };
