import { PostgresLoggerService } from "@akashnetwork/logging/sql";
import postgres from "postgres";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { parseJsonb, serializeJsonb } from "@src/lib/jsonb-bigint/jsonb-bigint";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { LOGGER_FACTORY } from "./logger-factory.provider";

// The runtime client registers `postgres.BigInt` (see postgres.provider), so bigint params
// are serialized correctly; reflect that in the type so bigint criteria can be bound directly.
export type Database = postgres.Sql<{ bigint: bigint }>;
export const PG_CLIENT = Symbol("APP_PG_CLIENT") as InjectionToken<Database>;

export const DB_LOGGER = Symbol("DB_LOGGER") as InjectionToken<PostgresLoggerService>;

container.register(DB_LOGGER, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(APP_CONFIG);
    return new PostgresLoggerService(c.resolve(LOGGER_FACTORY), { useFormat: config.SQL_LOG_FORMAT === "pretty" });
  })
});

// json (OID 114) and jsonb (OID 3802). drizzle's construct() overrides the serializers for both
// with a passthrough on the shared client, expecting column types to own serialization.
export const JSON_OIDS = [114, 3802];

container.register(PG_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(APP_CONFIG);
    const logger = c.resolve(DB_LOGGER);
    return postgres(config.PROVIDER_INVENTORY_POSTGRES_URL, {
      max: config.POSTGRES_MAX_CONNECTIONS,
      connect_timeout: config.POSTGRES_CONNECT_TIMEOUT,
      idle_timeout: config.POSTGRES_IDLE_TIMEOUT,
      max_lifetime: config.POSTGRES_MAX_LIFETIME,
      onnotice: msg => logger.logNotice(msg),
      debug: (_, query, params) => logger.logQuery(query, params),
      types: {
        bigint: postgres.BigInt,
        json: {
          to: 114,
          from: JSON_OIDS,
          serialize: serializeJsonb,
          parse: parseJsonb
        }
      }
    });
  })
});

export type DbHealthcheck = {
  ping(): Promise<void>;
};

export const DB_HEALTHCHECK: InjectionToken<DbHealthcheck> = Symbol("DB_HEALTHCHECK");

container.register(DB_HEALTHCHECK, {
  useFactory: instancePerContainerCachingFactory(
    c =>
      ({
        async ping() {
          await c.resolve(PG_CLIENT).unsafe("SELECT 1");
        }
      }) satisfies DbHealthcheck
  )
});
