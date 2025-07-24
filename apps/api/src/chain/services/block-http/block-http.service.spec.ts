import "@test/mocks/logger-service.mock";

import { BlockHttpService as BlockHttpServiceCommon } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import axios from "axios";

import { BlockHttpService } from "./block-http.service";

describe(BlockHttpService.name, () => {
  it("should get current height", async () => {
    const { height, blockHttpService } = setup();

    const result = await blockHttpService.getCurrentHeight();

    expect(result).toBe(height);
  });

  const setup = () => {
    const blockHttpServiceCommon = new BlockHttpServiceCommon(axios.create());
    const blockHttpService = new BlockHttpService(blockHttpServiceCommon);

    const height = faker.number.int({ min: 1000000, max: 10000000 });
    jest.spyOn(blockHttpServiceCommon, "getCurrentHeight").mockResolvedValue(height);

    return { height, blockHttpServiceCommon, blockHttpService };
  };
});
