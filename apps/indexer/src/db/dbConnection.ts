import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { chainModels } from "@akashnetwork/database/dbSchemas";
import pg from "pg";
import { Transaction as DbTransaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";

pg.defaults.parseInt8 = true;
export const sequelize = new Sequelize(activeChain.connectionString, {
  dialectModule: pg,
  logging: false,
  transactionType: DbTransaction.TYPES.IMMEDIATE,
  define: {
    timestamps: false,
    freezeTableName: true
  },
  models: chainModels
});
