import { defaults as pgDefaults } from "pg";
import { env } from "@src/utils/env";
import { Transaction as DbTransaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { chainModels, getChainModels, userModels } from "@shared/dbSchemas";
import { Template, TemplateFavorite, UserAddressName, UserSetting } from "@shared/dbSchemas/user";
import { chainDefinitions } from "@shared/chainDefinitions";

const csMap = {
  mainnet: env.AkashDatabaseCS,
  testnet: env.AkashTestnetDatabaseCS,
  sandbox: env.AkashSandboxDatabaseCS
};

if (!(env.Network in csMap)) {
  throw new Error(`Invalid network: ${env.Network}`);
}

if (!csMap[env.Network]) {
  throw new Error(`Missing connection string for network: ${env.Network}`);
}

pgDefaults.parseInt8 = true;
export const chainDb = new Sequelize(csMap[env.Network], {
  dialect: "postgres",
  logging: false,
  transactionType: DbTransaction.TYPES.IMMEDIATE,
  define: {
    timestamps: false,
    freezeTableName: true
  },
  models: chainModels
});

export const chainDbs: { [key: string]: Sequelize } = Object.keys(chainDefinitions)
  .filter((x) => chainDefinitions[x].connectionString)
  .reduce(
    (obj, chain) => ({
      ...obj,
      [chain]: new Sequelize(chainDefinitions[chain].connectionString, {
        dialect: "postgres",
        logging: false,
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
  dialect: "postgres",
  logging: false,
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
