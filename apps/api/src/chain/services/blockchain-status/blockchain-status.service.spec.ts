import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { CreateLogger } from "@src/core";
import { BlockchainStatusService } from "./blockchain-status.service";

describe(BlockchainStatusService.name, () => {
  it("reports the chain reachable at its latest height", async () => {
    const { service } = setup({ height: 1_234_567 });

    const result = await service.getStatus();

    expect(result).toEqual({ isBlockchainReachable: true, latestBlockHeight: 1_234_567 });
  });

  it("reports the chain unreachable without a height when the latest block cannot be read", async () => {
    const error = new Error("Connection refused");
    const { service, logger } = setup({ error });

    const result = await service.getStatus();

    expect(result).toEqual({ isBlockchainReachable: false, latestBlockHeight: null });
    expect(logger.warn).toHaveBeenCalledWith({ event: "BLOCKCHAIN_UNREACHABLE", error });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup({ height: 1 });

    expect(createLogger).toHaveBeenCalledWith({ context: BlockchainStatusService.name });
  });

  function setup(input: { height?: number; error?: Error }) {
    const blockHttpService = mock<BlockHttpService>({
      getCurrentHeight: vi.fn(async () => {
        if (input.error) throw input.error;
        return input.height ?? 0;
      })
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new BlockchainStatusService(blockHttpService, createLogger);

    return { service, blockHttpService, logger, createLogger };
  }
});
