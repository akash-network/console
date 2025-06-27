import { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import { addSeconds, differenceInSeconds } from "date-fns";
import assert from "http-assert";
import { singleton } from "tsyringe";

import {
  GetPredictedBlockDateParams,
  GetPredictedBlockDateResponse,
  GetPredictedDateHeightParams,
  GetPredictedDateHeightResponse,
  GetPredictionQuery
} from "@src/block/http-schemas/block-prediction.schema";
import { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";

@singleton()
export class BlockPredictionService {
  constructor(private readonly akashBlockRepository: AkashBlockRepository) {}

  async getPredictedBlockDate(
    height: GetPredictedBlockDateParams["height"],
    blockWindow: GetPredictionQuery["blockWindow"]
  ): Promise<GetPredictedBlockDateResponse> {
    const latestBlock = await this.getLatestBlock();
    assert(height > latestBlock.height, 400, "Height must be in the future");

    const averageBlockTime = await this.calculateAverageBlockTime(latestBlock, blockWindow);
    const heightDiff = height - latestBlock.height;

    return {
      predictedDate: addSeconds(latestBlock.datetime, heightDiff * averageBlockTime).toISOString(),
      height,
      blockWindow
    };
  }

  async getPredictedDateHeight(
    timestamp: GetPredictedDateHeightParams["timestamp"],
    blockWindow: GetPredictionQuery["blockWindow"]
  ): Promise<GetPredictedDateHeightResponse> {
    const date = new Date(timestamp * 1000);
    const latestBlock = await this.getLatestBlock();
    assert(date > latestBlock.datetime, 400, "Date must be in the future");

    const averageBlockTime = await this.calculateAverageBlockTime(latestBlock, blockWindow);
    const dateDiff = differenceInSeconds(date, latestBlock.datetime);

    return {
      predictedHeight: Math.floor(latestBlock.height + dateDiff / averageBlockTime),
      date: date.toISOString(),
      blockWindow
    };
  }

  private async getLatestBlock(): Promise<AkashBlock> {
    const latestBlock = await this.akashBlockRepository.getLatestBlock();
    assert(latestBlock, 404, "No blocks found");

    return latestBlock;
  }

  private async calculateAverageBlockTime(latestBlock: AkashBlock, blockCount: number) {
    assert(blockCount > 1, 400, "blockCount must be greater than 1");

    const earlierBlock = await this.akashBlockRepository.getBlockByHeight(Math.max(latestBlock.height - blockCount, 1));
    assert(earlierBlock, 500, `Cannot calculate average block time because there is no earlier block for ${latestBlock.height}`);

    const realBlockCount = latestBlock.height - earlierBlock.height;

    return differenceInSeconds(latestBlock.datetime, earlierBlock.datetime) / realBlockCount;
  }
}
