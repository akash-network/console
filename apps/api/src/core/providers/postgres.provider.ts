import { DefaultLogger } from "drizzle-orm/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { container, inject } from "tsyringe";

import * as billingSchemas from "@src/billing/model-schemas";
import { config } from "@src/core/config";
import { LoggerService } from "@src/core/services/logger/logger.service";
import { PostgresLoggerService } from "@src/core/services/postgres-logger/postgres-logger.service";

const logger = new LoggerService({ context: "POSTGRES" });
const migrationClient = postgres(config.POSTGRES_DB_URI, { max: 1, onnotice: logger.info.bind(logger) });
const appClient = postgres(config.POSTGRES_DB_URI);

const drizzleOptions = { logger: new DefaultLogger({ writer: new PostgresLoggerService() }), schema: billingSchemas };

const pgMigrationDatabase = drizzle(migrationClient, drizzleOptions);
export const migratePG = () => migrate(pgMigrationDatabase, { migrationsFolder: "./drizzle" });

const pgDatabase = drizzle(appClient, drizzleOptions);

export const POSTGRES_DB = "POSTGRES_DB";
container.register(POSTGRES_DB, { useValue: pgDatabase });

export const InjectPg = () => inject(POSTGRES_DB);

export type ApiPgDatabase = typeof pgDatabase;
export type ApiPgSchema = typeof billingSchemas;
