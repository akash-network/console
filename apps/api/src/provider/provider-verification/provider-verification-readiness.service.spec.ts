import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BlockRepository } from "@src/chain/repositories/block.repository";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ProviderVerificationReadinessService } from "./provider-verification-readiness.service";

describe(ProviderVerificationReadinessService.name, () => {
  it.each([
    { indexedHeight: 100, chainHeight: 100 },
    { indexedHeight: 100, chainHeight: 102 },
    { indexedHeight: 102, chainHeight: 100 }
  ])("is ready when the chain and processed index are within the configured height skew", async ({ indexedHeight, chainHeight }) => {
    const { service } = setup({ indexedHeight, chainHeight });

    await expect(service.isReady()).resolves.toBe(true);
  });

  it.each([
    { indexedHeight: 100, chainHeight: 103 },
    { indexedHeight: 0, chainHeight: 1 },
    { indexedHeight: 103, chainHeight: 100 }
  ])("fails closed when the processed index cannot represent the connected chain", async ({ indexedHeight, chainHeight }) => {
    const { service, logger } = setup({ indexedHeight, chainHeight });

    await expect(service.isReady()).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith({
      event: "PROVIDER_VERIFICATION_INDEXER_NOT_READY",
      chainHeight,
      indexedHeight,
      maxLag: 2
    });
  });

  it("fails closed when either height cannot be read", async () => {
    const error = new Error("chain unavailable");
    const { service, logger } = setup({ chainError: error });

    await expect(service.isReady()).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith({ event: "PROVIDER_VERIFICATION_READINESS_CHECK_FAILED", error });
  });
});

function setup(input: { indexedHeight?: number; chainHeight?: number; chainError?: Error } = {}) {
  const blockRepository = mock<BlockRepository>();
  const blockHttpService = mock<BlockHttpService>();
  const coreConfig = mock<CoreConfigService>();
  const logger = mock<LoggerService>();
  blockRepository.getLatestProcessedHeight.mockResolvedValue(input.indexedHeight ?? 100);
  if (input.chainError) {
    blockHttpService.getCurrentHeight.mockRejectedValue(input.chainError);
  } else {
    blockHttpService.getCurrentHeight.mockResolvedValue(input.chainHeight ?? 100);
  }
  coreConfig.get.calledWith("AEP86_PROVIDER_VERIFICATION_MAX_INDEXER_LAG_BLOCKS").mockReturnValue(2);

  return {
    service: new ProviderVerificationReadinessService(blockRepository, blockHttpService, coreConfig, () => logger),
    logger
  };
}
