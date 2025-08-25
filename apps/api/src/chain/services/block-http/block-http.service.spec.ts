import type { BlockHttpService } from "@akashnetwork/http-sdk";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";

import { BlockHttpService as BlockHttpServiceClass } from "./block-http.service";

describe("BlockHttpService", () => {
  describe("getCurrentHeight", () => {
    it("returns current height", async () => {
      const { service, blockHttpService } = setup();
      blockHttpService.getCurrentHeight.mockResolvedValue(12345);

      const result = await service.getCurrentHeight();

      expect(result).toBe(12345);
      expect(blockHttpService.getCurrentHeight).toHaveBeenCalled();
    });
  });

  function setup(input?: { blockHttpService?: MockProxy<BlockHttpService> }) {
    const blockHttpService = input?.blockHttpService ?? mock<BlockHttpService>();
    const service = new BlockHttpServiceClass(blockHttpService);

    return { blockHttpService, service };
  }
});
