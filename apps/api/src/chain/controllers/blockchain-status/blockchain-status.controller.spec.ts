import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BlockchainStatusService } from "../../services/blockchain-status/blockchain-status.service";
import { BlockchainStatusController } from "./blockchain-status.controller";

describe(BlockchainStatusController.name, () => {
  it("delegates to BlockchainStatusService and returns the result", async () => {
    const { controller, blockchainStatusService } = setup();
    blockchainStatusService.getStatus.mockResolvedValue({ isBlockchainReachable: true });

    const result = await controller.getStatus();

    expect(result).toEqual({ isBlockchainReachable: true });
  });

  function setup() {
    const blockchainStatusService = mock<BlockchainStatusService>();
    const controller = new BlockchainStatusController(blockchainStatusService);

    return { controller, blockchainStatusService };
  }
});
