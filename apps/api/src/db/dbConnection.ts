import { chainModels, userModels } from "@akashnetwork/database/dbSchemas";
import { Template, TemplateFavorite, UserSetting } from "@akashnetwork/database/dbSchemas/user";
import pg from "pg";
import { Transaction as DbTransaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import type { Disposable } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { ChainConfigService } from "@src/chain/services/chain-config/chain-config.service";
import { LoggerService } from "@src/core";
import { DisposableRegistry } from "@src/core/lib/disposable-registry/disposable-registry";
import type { AppInitializer } from "@src/core/providers/app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { PostgresLoggerService } from "@src/core/services/postgres-logger/postgres-logger.service";

const indexerDbUri = container.resolve(ChainConfigService).get("CHAIN_INDEXER_POSTGRES_DB_URI");
const coreConfig = container.resolve(CoreConfigService);
const dbUri = coreConfig.get("POSTGRES_DB_URI");

const logger = new PostgresLoggerService({ orm: "sequelize", useFormat: coreConfig.get("SQL_LOG_FORMAT") === "pretty" });
const logging = (msg: string) => logger.write(msg);

pg.defaults.parseInt8 = true;
export const chainDb = new Sequelize(indexerDbUri, {
  dialectModule: pg,
  logging,
  logQueryParameters: true,
  transactionType: DbTransaction.TYPES.IMMEDIATE,
  define: {
    timestamps: false,
    freezeTableName: true
  },
  models: chainModels
});

export const userDb = new Sequelize(dbUri, {
  dialectModule: pg,
  logging,
  logQueryParameters: true,
  transactionType: DbTransaction.TYPES.IMMEDIATE,
  define: {
    timestamps: false,
    freezeTableName: true
  },
  models: userModels
});

export async function syncUserSchema() {
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
            await Promise.all([chainDb.close(), userDb.close()]);
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
 */
export async function connectUsingSequelize(logger: LoggerService = LoggerService.forContext("DB")): Promise<void> {
  logger.debug(`Connecting to chain database (${chainDb.config.host}/${chainDb.config.database})...`);
  await chainDb.authenticate();
  logger.debug("Connection has been established successfully.");

  logger.debug(`Connecting to user database (${userDb.config.host}/${userDb.config.database})...`);
  await userDb.authenticate();
  logger.debug("Connection has been established successfully.");

  logger.debug("Sync user schema...");
  await syncUserSchema();
  logger.debug("User schema synced.");
}
