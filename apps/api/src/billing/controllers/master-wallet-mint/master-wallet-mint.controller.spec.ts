import { Ok } from "ts-results";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MasterWalletMintService } from "@src/billing/services/master-wallet-mint/master-wallet-mint.service";
import { MasterWalletMintController } from "./master-wallet-mint.controller";

describe(MasterWalletMintController.name, () => {
  describe("mint", () => {
    it("delegates to service and returns result", async () => {
      const { controller, masterWalletMintService } = setup();
      masterWalletMintService.mintExcessAkt.mockResolvedValue(Ok.EMPTY);

      const result = await controller.mint({ dryRun: false });

      expect(result).toEqual(Ok.EMPTY);
      expect(masterWalletMintService.mintExcessAkt).toHaveBeenCalledWith({ dryRun: false });
    });
  });

  function setup() {
    const masterWalletMintService = mock<MasterWalletMintService>();
    const controller = new MasterWalletMintController(masterWalletMintService);
    return { controller, masterWalletMintService };
  }
});
