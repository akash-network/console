import type { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { CloseWalletDeploymentsService } from "./close-wallet-deployments.service";

import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createInitializedUserWallet, createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(CloseWalletDeploymentsService.name, () => {
  describe("closeAllOf", () => {
    it("closes each active deployment of the wallet as the console, with no reason, and returns their dseqs", async () => {
      const { service, wallet, deploymentHttpService, deploymentWriterService } = setup({ openDseqs: ["11", "22"] });

      const closed = await service.closeAllOf(wallet);

      expect(closed).toEqual(["11", "22"]);
      expect(deploymentHttpService.findAll).toHaveBeenCalledWith({ owner: wallet.address, state: "active" });
      expect(deploymentWriterService.close).toHaveBeenCalledTimes(2);
      expect(deploymentWriterService.close).toHaveBeenCalledWith(wallet, "11", { reason: null });
      expect(deploymentWriterService.close).toHaveBeenCalledWith(wallet, "22", { reason: null });
    });

    it("closes nothing for a wallet with no address yet", async () => {
      const { service, deploymentHttpService, deploymentWriterService } = setup({ openDseqs: ["11"] });

      const closed = await service.closeAllOf(createUserWallet({ address: null }));

      expect(closed).toEqual([]);
      expect(deploymentHttpService.findAll).not.toHaveBeenCalled();
      expect(deploymentWriterService.close).not.toHaveBeenCalled();
    });

    it("closes the other deployments, then fails when an escrow cannot settle yet, so the queue retries", async () => {
      const { service, wallet, deploymentWriterService, chainErrorService } = setup({ openDseqs: ["11", "22", "33", "44"] });
      const unsettleable = new Error("escrow account is not settleable");
      deploymentWriterService.close.mockImplementation(async (_wallet, dseq) => {
        if (dseq === "22" || dseq === "33") throw unsettleable;
        return true;
      });
      chainErrorService.isUnsettleableDeploymentError.mockImplementation(error => error === unsettleable);

      await expect(service.closeAllOf(wallet)).rejects.toThrow("Deployments 22, 33 cannot be closed until their escrow settles");

      expect(deploymentWriterService.close).toHaveBeenCalledWith(wallet, "44", { reason: null });
    });

    it("stops at the first close that fails for another reason", async () => {
      const { service, wallet, deploymentWriterService } = setup({ openDseqs: ["11", "22"] });
      deploymentWriterService.close.mockRejectedValueOnce(new Error("account sequence mismatch"));

      await expect(service.closeAllOf(wallet)).rejects.toThrow("account sequence mismatch");

      expect(deploymentWriterService.close).toHaveBeenCalledTimes(1);
    });

    it("rethrows a thrown value that is not an error without asking whether it is unsettleable", async () => {
      const { service, wallet, deploymentWriterService, chainErrorService } = setup({ openDseqs: ["11"] });
      deploymentWriterService.close.mockRejectedValueOnce("boom");

      await expect(service.closeAllOf(wallet)).rejects.toBe("boom");

      expect(chainErrorService.isUnsettleableDeploymentError).not.toHaveBeenCalled();
    });
  });

  function setup(input: { openDseqs: string[] }) {
    const wallet = createInitializedUserWallet();
    const deploymentHttpService = mock<DeploymentHttpService>();
    deploymentHttpService.findAll.mockResolvedValue({
      deployments: input.openDseqs.map(dseq => createDeploymentInfoSeed({ owner: wallet.address, dseq })),
      pagination: { next_key: null, total: String(input.openDseqs.length) }
    });
    const deploymentWriterService = mock<DeploymentWriterService>();
    deploymentWriterService.close.mockResolvedValue(true);
    const chainErrorService = mock<ChainErrorService>();
    chainErrorService.isUnsettleableDeploymentError.mockReturnValue(false);

    const service = new CloseWalletDeploymentsService(deploymentHttpService, deploymentWriterService, chainErrorService);

    return { service, wallet, deploymentHttpService, deploymentWriterService, chainErrorService };
  }
});
