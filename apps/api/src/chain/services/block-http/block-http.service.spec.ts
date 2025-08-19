import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";

import type { BlockHttpServiceWrapper } from "@src/core/services/http-service-wrapper/http-service-wrapper";
import { BlockHttpService as BlockHttpServiceClass } from "./block-http.service";

describe("BlockHttpService", () => {
  describe("getCurrentHeight", () => {
    it("returns current height", async () => {
      const { service, blockHttpServiceWrapper } = setup();
      blockHttpServiceWrapper.getCurrentHeight.mockResolvedValue(12345);

      const result = await service.getCurrentHeight();

      expect(result).toBe(12345);
      expect(blockHttpServiceWrapper.getCurrentHeight).toHaveBeenCalled();
    });
  });

  function setup(input?: { blockHttpServiceWrapper?: MockProxy<BlockHttpServiceWrapper> }) {
    const blockHttpServiceWrapper = input?.blockHttpServiceWrapper ?? mock<BlockHttpServiceWrapper>();
    const service = new BlockHttpServiceClass(blockHttpServiceWrapper);

    return { blockHttpServiceWrapper, service };
  }
});
