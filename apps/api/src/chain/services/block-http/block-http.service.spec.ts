import "@test/mocks/logger-service.mock";

import type { BlockHttpService as BlockHttpServiceCommon } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import { BlockHttpService } from "./block-http.service";

describe(BlockHttpService.name, () => {
  it("should get current height", async () => {
    const { blockHttpService, service } = setup();
    const height = faker.number.int({ min: 1000000, max: 10000000 });
    jest.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(height);
    const result = await service.getCurrentHeight();

    expect(result).toBe(height);
  });

  function setup() {
    const blockHttpService = mock<BlockHttpServiceCommon>();
    const service = new BlockHttpService(blockHttpService);
    return { blockHttpService, service };
  }
});
