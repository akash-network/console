import { PostgresLoggerService } from "@akashnetwork/logging/sql";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { APP_CONFIG } from "@src/providers/app-config.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { PG_CLIENT } from "@src/providers/postgres.provider";
import * as modelsSchema from "../model-schemas";

export const DRIZZLE_DB: InjectionToken<PostgresJsDatabase> = Symbol("DRIZZLE_DB");

container.register(DRIZZLE_DB, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(APP_CONFIG);
    return drizzle(c.resolve(PG_CLIENT), {
      logger: new PostgresLoggerService(c.resolve(LOGGER_FACTORY), { useFormat: config.SQL_LOG_FORMAT === "pretty" }),
      schema: modelsSchema
    });
  })
});
