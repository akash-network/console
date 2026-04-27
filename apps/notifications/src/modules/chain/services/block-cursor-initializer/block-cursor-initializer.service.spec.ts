import type { StargateClient } from "@cosmjs/stargate";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/common/services/logger/logger.service";
import type { BlockCursorRepository } from "@src/modules/chain/repositories/block-cursor/block-cursor.repository";
import { BlockCursorInitializerService } from "./block-cursor-initializer.service";

describe(BlockCursorInitializerService.name, () => {
  it("initializes block cursor with current chain height", async () => {
    const { service, stargateClient, blockCursorRepository, height } = setup();

    stargateClient.getHeight.mockResolvedValue(height);

    await service.onModuleInit();

    expect(blockCursorRepository.ensureInitialized).toHaveBeenCalledWith(height);
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

  function setup() {
    const stargateClient = mock<StargateClient>();
    const blockCursorRepository = mock<BlockCursorRepository>();
    const loggerService = mock<LoggerService>();

    const height = faker.number.int({ min: 1000, max: 9999999 });

    const service = new BlockCursorInitializerService(stargateClient, blockCursorRepository, loggerService);

    return { service, stargateClient, blockCursorRepository, loggerService, height };
  }
});
