import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { Block, Message } from "@akashnetwork/database/dbSchemas";
import { Day, Transaction } from "@akashnetwork/database/dbSchemas/base";
import { MonitoredValue } from "@akashnetwork/database/dbSchemas/base/monitoredValue";
import { LoggerService } from "@akashnetwork/logging";

import { getGenesis } from "@src/chain/genesisImporter";
import { indexers } from "@src/indexers";
import { ExecutionMode, executionMode } from "@src/shared/constants";
import { sequelize } from "./dbConnection";

const logger = LoggerService.forContext("BuildDatabase");

/**
 * Initiate database schema
 */
export const initDatabase = async () => {
  logger.info(`Connecting to db (${sequelize.config.host}/${sequelize.config.database})...`);
  await sequelize.authenticate();
  logger.info("Connection has been established successfully.");

  if (executionMode === ExecutionMode.RebuildAll) {
    await Day.drop({ cascade: true });
    await Message.drop({ cascade: true });
    await Transaction.drop({ cascade: true });
    await Block.drop({ cascade: true });
  }

  await Block.sync();
  await Transaction.sync();
  await Message.sync();
  await Day.sync();
  await MonitoredValue.sync();

  for (const indexer of indexers) {
    if (executionMode === ExecutionMode.RebuildAll) {
      await indexer.recreateTables();
    } else {
      await indexer.createTables();
    }
  }

  // If we are syncing from the first block and this is the first time syncing, seed the database with the genesis file
  if (!activeChain.startHeight) {
    const firstBlock = await Block.findOne();
    if (!firstBlock) {
      logger.info("First time syncing, seeding from genesis file...");

      const genesis = await getGenesis();
      for (const indexer of indexers) {
        await indexer.seed(genesis);
      }
    }
  }
};
