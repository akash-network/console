import { executionMode, ExecutionMode } from "@src/shared/constants";
import { indexers } from "@src/indexers";
import { getGenesis } from "@src/chain/genesisImporter";
import { sequelize } from "./dbConnection";
import { activeChain } from "@akashnetwork/cloudmos-shared/chainDefinitions";
import { Day, Transaction } from "@akashnetwork/cloudmos-shared/dbSchemas/base";
import { Block, Message } from "@akashnetwork/cloudmos-shared/dbSchemas";
import { MonitoredValue } from "@akashnetwork/cloudmos-shared/dbSchemas/base/monitoredValue";

/**
 * Initiate database schema
 */
export const initDatabase = async () => {
  console.log(`Connecting to db (${sequelize.config.host}/${sequelize.config.database})...`);
  await sequelize.authenticate();
  console.log("Connection has been established successfully.");

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
      console.log("First time syncing, seeding from genesis file...");

      const genesis = await getGenesis();
      for (const indexer of indexers) {
        await indexer.seed(genesis);
      }
    }
  }
};
