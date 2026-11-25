import { PostgresLoggerService } from "@akashnetwork/logging/sql";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { setTimeout as sleep } from "node:timers/promises";
import postgres from "postgres";
import type { DependencyContainer, InjectionToken } from "tsyringe";
import { container, inject, instancePerContainerCachingFactory } from "tsyringe";

import * as activitySchemas from "@src/activity/model-schemas";
import * as affiliateSchemas from "@src/affiliate/model-schemas";
import * as authSchemas from "@src/auth/model-schemas";
import * as billingSchemas from "@src/billing/model-schemas";
import { DisposableRegistry } from "@src/core/lib/disposable-registry/disposable-registry";
import type { AppInitializer } from "@src/core/providers/app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import * as deploymentSchemas from "@src/deployment/model-schemas";
import * as feedbackSchemas from "@src/feedback/model-schemas";
import * as gpuSchemas from "@src/gpu/model-schemas";
import * as gpuWaitlistSchemas from "@src/gpu-waitlist/model-schemas";
import * as hardwareRequestSchemas from "@src/hardware-request/model-schemas";
import * as organizationSchemas from "@src/organization/model-schemas";
import * as secretSchemas from "@src/secret/model-schemas";
import * as templateMarketplaceSchemas from "@src/template-marketplace/model-schemas";
import * as userSchemas from "@src/user/model-schemas";
import * as workloadAbuseSchemas from "@src/workload-abuse/model-schemas";
import type { CoreConfig } from "./config.provider";
import { CORE_CONFIG } from "./config.provider";
import { LOGGER_FACTORY } from "./logging.provider";

const logger = container.resolve(LOGGER_FACTORY)({ context: "POSTGRES" });

/** Types each parameter from its JavaScript value as postgres.js v3 did, which every query here was written against, instead of leaving it to the server. */
const V3_PARAMETER_TYPING = { infer: true } as const;

const APP_PG_CLIENT = Symbol("appPgClient") as InjectionToken<postgres.Sql>;
container.register(APP_PG_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(CORE_CONFIG);
    const client = postgres(config.POSTGRES_DB_URI, {
      ...V3_PARAMETER_TYPING,
      max: config.POSTGRES_MAX_CONNECTIONS,
      connect_timeout: config.POSTGRES_CONNECT_TIMEOUT,
      idle_timeout: config.POSTGRES_IDLE_TIMEOUT,
      max_lifetime: config.POSTGRES_MAX_LIFETIME,
      ...(config.POSTGRES_PREPARE !== undefined && { prepare: config.POSTGRES_PREPARE }),
      onnotice: logger.info.bind(logger)
    });
    c.resolve(DisposableRegistry).register({ dispose: () => client.end() });
    return client;
  })
});

container.register(APP_INITIALIZER, {
  useFactory: instancePerContainerCachingFactory(c => {
    const client = c.resolve(APP_PG_CLIENT);
    const config = c.resolve(CORE_CONFIG);
    return {
      async [ON_APP_START]() {
        const warmCount = Math.min(config.POSTGRES_MAX_CONNECTIONS, 10);
        await Promise.all(Array.from({ length: warmCount }, () => client.unsafe("SELECT 1")));
        logger.info({ event: "PG_POOL_WARMED", connections: warmCount });
      }
    } satisfies AppInitializer;
  })
});

const schema = {
  ...userSchemas,
  ...billingSchemas,
  ...deploymentSchemas,
  ...authSchemas,
  ...secretSchemas,
  ...workloadAbuseSchemas,
  ...hardwareRequestSchemas,
  ...activitySchemas,
  ...organizationSchemas,
  ...feedbackSchemas,
  ...affiliateSchemas,
  ...gpuSchemas,
  ...gpuWaitlistSchemas,
  ...templateMarketplaceSchemas
};
const getDrizzleOptions = (config: Pick<CoreConfig, "SQL_LOG_FORMAT">) => ({
  logger: new PostgresLoggerService(container.resolve(LOGGER_FACTORY), { useFormat: config.SQL_LOG_FORMAT === "pretty" }),
  schema
});

/** Mainnet, sandbox and every CLI command migrate this one database on boot, so whoever comes second must wait rather than re-apply. */
export const MIGRATION_ADVISORY_LOCK_KEY = 5_377_032_119;

/** Their sum plus each attempt's lock_timeout must stay under the REST pod's ~95 s liveness budget. */
const MIGRATION_LOCK_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 15_000];

const LOCK_NOT_AVAILABLE = "55P03";

export async function migratePG(config: CoreConfig = container.resolve(CORE_CONFIG), options: { lockRetryDelaysMs?: number[] } = {}): Promise<void> {
  const migrationClient = postgres(config.POSTGRES_MIGRATION_DB_URI ?? config.POSTGRES_DB_URI, {
    ...V3_PARAMETER_TYPING,
    max: 1,
    onnotice: logger.info.bind(logger)
  });
  const pgMigrationDatabase = drizzle(migrationClient, getDrizzleOptions(config));
  /** Takes the lock per attempt because postgres.js silently reconnects, without the lock, a session that dropped during backoff. */
  const applyPendingMigrations = async () => {
    await migrationClient`SELECT pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`;
    return migrate(pgMigrationDatabase, { migrationsFolder: config.DRIZZLE_MIGRATIONS_FOLDER });
  };

  try {
    for (const delayMs of options.lockRetryDelaysMs ?? MIGRATION_LOCK_RETRY_DELAYS_MS) {
      try {
        return await applyPendingMigrations();
      } catch (error) {
        if (!isLockTimeout(error)) throw error;
        logger.warn({ event: "MIGRATION_LOCK_TIMEOUT_RETRY", delayMs, error });
        await sleep(delayMs);
      }
    }

    await applyPendingMigrations();
  } finally {
    await migrationClient.end();
  }
}

function isLockTimeout(error: unknown): boolean {
  return error instanceof Error && (("code" in error && error.code === LOCK_NOT_AVAILABLE) || isLockTimeout(error.cause));
}

const getPgDatabase = (c: DependencyContainer) => {
  return drizzle(c.resolve(APP_PG_CLIENT), getDrizzleOptions(c.resolve(CORE_CONFIG)));
};

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

export const POSTGRES_DB: InjectionToken<ApiPgDatabase> = Symbol("POSTGRES_DB");
container.register(POSTGRES_DB, {
  useFactory: instancePerContainerCachingFactory(getPgDatabase)
});

type TableName = keyof typeof schema;
export const API_PG_TABLE_NAMES = Object.keys(schema) as TableName[];
API_PG_TABLE_NAMES.forEach(key => container.register(key, { useValue: schema[key] }));

export const InjectPgTable = (name: TableName) => inject(name);
export const InjectPg = () => inject(POSTGRES_DB);

export type ApiPgDatabase = ReturnType<typeof getPgDatabase>;
export type ApiPgTables = typeof schema;
export const resolveTable = <T extends TableName>(name: T) => container.resolve<ApiPgTables[T]>(name);
