import type { AuthzHttpService, DeploymentHttpService } from "@akashnetwork/http-sdk";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { UserWalletInput, UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { StatsService } from "@src/dashboard/services/stats/stats.service";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(BalancesService.name, () => {
  describe("refreshUserWalletLimits", () => {
    it("updates both limits and isTrialing when limits changed and endTrial is true", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const limitsUpdate: Partial<UserWalletInput> = { feeAllowance: 300, deploymentAllowance: 400 };
      const { service, userWalletRepository } = setup({ limitsUpdate });

      await service.refreshUserWalletLimits(wallet, { endTrial: true });

      expect(userWalletRepository.updateById).toHaveBeenCalledWith(wallet.id, {
        feeAllowance: 300,
        deploymentAllowance: 400,
        isTrialing: false
      });
    });

    it("updates isTrialing even when limits are unchanged", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service, userWalletRepository } = setup({ limitsUpdate: {} });

      await service.refreshUserWalletLimits(wallet, { endTrial: true });

      expect(userWalletRepository.updateById).toHaveBeenCalledWith(wallet.id, {
        isTrialing: false
      });
    });

    it("does not update when limits are unchanged and endTrial is not set", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service, userWalletRepository } = setup({ limitsUpdate: {} });

      await service.refreshUserWalletLimits(wallet);

      expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    });

    it("updates limits only when limits changed and endTrial is not set", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const limitsUpdate: Partial<UserWalletInput> = { feeAllowance: 300, deploymentAllowance: 400 };
      const { service, userWalletRepository } = setup({ limitsUpdate });

      await service.refreshUserWalletLimits(wallet);

      expect(userWalletRepository.updateById).toHaveBeenCalledWith(wallet.id, {
        feeAllowance: 300,
        deploymentAllowance: 400
      });
    });

    it("does not set isTrialing when wallet is not trialing", async () => {
      const wallet = createUserWallet({ isTrialing: false });
      const { service, userWalletRepository } = setup({ limitsUpdate: {} });

      await service.refreshUserWalletLimits(wallet, { endTrial: true });

      expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("getDeploymentBalanceInFiat", () => {
    it("returns deployment limit converted to fiat", async () => {
      const deploymentLimit = 50_000_000;
      const expectedFiat = 50.0;
      const address = "akash1test";
      const { service } = setup({ deploymentLimit, fiatAmount: expectedFiat });

      const result = await service.getDeploymentBalanceInFiat(address);

      expect(result).toBe(expectedFiat);
    });
  });

  function setup(input?: { limitsUpdate?: Partial<UserWalletInput>; deploymentLimit?: number; fiatAmount?: number }) {
    const billingConfig = mock<BillingConfig>();
    const userWalletRepository = mock<UserWalletRepository>();
    const txManagerService = mock<TxManagerService>();
    const authzHttpService = mock<AuthzHttpService>();
    const deploymentHttpService = mock<DeploymentHttpService>();
    const statsService = mock<StatsService>();

    const service = new BalancesService(billingConfig, userWalletRepository, txManagerService, authzHttpService, deploymentHttpService, statsService);

    vi.spyOn(service, "getFreshLimitsUpdate").mockResolvedValue(input?.limitsUpdate ?? {});

    if (input?.deploymentLimit !== undefined) {
      vi.spyOn(service, "retrieveDeploymentLimit").mockResolvedValue(input.deploymentLimit);
    }

    if (input?.fiatAmount !== undefined) {
      vi.spyOn(service, "toFiatAmount").mockResolvedValue(input.fiatAmount);
    }

    return { service, userWalletRepository };
  }
});
