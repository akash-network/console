import { singleton } from "tsyringe";

import {
  GetPredictedBlockDateParams,
  GetPredictedBlockDateResponse,
  GetPredictedDateHeightParams,
  GetPredictedDateHeightResponse,
  GetPredictionQuery
} from "@src/block/http-schemas/block-prediction.schema";
import { BlockPredictionService } from "@src/block/services/block-prediction/block-prediction.service";

@singleton()
export class BlockPredictionController {
  constructor(private readonly blockPredictionService: BlockPredictionService) {}

  async getPredictedBlockDate(
    height: GetPredictedBlockDateParams["height"],
    blockWindow: GetPredictionQuery["blockWindow"]
  ): Promise<GetPredictedBlockDateResponse> {
    return await this.blockPredictionService.getPredictedBlockDate(height, blockWindow);
  }

  async getPredictedDateHeight(
    timestamp: GetPredictedDateHeightParams["timestamp"],
    blockWindow: GetPredictionQuery["blockWindow"]
  ): Promise<GetPredictedDateHeightResponse> {
    return await this.blockPredictionService.getPredictedDateHeight(timestamp, blockWindow);
  }
}
