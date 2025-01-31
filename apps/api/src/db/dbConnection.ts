import { chainModels, userModels } from "@akashnetwork/database/dbSchemas";
import { Template, TemplateFavorite, UserSetting } from "@akashnetwork/database/dbSchemas/user";
import pg from "pg";
import { Transaction as DbTransaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { container } from "tsyringe";

import { ChainConfigService } from "@src/chain/services/chain-config/chain-config.service";
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

export const closeConnections = async () => await Promise.all([chainDb.close(), userDb.close()]);
