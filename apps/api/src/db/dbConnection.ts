import { chainDefinitions } from "@akashnetwork/database/chainDefinitions";
import { chainModels, getChainModels, userModels } from "@akashnetwork/database/dbSchemas";
import { Template, TemplateFavorite, UserAddressName, UserSetting } from "@akashnetwork/database/dbSchemas/user";
import pg from "pg";
import { Transaction as DbTransaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";

import { PostgresLoggerService } from "@src/core/services/postgres-logger/postgres-logger.service";
import { env } from "@src/utils/env";

function isValidNetwork(network: string): network is keyof typeof csMap {
  return network in csMap;
}

const csMap = {
  mainnet: env.AkashDatabaseCS,
  testnet: env.AkashTestnetDatabaseCS,
  sandbox: env.AkashSandboxDatabaseCS
};

if (!isValidNetwork(env.Network)) {
  throw new Error(`Invalid network: ${env.Network}`);
}

if (!csMap[env.Network]) {
  throw new Error(`Missing connection string for network: ${env.Network}`);
}

const logger = new PostgresLoggerService({ orm: "sequelize" });

pg.defaults.parseInt8 = true;
export const chainDb = new Sequelize(csMap[env.Network], {
  dialectModule: pg,
  logging: (msg: string) => logger.write(msg),
  transactionType: DbTransaction.TYPES.IMMEDIATE,
  define: {
    timestamps: false,
    freezeTableName: true
  },
  models: chainModels
});

export const chainDbs: { [key: string]: Sequelize } = Object.keys(chainDefinitions)
  .filter(x => chainDefinitions[x].connectionString)
  .reduce(
    (obj, chain) => ({
      ...obj,
      [chain]: new Sequelize(chainDefinitions[chain].connectionString, {
        dialectModule: pg,
        logging: (msg: string) => logger.write(msg),
        repositoryMode: true,
        transactionType: DbTransaction.TYPES.IMMEDIATE,
        define: {
          timestamps: false,
          freezeTableName: true
        },
        models: getChainModels(chain)
      })
    }),
    {}
  );

export const userDb = new Sequelize(env.UserDatabaseCS, {
  dialectModule: pg,
  logging: (msg: string) => logger.write(msg),
  transactionType: DbTransaction.TYPES.IMMEDIATE,
  define: {
    timestamps: false,
    freezeTableName: true
  },
  models: userModels
});

export async function syncUserSchema() {
  await UserSetting.sync();
  await UserAddressName.sync();
  await Template.sync();
  await TemplateFavorite.sync();
}

export const closeConnections = async () => await Promise.all([chainDb.close(), userDb.close(), ...Object.values(chainDbs).map(db => db.close())]);
