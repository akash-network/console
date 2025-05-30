import { AkashBlock as Block } from "@akashnetwork/database/dbSchemas/akash";
import { addSeconds, differenceInSeconds } from "date-fns";

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
  if (!earlierBlock) {
    throw new Error(`Cannot calculate average block time because there is no earlier block for ${latestBlock.height}`);
  }

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

  if (!latestBlock) throw new Error("No blocks found");
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

  if (!latestBlock) throw new Error("No blocks found");
  if (height <= latestBlock.height) throw new Error("Height must be in the future");

  const averageBlockTime = await calculateAverageBlockTime(latestBlock, blockWindow);

  const heightDiff = height - latestBlock.height;
  return addSeconds(latestBlock.datetime, heightDiff * averageBlockTime);
}
