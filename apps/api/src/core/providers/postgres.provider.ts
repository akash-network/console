import { LoggerService } from "@akashnetwork/logging";
import { DefaultLogger } from "drizzle-orm/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Disposable, InjectionToken } from "tsyringe";
import { container, inject } from "tsyringe";

import * as authSchemas from "@src/auth/model-schemas";
import * as billingSchemas from "@src/billing/model-schemas";
import { config } from "@src/core/config";
import { DisposableRegistry } from "@src/core/lib/disposable-registry/disposable-registry";
import { PostgresLoggerService } from "@src/core/services/postgres-logger/postgres-logger.service";
import * as deploymentSchemas from "@src/deployment/model-schemas";
import * as userSchemas from "@src/user/model-schemas";
import type { AppInitializer } from "./app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "./app-initializer";

const logger = LoggerService.forContext("POSTGRES");
const migrationClient = postgres(config.POSTGRES_DB_URI, { max: 1, onnotice: logger.info.bind(logger) });
const appClient = postgres(config.POSTGRES_DB_URI, { max: config.POSTGRES_MAX_CONNECTIONS, onnotice: logger.info.bind(logger) });

const schema = { ...userSchemas, ...billingSchemas, ...deploymentSchemas, ...authSchemas };
const drizzleOptions = { logger: new DefaultLogger({ writer: new PostgresLoggerService({ useFormat: config.SQL_LOG_FORMAT === "pretty" }) }), schema };

const pgMigrationDatabase = drizzle(migrationClient, drizzleOptions);
export const migratePG = () => migrate(pgMigrationDatabase, { migrationsFolder: config.DRIZZLE_MIGRATIONS_FOLDER });

const pgDatabase = drizzle(appClient, drizzleOptions);

export type DbHealthcheck = {
  ping(): Promise<void>;
};
export const DB_HEALTHCHECK: InjectionToken<DbHealthcheck> = "DB_HEALTHCHECK";
container.register(DB_HEALTHCHECK, {
  useValue: {
    async ping() {
      await appClient.unsafe("SELECT 1");
    }
  } satisfies DbHealthcheck
});

export const POSTGRES_DB: InjectionToken<ApiPgDatabase> = "POSTGRES_DB";
container.register(POSTGRES_DB, { useValue: pgDatabase });

type TableName = keyof typeof schema;
const tableNames = Object.keys(schema) as TableName[];
tableNames.forEach(key => container.register(key, { useValue: schema[key] }));

export const InjectPgTable = (name: TableName) => inject(name);
export const InjectPg = () => inject(POSTGRES_DB);

export type ApiPgDatabase = typeof pgDatabase;
export type ApiPgTables = typeof schema;
export const resolveTable = <T extends TableName>(name: T) => container.resolve<ApiPgTables[T]>(name);

export const closeConnections = async () => await Promise.all([migrationClient.end(), appClient.end()]).then(() => undefined);

container.register(APP_INITIALIZER, {
  useFactory: DisposableRegistry.registerFromFactory(
    () =>
      ({
        [ON_APP_START]: () => Promise.resolve(),
        dispose: closeConnections
      }) satisfies AppInitializer & Disposable
  )
});
