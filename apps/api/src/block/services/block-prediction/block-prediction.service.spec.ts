import type { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import { addSeconds, subSeconds } from "date-fns";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";
import { BlockPredictionService } from "./block-prediction.service";

describe(BlockPredictionService.name, () => {
  describe("getPredictedBlockDate", () => {
    it("predicts the date from the average block time over the window", async () => {
      const { service, latestBlock } = setup({ secondsPerBlock: 6 });

      const result = await service.getPredictedBlockDate(latestBlock.height + 10, 100);

      expect(result).toEqual({
        predictedDate: addSeconds(latestBlock.datetime, 60).toISOString(),
        height: latestBlock.height + 10,
        blockWindow: 100
      });
    });

    it("answers 400 when the height is too far in the future to predict a date", async () => {
      const { service } = setup({ secondsPerBlock: 6 });

      await expect(service.getPredictedBlockDate(Number.MAX_SAFE_INTEGER, 100)).rejects.toMatchObject({
        status: 400,
        message: "Height is too far in the future"
      });
    });
  });

  function setup(input: { secondsPerBlock: number }) {
    const latestBlock = mock<AkashBlock>({ height: 1000, datetime: new Date("2026-10-13T12:00:00.000Z") });
    const earlierBlock = mock<AkashBlock>({ height: 900, datetime: subSeconds(latestBlock.datetime, 100 * input.secondsPerBlock) });
    const akashBlockRepository = mock<AkashBlockRepository>({
      getLatestBlock: async () => latestBlock,
      getBlockByHeight: async () => earlierBlock
    });
    const service = new BlockPredictionService(akashBlockRepository);

    return { service, latestBlock };
  }
});
