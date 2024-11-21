import "@test/mocks/logger-service.mock";

import { BlockHttpService as BlockHttpServiceCommon } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";

import { BlockRepository } from "@src/chain/repositories/block.repository";
import { BlockHttpService } from "./block-http.service";

describe(BlockHttpService.name, () => {
  let service: BlockHttpService;
  let blockHttpService: BlockHttpServiceCommon;
  let blockRepository: BlockRepository;

  beforeEach(() => {
    blockHttpService = new BlockHttpServiceCommon();
    service = new BlockHttpService(blockHttpService, blockRepository);
  });

  it("should get current height", async () => {
    const height = faker.number.int({ min: 1000000, max: 10000000 });
    jest.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(height);
    const result = await service.getCurrentHeight();

    expect(result).toBe(height);
  });
});
