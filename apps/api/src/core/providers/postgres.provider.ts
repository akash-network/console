import { DefaultLogger } from "drizzle-orm/logger";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { container, inject } from "tsyringe";

import * as billingSchemas from "@src/billing/model-schemas";
import { config } from "@src/core/config";
import { PostgresLoggerService } from "@src/core/services/postgres-logger/postgres-logger.service";
import * as userSchemas from "@src/user/model-schemas";

const pool = new Pool({
  connectionString: config.POSTGRES_DB_URI
});

const schema = { ...userSchemas, ...billingSchemas };
export type ApiPgSchema = typeof schema;
export const pgDatabase = drizzle(pool, { logger: new DefaultLogger({ writer: new PostgresLoggerService() }), schema });

export const POSTGRES_DB = "POSTGRES_DB";
container.register(POSTGRES_DB, { useValue: pgDatabase });

export const InjectPg = () => inject(POSTGRES_DB);
export type ApiPgDatabase = typeof pgDatabase;
