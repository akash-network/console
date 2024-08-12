import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { Block, Message } from "@akashnetwork/database/dbSchemas";
import { Day, Transaction } from "@akashnetwork/database/dbSchemas/base";
import { fromBase64 } from "@cosmjs/encoding";
import { decodeTxRaw } from "@cosmjs/proto-signing";
import { asyncify, eachLimit } from "async";
import { differenceInSeconds, isEqual } from "date-fns";
import { sha256 } from "js-sha256";
import { Op } from "sequelize";
import * as uuid from "uuid";

import { sequelize } from "@src/db/dbConnection";
import { ExecutionMode, executionMode, isProd, lastBlockToSync } from "@src/shared/constants";
import { env } from "@src/shared/utils/env";
import * as benchmark from "../shared/utils/benchmark";
import {
  blockHeightToKey,
  blockResultsDb,
  blocksDb,
  deleteCache,
  getCachedBlockByHeight,
  getCachedBlockResultsByHeight,
  getLatestHeightInCache
} from "./dataStore";
import { nodeAccessor } from "./nodeAccessor";
import { statsProcessor } from "./statsProcessor";

export const setMissingBlock = (height: number) => (missingBlock = height);
let missingBlock: number;

export async function getSyncStatus() {
  const latestHeightInCacheRequest = getLatestHeightInCache();
  const latestHeightInDbRequest = Block.max("height") as Promise<number>;
  const latestProcessedHeightRequest = Block.max("height", { where: { isProcessed: true } }) as Promise<number>;
  const realLatestNotificationProcessedHeightRequest = Message.max("height", { where: { isNotificationProcessed: true } }) as Promise<number>;

  const [latestHeightInCache, latestHeightInDb, latestProcessedHeight, realLatestNotificationProcessedHeight] = await Promise.all([
    latestHeightInCacheRequest,
    latestHeightInDbRequest,
    latestProcessedHeightRequest,
    realLatestNotificationProcessedHeightRequest
  ]);

  const firstNotificationUnprocessedMessage = (
    await Message.findOne({
      include: [
        {
          model: Transaction,
          where: { hasProcessingError: false }
        }
      ],
      where: { isNotificationProcessed: false, height: { [Op.gte]: realLatestNotificationProcessedHeight ?? 0 } },
      order: [["height", "ASC"]]
    })
  )?.height;

  const latestDateInDb = latestHeightInDb ? (await Block.findOne({ where: { height: latestHeightInDb } })).datetime : null;
  const latestProcessedDateInDb = latestProcessedHeight ? (await Block.findOne({ where: { height: latestProcessedHeight } })).datetime : null;
  const latestNotificationProcessedHeight = firstNotificationUnprocessedMessage ? firstNotificationUnprocessedMessage - 1 : latestHeightInDb;
  const latestNotificationProcessedDateInDb =
    !activeChain.startHeight || latestNotificationProcessedHeight > activeChain.startHeight
      ? (await Block.findOne({ where: { height: latestNotificationProcessedHeight } })).datetime
      : null;

  return {
    latestHeightInCache,
    latestHeightInDb,
    latestDateInDb,
    isInsertLate: latestDateInDb && differenceInSeconds(new Date(), latestDateInDb) > 60,
    latestProcessedHeight,
    latestProcessedDateInDb,
    isProcessingLate: latestProcessedDateInDb && differenceInSeconds(new Date(), latestProcessedDateInDb) > 60,
    latestNotificationProcessedHeight,
    latestNotificationProcessedDateInDb,
    isNotificationProcessingLate: latestNotificationProcessedDateInDb && differenceInSeconds(new Date(), latestNotificationProcessedDateInDb) > 60
  };
}

export async function syncBlocks() {
  const latestAvailableHeight = await nodeAccessor.getLatestBlockHeight();
  let latestBlockToDownload = Math.min(lastBlockToSync, latestAvailableHeight);
  const latestInsertedHeight = ((await Block.max("height")) as number) || 0;
  const latestHeightInCache = await getLatestHeightInCache();

  if (latestHeightInCache >= latestBlockToDownload) {
    console.log("No blocks to download");
  } else {
    let startHeight = !env.KeepCache ? latestInsertedHeight + 1 : Math.max(latestHeightInCache, 1);

    // If database is empty
    if (latestInsertedHeight === 0) {
      console.log("Starting from scratch");
      startHeight = activeChain.startHeight || 1;
    }

    // If there was a missing block
    if (missingBlock) {
      startHeight = Math.min(missingBlock, latestBlockToDownload);
      missingBlock = null;
    }

    const maxDownloadGroupSize = 1_000;
    if (latestBlockToDownload - startHeight > maxDownloadGroupSize) {
      console.log("Limiting download to " + maxDownloadGroupSize + " blocks");
      latestBlockToDownload = startHeight + maxDownloadGroupSize;
    }

    console.log("Starting download at block #" + startHeight);
    console.log("Will end download at block #" + latestBlockToDownload);
    console.log(latestBlockToDownload - startHeight + 1 + " blocks to download");

    await benchmark.measureAsync("downloadBlocks", async () => {
      await downloadBlocks(startHeight, latestBlockToDownload);
    });
  }

  await benchmark.measureAsync("insertBlocks", async () => {
    if (executionMode === ExecutionMode.RebuildAll) {
      await sequelize.query("DROP INDEX message_height");

      if (env.ActiveChain === "akash") {
        await sequelize.query("DROP INDEX message_related_deployment_id");
      }

      await sequelize.query("DROP INDEX message_tx_id");
      await sequelize.query("DROP INDEX message_tx_id_is_processed");
    }

    const latestHeightInDb = ((await Block.max("height")) as number) || activeChain.startHeight || 0;
    await insertBlocks(latestHeightInDb + 1, latestBlockToDownload);

    if (executionMode === ExecutionMode.RebuildAll) {
      await benchmark.measureAsync("Add indexes", async () => {
        await Message.sync();
      });
    }
  });

  benchmark.displayTimes();

  await benchmark.measureAsync("processMessages", async () => {
    await statsProcessor.processMessages();
  });

  benchmark.displayTimes();

  if (!env.KeepCache) {
    await deleteCache();
  }
}

async function insertBlocks(startHeight: number, endHeight: number) {
  const blockCount = endHeight - startHeight + 1;
  console.log("Inserting " + blockCount + " blocks into database");

  let lastInsertedBlock = (await Block.findOne({
    include: [
      {
        model: Day,
        required: true
      }
    ],
    order: [["height", "DESC"]]
  })) as any;

  let blocksToAdd = [];
  let txsToAdd = [];
  let msgsToAdd = [];

  for (let i = startHeight; i <= endHeight; ++i) {
    const getCachedBlockTimer = benchmark.startTimer("getCachedBlockByHeight");
    const blockData = await getCachedBlockByHeight(i);
    getCachedBlockTimer.end();

    if (!blockData) {
      missingBlock = i;
      throw "Block # " + i + " was not in cache";
    }

    let msgIndexInBlock = 0;
    const blockDatetime = new Date(blockData.block.header.time);

    const txs = blockData.block.data.txs;
    let blockResults = null;

    if (txs.length > 0) {
      blockResults = await getCachedBlockResultsByHeight(i);
      if (!blockResults) throw "Block results # " + i + " was not in cache";
    }

    for (let txIndex = 0; txIndex < txs.length; ++txIndex) {
      const tx = txs[txIndex];
      const hash = sha256(Buffer.from(tx, "base64")).toUpperCase();
      const txId = uuid.v4();

      const decodedTx = decodeTxRaw(fromBase64(tx));
      const msgs = decodedTx.body.messages;

      for (let msgIndex = 0; msgIndex < msgs.length; ++msgIndex) {
        const msg = msgs[msgIndex];

        msgsToAdd.push({
          id: uuid.v4(),
          txId: txId,
          type: msg.typeUrl,
          typeCategory: msg.typeUrl.split(".")[0].substring(1),
          index: msgIndex,
          height: i,
          indexInBlock: msgIndexInBlock++,
          data: Buffer.from(msg.value)
        });
      }

      const txJson = blockResults.txs_results[txIndex];

      txsToAdd.push({
        id: txId,
        hash: hash,
        height: i,
        msgCount: msgs.length,
        index: txIndex,
        fee: decodedTx.authInfo.fee.amount.length > 0 ? decodedTx.authInfo.fee.amount[0].amount : "0",
        memo: decodedTx.body.memo,
        hasProcessingError: !!txJson.code,
        log: txJson.code ? txJson.log : null,
        gasUsed: parseInt(txJson.gas_used),
        gasWanted: parseInt(txJson.gas_wanted)
      });
    }

    const blockEntry = {
      height: i,
      datetime: new Date(blockData.block.header.time),
      hash: blockData.block_id.hash,
      proposer: blockData.block.header.proposer_address,
      totalTxCount: (lastInsertedBlock?.totalTxCount || 0) + txs.length,
      dayId: lastInsertedBlock?.dayId,
      day: lastInsertedBlock?.day,
      txCount: txs.length
    };

    const blockDate = new Date(Date.UTC(blockDatetime.getUTCFullYear(), blockDatetime.getUTCMonth(), blockDatetime.getUTCDate()));

    if (!lastInsertedBlock || !isEqual(blockDate, lastInsertedBlock.day.date)) {
      console.log("Creating day: ", blockDate, i);
      const [newDay, created] = await Day.findOrCreate({
        where: {
          date: blockDate
        },
        defaults: {
          id: uuid.v4(),
          date: blockDate,
          firstBlockHeight: i,
          lastBlockHeightYet: i
        }
      });

      if (!created) {
        console.warn(`Day ${blockDate} already exists in database`);
      }

      blockEntry.dayId = newDay.id;
      blockEntry.day = newDay;

      if (lastInsertedBlock) {
        lastInsertedBlock.day.lastBlockHeight = lastInsertedBlock.height;
        lastInsertedBlock.day.lastBlockHeightYet = lastInsertedBlock.height;
        await lastInsertedBlock.day.save();
      }
    }
    lastInsertedBlock = blockEntry;

    blocksToAdd.push(blockEntry);

    if (blocksToAdd.length >= 500 || i === endHeight) {
      try {
        await sequelize.transaction(async insertDbTransaction => {
          await benchmark.measureAsync("createBlocks", async () => {
            await Block.bulkCreate(blocksToAdd, { transaction: insertDbTransaction });
          });
          await benchmark.measureAsync("createTransactions", async () => {
            await Transaction.bulkCreate(txsToAdd, { transaction: insertDbTransaction });
          });
          await benchmark.measureAsync("createmessages", async () => {
            await Message.bulkCreate(msgsToAdd, { transaction: insertDbTransaction });
          });
          blocksToAdd = [];
          txsToAdd = [];
          msgsToAdd = [];
          console.log(`Blocks added to db: ${i - startHeight + 1} / ${blockCount} (${(((i - startHeight + 1) * 100) / blockCount).toFixed(2)}%)`);

          if (lastInsertedBlock) {
            lastInsertedBlock.day.lastBlockHeightYet = lastInsertedBlock.height;
            await lastInsertedBlock.day.save({ transaction: insertDbTransaction });
          }
        });
      } catch (error) {
        console.log(error, txsToAdd);
      }
    }
  }
}

async function downloadBlocks(startHeight: number, endHeight: number) {
  const missingBlockCount = endHeight - startHeight + 1;

  let lastLogDate = Date.now();
  let downloadedCount = 0;
  const blockArr = Array.from(Array(missingBlockCount), (_, i) => i + startHeight);

  await eachLimit(
    blockArr,
    100,
    asyncify(async (height: number) => {
      await downloadBlock(height);

      downloadedCount++;

      if (Date.now() - lastLogDate > 500) {
        lastLogDate = Date.now();
        console.clear();
        console.log("Progress: " + ((downloadedCount * 100) / missingBlockCount).toFixed(2) + "%");

        if (!isProd) {
          nodeAccessor.displayTable();
        }
      }
    })
  );
}

async function downloadBlock(height: number) {
  let wasInCache = true;
  let blockJson = await getCachedBlockByHeight(height);

  if (!blockJson) {
    wasInCache = false;
    const responseJson = await nodeAccessor.getBlock(height);
    blockJson = responseJson.result;
  }

  if (blockJson.block.data.txs.length > 0) {
    const cachedBlockResult = await getCachedBlockResultsByHeight(height);

    if (!cachedBlockResult) {
      const blockResultJson = await nodeAccessor.getBlockResult(height);
      await blockResultsDb.put(blockHeightToKey(height), JSON.stringify(blockResultJson.result));
    }
  }

  if (!wasInCache) {
    await blocksDb.put(blockHeightToKey(height), JSON.stringify(blockJson));
  }
}
