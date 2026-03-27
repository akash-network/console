import { Ok } from "ts-results";
import { mock } from "vitest-mock-extended";

import type { MasterWalletMintService } from "@src/billing/services/master-wallet-mint/master-wallet-mint.service";
import { MasterWalletMintController } from "./master-wallet-mint.controller";

describe(MasterWalletMintController.name, () => {
  describe("mint", () => {
    it("should delegate to service and return result", async () => {
      const { controller, masterWalletMintService } = setup();
      masterWalletMintService.mintIfNeeded.mockResolvedValue(Ok.EMPTY);

      const result = await controller.mint({ dryRun: false });

      expect(result).toEqual(Ok.EMPTY);
      expect(masterWalletMintService.mintIfNeeded).toHaveBeenCalledWith({ dryRun: false });
    });
  });

  function setup() {
    const masterWalletMintService = mock<MasterWalletMintService>();
    const controller = new MasterWalletMintController(masterWalletMintService);
    return { controller, masterWalletMintService };
  }
});
