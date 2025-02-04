import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { Block, Message } from "@akashnetwork/database/dbSchemas";
import { Day, Transaction, TransactionEvent, TransactionEventAttribute } from "@akashnetwork/database/dbSchemas/base";
import { MonitoredValue } from "@akashnetwork/database/dbSchemas/base/monitoredValue";

import { getGenesis } from "@src/chain/genesisImporter";
import { indexers } from "@src/indexers";
import { ExecutionMode, executionMode } from "@src/shared/constants";
import { sequelize } from "./dbConnection";

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
    await TransactionEventAttribute.drop({ cascade: true });
    await TransactionEvent.drop({ cascade: true });
    await Transaction.drop({ cascade: true });
    await Block.drop({ cascade: true });
  }

  await Block.sync();
  await Transaction.sync();
  await TransactionEvent.sync();
  await TransactionEventAttribute.sync();
  await Message.sync();
  await Day.sync();
  await MonitoredValue.sync();

  // Setting STATISTICS value here since it cannot be defined in the sequelize model
  await sequelize.query(`ALTER TABLE IF EXISTS public.transaction_event_attribute ALTER COLUMN transaction_event_id SET STATISTICS 1000;`);

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
