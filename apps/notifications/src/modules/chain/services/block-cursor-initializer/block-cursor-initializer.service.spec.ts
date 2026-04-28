import type { StargateClient } from "@cosmjs/stargate";
import { faker } from "@faker-js/faker";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/common/services/logger/logger.service";
import type { ChainEventsConfig } from "@src/modules/chain/config";
import type { BlockCursorRepository } from "@src/modules/chain/repositories/block-cursor/block-cursor.repository";
import { BlockCursorInitializerService } from "./block-cursor-initializer.service";

describe(BlockCursorInitializerService.name, () => {
  it("initializes block cursor with current chain height", async () => {
    const { service, stargateClient, blockCursorRepository, height } = setup();

    stargateClient.getHeight.mockResolvedValue(height);

    await service.onModuleInit();

    expect(blockCursorRepository.ensureInitialized).toHaveBeenCalledWith(height);
    expect(blockCursorRepository.setBlockHeight).not.toHaveBeenCalled();
  });

  it("retries getHeight on transient failure", async () => {
    const { service, stargateClient, blockCursorRepository, height } = setup();

    stargateClient.getHeight.mockRejectedValueOnce(new Error("ECONNREFUSED")).mockRejectedValueOnce(new Error("ECONNREFUSED")).mockResolvedValue(height);

    await service.onModuleInit();

    expect(stargateClient.getHeight).toHaveBeenCalledTimes(3);
    expect(blockCursorRepository.ensureInitialized).toHaveBeenCalledWith(height);
  });

  it("throws when retries are exhausted", async () => {
    const { service, stargateClient } = setup();

    stargateClient.getHeight.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(service.onModuleInit()).rejects.toThrow("ECONNREFUSED");
  }, 15_000);

  it("resets cursor to current chain height when START_FROM_LATEST_BLOCK is true", async () => {
    const { service, stargateClient, blockCursorRepository, loggerService, height } = setup({ startFromLatestBlock: true });

    stargateClient.getHeight.mockResolvedValue(height);

    await service.onModuleInit();

    expect(blockCursorRepository.setBlockHeight).toHaveBeenCalledWith(height);
    expect(blockCursorRepository.ensureInitialized).not.toHaveBeenCalled();
    expect(loggerService.log).toHaveBeenCalledWith({ event: "BLOCK_CURSOR_RESET_TO_LATEST", height });
  });

  function setup(input?: { startFromLatestBlock?: boolean }) {
    const stargateClient = mock<StargateClient>();
    const blockCursorRepository = mock<BlockCursorRepository>();
    const loggerService = mock<LoggerService>();
    const configService = mock<ConfigService<ChainEventsConfig>>();

    configService.getOrThrow.mockImplementation((key: string) => {
      if (key === "chain.START_FROM_LATEST_BLOCK") return input?.startFromLatestBlock ?? false;
      throw new Error(`Unexpected config key: ${key}`);
    });

    const height = faker.number.int({ min: 1000, max: 9999999 });

    const service = new BlockCursorInitializerService(stargateClient, blockCursorRepository, loggerService, configService);

    return { service, stargateClient, blockCursorRepository, loggerService, configService, height };
  }
});
