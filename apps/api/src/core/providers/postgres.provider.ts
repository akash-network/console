import { DefaultLogger } from "drizzle-orm/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { container, inject } from "tsyringe";

import * as billingSchemas from "@src/billing/model-schemas";
import { config } from "@src/core/config";
import { LoggerService } from "@src/core/services/logger/logger.service";
import { PostgresLoggerService } from "@src/core/services/postgres-logger/postgres-logger.service";
import * as userSchemas from "@src/user/model-schemas";

const logger = new LoggerService({ context: "POSTGRES" });
const migrationClient = postgres(config.POSTGRES_DB_URI, { max: 1, onnotice: logger.info.bind(logger) });
const appClient = postgres(config.POSTGRES_DB_URI, { max: config.POSTGRES_MAX_CONNECTIONS, onnotice: logger.info.bind(logger) });

const schema = { ...userSchemas, ...billingSchemas };
const drizzleOptions = { logger: new DefaultLogger({ writer: new PostgresLoggerService() }), schema };

const pgMigrationDatabase = drizzle(migrationClient, drizzleOptions);
export const migratePG = () => migrate(pgMigrationDatabase, { migrationsFolder: config.DRIZZLE_MIGRATIONS_FOLDER });

const pgDatabase = drizzle(appClient, drizzleOptions);

export const POSTGRES_DB = "POSTGRES_DB";
container.register(POSTGRES_DB, { useValue: pgDatabase });

type TableName = keyof typeof schema;
const tableNames = Object.keys(schema) as TableName[];
tableNames.forEach(key => container.register(key, { useValue: schema[key] }));

export const InjectPgTable = (name: TableName) => inject(name);
export const InjectPg = () => inject(POSTGRES_DB);

export type ApiPgDatabase = typeof pgDatabase;
export type ApiPgTables = typeof schema;
export const resolveTable = <T extends TableName>(name: T) => container.resolve<ApiPgTables[T]>(name);

export const closeConnections = async () => await Promise.all([migrationClient.end(), appClient.end()]);
