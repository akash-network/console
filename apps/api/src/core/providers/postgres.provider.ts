import { DefaultLogger } from "drizzle-orm/logger";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { container, inject } from "tsyringe";

import * as billingSchemas from "@src/billing/model-schemas";
import { config } from "@src/core/config";
import { PostgresLoggerService } from "@src/core/services/postgres-logger/postgres-logger.service";

const pool = new Pool({
  connectionString: config.POSTGRES_DB_URI
});

export const pgDatabase = drizzle(pool, { logger: new DefaultLogger({ writer: new PostgresLoggerService() }), schema: billingSchemas });

export type ApiPgSchema = typeof billingSchemas;

export const POSTGRES_DB = "POSTGRES_DB";
container.register(POSTGRES_DB, { useValue: pgDatabase });

export const InjectPg = () => inject(POSTGRES_DB);
export type ApiPgDatabase = typeof pgDatabase;
