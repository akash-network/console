import { LoggerService } from "@akashnetwork/logging";
import { DefaultLogger } from "drizzle-orm/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { DependencyContainer, InjectionToken } from "tsyringe";
import { container, inject, instancePerContainerCachingFactory } from "tsyringe";

import * as authSchemas from "@src/auth/model-schemas";
import * as billingSchemas from "@src/billing/model-schemas";
import { DisposableRegistry } from "@src/core/lib/disposable-registry/disposable-registry";
import { PostgresLoggerService } from "@src/core/services/postgres-logger/postgres-logger.service";
import * as deploymentSchemas from "@src/deployment/model-schemas";
import * as userSchemas from "@src/user/model-schemas";
import type { CoreConfig } from "./config.provider";
import { CORE_CONFIG } from "./config.provider";

const logger = LoggerService.forContext("POSTGRES");

const APP_PG_CLIENT = Symbol("appPgClient") as InjectionToken<postgres.Sql>;
container.register(APP_PG_CLIENT, {
  useFactory: instancePerContainerCachingFactory(
    DisposableRegistry.registerFromFactory(c => {
      const config = c.resolve(CORE_CONFIG);
      return postgres(config.POSTGRES_DB_URI, { max: config.POSTGRES_MAX_CONNECTIONS, onnotice: logger.info.bind(logger) });
    })
  )
});

const schema = { ...userSchemas, ...billingSchemas, ...deploymentSchemas, ...authSchemas };
const getDrizzleOptions = (config: Pick<CoreConfig, "SQL_LOG_FORMAT">) => ({
  logger: new DefaultLogger({ writer: new PostgresLoggerService({ useFormat: config.SQL_LOG_FORMAT === "pretty" }) }),
  schema
});

export async function migratePG(): Promise<void> {
  const config = container.resolve(CORE_CONFIG);
  const migrationClient = postgres(config.POSTGRES_DB_URI, { max: 1, onnotice: logger.info.bind(logger) });
  const pgMigrationDatabase = drizzle(migrationClient, getDrizzleOptions(config));

  try {
    await migrate(pgMigrationDatabase, { migrationsFolder: config.DRIZZLE_MIGRATIONS_FOLDER });
  } finally {
    await migrationClient.end();
  }
}

const getPgDatabase = (c: DependencyContainer) => {
  return drizzle(c.resolve(APP_PG_CLIENT), getDrizzleOptions(c.resolve(CORE_CONFIG)));
};

export type DbHealthcheck = {
  ping(): Promise<void>;
};
export const DB_HEALTHCHECK: InjectionToken<DbHealthcheck> = "DB_HEALTHCHECK";
container.register(DB_HEALTHCHECK, {
  useFactory: instancePerContainerCachingFactory(
    c =>
      ({
        async ping() {
          await c.resolve(APP_PG_CLIENT).unsafe("SELECT 1");
        }
      }) satisfies DbHealthcheck
  )
});

export const POSTGRES_DB: InjectionToken<ApiPgDatabase> = "POSTGRES_DB";
container.register(POSTGRES_DB, {
  useFactory: instancePerContainerCachingFactory(getPgDatabase)
});

type TableName = keyof typeof schema;
const tableNames = Object.keys(schema) as TableName[];
tableNames.forEach(key => container.register(key, { useValue: schema[key] }));

export const InjectPgTable = (name: TableName) => inject(name);
export const InjectPg = () => inject(POSTGRES_DB);

export type ApiPgDatabase = ReturnType<typeof getPgDatabase>;
export type ApiPgTables = typeof schema;
export const resolveTable = <T extends TableName>(name: T) => container.resolve<ApiPgTables[T]>(name);
