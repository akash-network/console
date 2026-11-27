import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TxManagerService } from "@src/services/tx-manager/tx-manager.service";
import { HealthzController } from "./healthz.controller";

describe(HealthzController.name, () => {
  describe("getStatus", () => {
    it("reports ready once every funding wallet can be named", async () => {
      const { controller, txManagerService } = setup();

      await expect(controller.getStatus("readiness")).resolves.toEqual({ data: { status: "ok" } });

      expect(txManagerService.getFundingWalletAddresses).toHaveBeenCalledTimes(1);
    });

    it("answers 503 to a readiness check while a funding wallet key is unreachable", async () => {
      const cause = new Error("key service unavailable");
      const { controller, txManagerService } = setup();
      txManagerService.getFundingWalletAddresses.mockRejectedValue(cause);

      await expect(controller.getStatus("readiness")).rejects.toMatchObject({ status: 503, message: "A funding wallet key is unreachable", cause });
    });

    it("reports alive without asking for the funding wallets, so an unreachable key service does not restart the pod", async () => {
      const { controller, txManagerService } = setup();
      txManagerService.getFundingWalletAddresses.mockRejectedValue(new Error("key service unavailable"));

      await expect(controller.getStatus("liveness")).resolves.toEqual({ data: { status: "ok" } });

      expect(txManagerService.getFundingWalletAddresses).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const txManagerService = mock<TxManagerService>();
    txManagerService.getFundingWalletAddresses.mockResolvedValue(["akash1funding"]);

    return { controller: new HealthzController(txManagerService), txManagerService };
  }
});
