import { AkashBlock as Block, AkashMessage as Message } from "@akashnetwork/database/dbSchemas/akash";
import { Transaction, Validator } from "@akashnetwork/database/dbSchemas/base";
import { addSeconds, differenceInSeconds } from "date-fns";

export async function getBlocks(limit: number) {
  const _limit = Math.min(limit, 100);
  const blocks = await Block.findAll({
    order: [["height", "DESC"]],
    limit: _limit,
    include: [
      {
        model: Validator,
        as: "proposerValidator",
        required: true
      }
    ]
  });

  return blocks.map(block => ({
    height: block.height,
    proposer: {
      address: block.proposerValidator.accountAddress,
      operatorAddress: block.proposerValidator.operatorAddress,
      moniker: block.proposerValidator.moniker,
      avatarUrl: block.proposerValidator.keybaseAvatarUrl
    },
    transactionCount: block.txCount,
    totalTransactionCount: block.totalTxCount,
    datetime: block.datetime
  }));
}

export async function getBlock(height: number) {
  const block = await Block.findOne({
    where: {
      height: height
    },
    include: [
      {
        model: Transaction,
        include: [Message],
        order: ["index", "ASC"]
      },
      {
        model: Validator,
        as: "proposerValidator",
        required: true
      }
    ]
  });

  if (!block) return null;

  return {
    height: block.height,
    datetime: block.datetime,
    proposer: {
      operatorAddress: block.proposerValidator.operatorAddress,
      moniker: block.proposerValidator.moniker,
      avatarUrl: block.proposerValidator.keybaseAvatarUrl,
      address: block.proposerValidator.accountAddress
    },
    hash: block.hash,
    gasUsed: block.transactions.map(tx => tx.gasUsed).reduce((a, b) => a + b, 0),
    gasWanted: block.transactions.map(tx => tx.gasWanted).reduce((a, b) => a + b, 0),
    transactions: block.transactions.map(tx => ({
      hash: tx.hash,
      isSuccess: !tx.hasProcessingError,
      error: tx.hasProcessingError ? tx.log : null,
      fee: parseInt(tx.fee),
      datetime: block.datetime,
      messages: tx.messages.map(message => ({
        id: message.id,
        type: message.type,
        amount: parseInt(message.amount)
      }))
    }))
  };
}

/**
 * Calculate the estimated block time
 * @param latestBlock Block to calculate the average from
 * @param blockCount Block interval for calculating the average
 * @returns Average block time in seconds
 */
async function calculateAverageBlockTime(latestBlock: Block, blockCount: number) {
  if (blockCount <= 1) throw new Error("blockCount must be greater than 1");

  const earlierBlock = await Block.findOne({
    where: {
      height: Math.max(latestBlock.height - blockCount, 1)
    }
  });

  const realBlockCount = latestBlock.height - earlierBlock.height;

  return differenceInSeconds(latestBlock.datetime, earlierBlock.datetime) / realBlockCount;
}

/**
 * Get the predicted height at a given date
 * @param date Date to predict the height of
 * @param blockWindow Block interval for calculating the average
 * @returns Predicted height at the given date
 */
export async function getPredictedDateHeight(date: Date, blockWindow: number) {
  const latestBlock = await Block.findOne({ order: [["height", "DESC"]] });

  if (date <= latestBlock.datetime) throw new Error("Date must be in the future");

  const averageBlockTime = await calculateAverageBlockTime(latestBlock, blockWindow);

  const dateDiff = differenceInSeconds(date, latestBlock.datetime);

  return Math.floor(latestBlock.height + dateDiff / averageBlockTime);
}

/**
 * Get the predicted date at a given height
 * @param height Height to predict the date of
 * @param blockWindow Block window for calculating the average
 * @returns Predicted date at the given height
 */
export async function getPredictedBlockDate(height: number, blockWindow: number) {
  const latestBlock = await Block.findOne({ order: [["height", "DESC"]] });

  if (height <= latestBlock.height) throw new Error("Height must be in the future");

  const averageBlockTime = await calculateAverageBlockTime(latestBlock, blockWindow);

  const heightDiff = height - latestBlock.height;
  return addSeconds(latestBlock.datetime, heightDiff * averageBlockTime);
}
