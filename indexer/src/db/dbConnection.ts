import { defaults as pgDefaults } from "pg";
import { Transaction as DbTransaction } from "sequelize";
import { activeChain } from "@shared/chainDefinitions";
import { Sequelize } from "sequelize-typescript";
import { chainModels } from "@shared/dbSchemas";

pgDefaults.parseInt8 = true;
export const sequelize = new Sequelize(activeChain.connectionString, {
  dialect: "postgres",
  logging: false,
  transactionType: DbTransaction.TYPES.IMMEDIATE,
  define: {
    timestamps: false,
    freezeTableName: true
  },
  models: chainModels
});
