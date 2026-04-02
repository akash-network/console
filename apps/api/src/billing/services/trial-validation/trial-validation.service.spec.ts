import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { TrialValidationService } from "./trial-validation.service";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(TrialValidationService.name, () => {
  describe("validateTrialLimit", () => {
    it("queries active deployments only when wallet is trialing and message is a deployment", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service, deploymentReaderService } = setup({ count: 0 });

      await service.validateTrialLimit(createDeploymentMessage(), wallet);

      expect(deploymentReaderService.listWithResources).toHaveBeenCalledWith({
        address: wallet.address,
        status: "active",
        limit: 1
      });
    });

    it("allows the deployment when active count is below the trial limit", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service } = setup({ count: 4 });

      await expect(service.validateTrialLimit(createDeploymentMessage(), wallet)).resolves.toBeUndefined();
    });

    it("rejects with 402 when active count has reached the trial limit", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service } = setup({ count: 5 });

      await expect(service.validateTrialLimit(createDeploymentMessage(), wallet)).rejects.toMatchObject({
        status: 402,
        message: "Trial limit reached. Add funds to your account to deploy more."
      });
    });

    it("skips the check when wallet is not trialing", async () => {
      const wallet = createUserWallet({ isTrialing: false });
      const { service, deploymentReaderService } = setup({ count: 99 });

      await service.validateTrialLimit(createDeploymentMessage(), wallet);

      expect(deploymentReaderService.listWithResources).not.toHaveBeenCalled();
    });

    it("skips the check when message is not a deployment creation", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service, deploymentReaderService } = setup({ count: 99 });

      const leaseMessage: EncodeObject = {
        typeUrl: `/${MsgCreateLease.$type}`,
        value: MsgCreateLease.fromPartial({})
      };

      await service.validateTrialLimit(leaseMessage, wallet);

      expect(deploymentReaderService.listWithResources).not.toHaveBeenCalled();
    });
  });

  function createDeploymentMessage(): EncodeObject {
    return {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({})
    };
  }

  function setup(input: { count: number }) {
    const deploymentReaderService = mock<DeploymentReaderService>();
    deploymentReaderService.listWithResources.mockResolvedValue({ count: input.count, results: [] });
    const config = mock<BillingConfigService>();
    const providerRepository = mock<ProviderRepository>();
    const service = new TrialValidationService(deploymentReaderService, config, providerRepository);
    return { service, deploymentReaderService, config, providerRepository };
  }
});
