import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { Block, Message } from "@akashnetwork/database/dbSchemas";
import { AkashMessage } from "@akashnetwork/database/dbSchemas/akash";
import { Transaction } from "@akashnetwork/database/dbSchemas/base";
import { LoggerService } from "@akashnetwork/logging";
import { fromBase64 } from "@cosmjs/encoding";
import { decodeTxRaw } from "@cosmjs/proto-signing";
import { sha256 } from "js-sha256";
import { Op, Transaction as DbTransaction } from "sequelize";

import { getCachedBlockByHeight } from "@src/chain/dataStore";
import { sequelize } from "@src/db/dbConnection";
import { activeIndexers, indexersMsgTypes } from "@src/indexers";
import { lastBlockToSync } from "@src/shared/constants";
import * as benchmark from "@src/shared/utils/benchmark";
import { decodeMsg } from "@src/shared/utils/protobuf";
import { setMissingBlock } from "./chainSync";
import { getGenesis } from "./genesisImporter";

const logger = LoggerService.forContext("StatsProcessor");

class StatsProcessor {
  private cacheInitialized: boolean = false;

  public async rebuildStatsTables() {
    logger.info('Setting "isProcessed" to false');
    await Message.update(
      {
        isProcessed: false,
        relatedDeploymentId: null
      },
      { where: { isProcessed: true } }
    );
    await Transaction.update(
      {
        isProcessed: false
      },
      { where: { isProcessed: true } }
    );
    await Block.update(
      {
        isProcessed: false
      },
      { where: { isProcessed: true } }
    );

    logger.info("Rebuilding stats tables...");

    for (const indexer of activeIndexers) {
      await indexer.recreateTables();

      if (!activeChain.startHeight) {
        const genesis = await getGenesis();
        await indexer.seed(genesis);
      }
    }

    console.time("Processing messages");
    await this.processMessages();
    console.timeEnd("Processing messages");
  }

  public async processMessages() {
    logger.info("Querying unprocessed messages...");

    const shouldProcessEveryBlocks = activeIndexers.some(indexer => indexer.runForEveryBlocks);

    const groupSize = 100;

    const previousBlockTimer = benchmark.startTimer("getPreviousProcessedBlock");
    let previousProcessedBlock = await Block.findOne({
      where: {
        isProcessed: true
      },
      order: [["height", "DESC"]]
    });
    previousBlockTimer.end();

    const maxDbHeight = (await Block.max("height")) as number;

    const hasNewBlocks = !previousProcessedBlock || maxDbHeight > previousProcessedBlock.height;

    if (!hasNewBlocks) {
      logger.info("No new blocks to process");
      return;
    }

    const firstUnprocessedHeight = !previousProcessedBlock ? activeChain.startHeight || 1 : previousProcessedBlock.height + 1;

    if (!this.cacheInitialized) {
      for (const indexer of activeIndexers) {
        await indexer.initCache(firstUnprocessedHeight);
      }
      this.cacheInitialized = true;
    }

    let firstBlockToProcess = firstUnprocessedHeight;
    let lastBlockToProcess = Math.min(maxDbHeight, firstBlockToProcess + groupSize, lastBlockToSync);
    while (firstBlockToProcess <= Math.min(maxDbHeight, lastBlockToSync)) {
      logger.info(`Loading blocks ${firstBlockToProcess} to ${lastBlockToProcess}`);

      const getBlocksTimer = benchmark.startTimer("getBlocks");
      const blocks = await Block.findAll({
        attributes: ["height"],
        where: {
          isProcessed: false,
          height: { [Op.gte]: firstBlockToProcess, [Op.lte]: lastBlockToProcess }
        },
        include: [
          {
            model: Transaction,
            required: false,
            where: {
              isProcessed: false
            },
            include: [
              {
                model: Message,
                required: false,
                where: {
                  isProcessed: false,
                  type: { [Op.in]: indexersMsgTypes }
                }
              }
            ]
          }
        ],
        order: [
          ["height", "ASC"],
          ["transactions", "index", "ASC"],
          ["transactions", "messages", "index", "ASC"]
        ]
      });
      getBlocksTimer.end();

      const blockGroupTransaction = await sequelize.transaction();

      try {
        for (const block of blocks) {
          const getBlockByHeightTimer = benchmark.startTimer("getBlockByHeight");
          const blockData = await getCachedBlockByHeight(block.height);
          getBlockByHeightTimer.end();

          if (!blockData) {
            setMissingBlock(block.height);
            throw new Error(`Block ${block.height} not found in cache`);
          }

          for (const transaction of block.transactions) {
            const decodeTimer = benchmark.startTimer("decodeTx");
            const tx = blockData.block.data.txs.find(t => sha256(Buffer.from(t, "base64")).toUpperCase() === transaction.hash);
            const decodedTx = decodeTxRaw(fromBase64(tx));
            decodeTimer.end();

            for (const msg of transaction.messages) {
              logger.info(`Processing message ${msg.type} - Block #${block.height}`);

              const encodedMessage = decodedTx.body.messages[msg.index].value;

              await benchmark.measureAsync("processMessage", async () => {
                await this.processMessage(msg, encodedMessage, block.height, blockGroupTransaction, transaction.hasProcessingError);
              });

              if ((msg as AkashMessage).relatedDeploymentId || msg.amount) {
                await benchmark.measureAsync("saveRelatedDeploymentId", async () => {
                  await msg.save({ transaction: blockGroupTransaction });
                });
              }
            }

            for (const indexer of activeIndexers) {
              await indexer.afterEveryTransaction(decodedTx, transaction, blockGroupTransaction);
            }

            await benchmark.measureAsync("saveTransaction", async () => {
              await transaction.save({ transaction: blockGroupTransaction });
            });
          }

          for (const indexer of activeIndexers) {
            await indexer.afterEveryBlock(block, previousProcessedBlock, blockGroupTransaction);
          }

          if (shouldProcessEveryBlocks) {
            await benchmark.measureAsync("blockUpdate", async () => {
              block.isProcessed = true;
              await block.save({ transaction: blockGroupTransaction });
            });
          }
          previousProcessedBlock = block;
        }

        if (!shouldProcessEveryBlocks) {
          await benchmark.measureAsync("blockUpdateIsProcessed", async () => {
            await Block.update(
              {
                isProcessed: true
              },
              {
                where: {
                  height: { [Op.gte]: firstBlockToProcess, [Op.lte]: lastBlockToProcess }
                },
                transaction: blockGroupTransaction
              }
            );
          });
        }

        await benchmark.measureAsync("transactionUpdate", async () => {
          await Transaction.update(
            {
              isProcessed: true
            },
            {
              where: {
                height: { [Op.gte]: firstBlockToProcess, [Op.lte]: lastBlockToProcess }
              },
              transaction: blockGroupTransaction
            }
          );
        });

        await benchmark.measureAsync("MsgUpdate", async () => {
          await Message.update(
            {
              isProcessed: true
            },
            {
              where: {
                height: { [Op.gte]: firstBlockToProcess, [Op.lte]: lastBlockToProcess }
              },
              transaction: blockGroupTransaction
            }
          );
        });

        await benchmark.measureAsync("blockGroupTransactionCommit", async () => {
          await blockGroupTransaction.commit();
        });
      } catch (err) {
        await blockGroupTransaction.rollback();
        throw err;
      }

      firstBlockToProcess += groupSize;
      lastBlockToProcess = Math.min(maxDbHeight, firstBlockToProcess + groupSize, lastBlockToSync);
    }
  }

  private async processMessage(msg, encodedMessage: Uint8Array, height: number, blockGroupTransaction: DbTransaction, hasProcessingError: boolean) {
    for (const indexer of activeIndexers) {
      if (indexer.hasHandlerForType(msg.type) && (!hasProcessingError || indexer.processFailedTxs)) {
        const decodedMessage = decodeMsg(msg.type, encodedMessage);
        await indexer.processMessage(decodedMessage, height, blockGroupTransaction, msg);
      }
    }
  }
}

export const statsProcessor = new StatsProcessor();
