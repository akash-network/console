import { createOtelLogger } from "@akashnetwork/logging/otel";
import postgres from "postgres";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { parseJsonb, serializeJsonb } from "@src/lib/jsonb-bigint/jsonb-bigint";
import { APP_CONFIG } from "@src/providers/app-config.provider";

const logger = createOtelLogger({ context: "POSTGRES" });

const APP_PG_CLIENT = Symbol("APP_PG_CLIENT") as InjectionToken<postgres.Sql>;

container.register(APP_PG_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(APP_CONFIG);
    return postgres(config.PROVIDER_INVENTORY_POSTGRES_URL, {
      max: config.POSTGRES_MAX_CONNECTIONS,
      connect_timeout: config.POSTGRES_CONNECT_TIMEOUT,
      idle_timeout: config.POSTGRES_IDLE_TIMEOUT,
      max_lifetime: config.POSTGRES_MAX_LIFETIME,
      onnotice: logger.info.bind(logger),
      types: {
        bigint: postgres.BigInt,
        json: {
          to: 114, // OID 114 = json
          from: [114, 3802], // 114 = json, 3802 = jsonb
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
          await c.resolve(APP_PG_CLIENT).unsafe("SELECT 1");
        }
      }) satisfies DbHealthcheck
  )
});

export const PG_CLIENT = APP_PG_CLIENT;
