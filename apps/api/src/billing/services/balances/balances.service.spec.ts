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

  describe("toFiatAmount", () => {
    it("converts uakt amount using market price", async () => {
      const { service, statsService } = setup({ denom: "uakt" });
      statsService.convertToFiatAmount.mockResolvedValue(25.5);

      const result = await service.toFiatAmount(25_500_000);

      expect(statsService.convertToFiatAmount).toHaveBeenCalledWith(25.5, "akt");
      expect(result).toBe(25.5);
    });

    it("throws on unknown denom", async () => {
      const { service, statsService } = setup({ denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1" });
      statsService.convertToFiatAmount.mockResolvedValue(10.0);

      await expect(service.toFiatAmount(10_000_000)).rejects.toThrow(
        `Unsupported deployment grant denom: ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1`
      );
    });

    it("returns 1:1 rate for uact denom", async () => {
      const { service, statsService } = setup({ denom: "uact" });

      const result = await service.toFiatAmount(25_500_000);

      expect(statsService.convertToFiatAmount).not.toHaveBeenCalled();
      expect(result).toBe(25.5);
    });
  });

  function setup(input?: { limitsUpdate?: Partial<UserWalletInput>; deploymentLimit?: number; fiatAmount?: number; denom?: string }) {
    const billingConfig = mock<BillingConfig>();
    billingConfig.DEPLOYMENT_GRANT_DENOM = input?.denom ?? "uakt";
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

    return { service, userWalletRepository, statsService };
  }
});
