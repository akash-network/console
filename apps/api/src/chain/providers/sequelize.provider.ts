import { chainModels, userModels } from "@akashnetwork/database/dbSchemas";
import { Template, TemplateFavorite, UserSetting } from "@akashnetwork/database/dbSchemas/user";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import pg from "pg";
import { Transaction as DbTransaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import type { Disposable, InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { ChainConfigService } from "@src/chain/services/chain-config/chain-config.service";
import { DisposableRegistry } from "@src/core/lib/disposable-registry/disposable-registry";
import type { AppInitializer } from "@src/core/providers/app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { LoggerService } from "@src/core/providers/logging.provider";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { PostgresLoggerService } from "@src/core/services/postgres-logger/postgres-logger.service";

const SEQUELIZE_LOGGER = Symbol("SEQUELIZE_LOGGER") as InjectionToken<PostgresLoggerService>;
container.register(SEQUELIZE_LOGGER, {
  useFactory: instancePerContainerCachingFactory(c => {
    return new PostgresLoggerService({ orm: "sequelize", useFormat: c.resolve(CoreConfigService).get("SQL_LOG_FORMAT") === "pretty" });
  })
});

export const CHAIN_DB = Symbol("CHAIN_DB") as InjectionToken<Sequelize>;

pg.defaults.parseInt8 = true;
container.register(CHAIN_DB, {
  useFactory: instancePerContainerCachingFactory(c => {
    const logger = c.resolve(SEQUELIZE_LOGGER);
    const dbUri = c.resolve(ChainConfigService).get("CHAIN_INDEXER_POSTGRES_DB_URI");
    return new Sequelize(dbUri, {
      dialectModule: pg,
      logging: msg => logger.write(msg),
      logQueryParameters: true,
      transactionType: DbTransaction.TYPES.IMMEDIATE,
      define: { timestamps: false, freezeTableName: true },
      models: chainModels
    });
  })
});

export const USER_DB = Symbol("USER_DB") as InjectionToken<Sequelize>;

container.register(USER_DB, {
  useFactory: instancePerContainerCachingFactory(c => {
    const logger = c.resolve(SEQUELIZE_LOGGER);
    const dbUri = c.resolve(CoreConfigService).get("POSTGRES_DB_URI");
    return new Sequelize(dbUri, {
      dialectModule: pg,
      logging: msg => logger.write(msg),
      logQueryParameters: true,
      transactionType: DbTransaction.TYPES.IMMEDIATE,
      define: { timestamps: false, freezeTableName: true },
      models: userModels
    });
  })
});

async function syncUserSchema() {
  await UserSetting.sync();
  await Template.sync();
  await TemplateFavorite.sync();
}

container.register(APP_INITIALIZER, {
  useFactory: instancePerContainerCachingFactory(
    DisposableRegistry.registerFromFactory(
      c =>
        ({
          async [ON_APP_START]() {
            await connectUsingSequelize(c.resolve(LoggerService));
          },
          async dispose() {
            await Promise.all([c.resolve(CHAIN_DB).close(), c.resolve(USER_DB).close()]);
          }
        }) satisfies AppInitializer & Disposable
    )
  )
});

/**
 * Initialize database schema
 * Populate db
 * Create backups per version
 * Load from backup if exists for current version
 * @deprecated use `container.resolveAll(APP_INITIALIZER)` instead
 */
export async function connectUsingSequelize(logger = createOtelLogger({ context: "DB" })): Promise<void> {
  await Promise.all([authenticateDatabase(container.resolve(CHAIN_DB), logger), authenticateDatabase(container.resolve(USER_DB), logger)]);

  logger.debug("Sync user schema...");
  await syncUserSchema();
  logger.debug("User schema synced.");
}

async function authenticateDatabase(database: Sequelize, logger: LoggerService) {
  logger.debug(`Connecting to database (${database.config.host}/${database.config.database})...`);
  await database.authenticate();
  logger.debug("Connection has been established successfully.");
}
