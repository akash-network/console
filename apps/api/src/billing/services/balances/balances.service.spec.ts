import type { AuthzHttpService, DeploymentHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { UserWalletInput, UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import type { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
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

  describe("retrieveDeploymentLimitAtLatestHeight", () => {
    it("reads the deployment limit pinned to the latest height and returns both", async () => {
      const { service, fundingWalletRegistry, authzHttpService, blockHttpService } = setup({ denom: "uact" });
      fundingWalletRegistry.getGranterAddressByWalletAddress.mockResolvedValue("akash1funding");
      blockHttpService.getFreshCurrentHeight.mockResolvedValue(1234);
      authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee.mockResolvedValue({
        authorization: {
          "@type": "/akash.escrow.v1.DepositAuthorization",
          spend_limits: [
            { denom: "uakt", amount: "7" },
            { denom: "uact", amount: "5000000" }
          ]
        },
        expiration: ""
      });

      const result = await service.retrieveDeploymentLimitAtLatestHeight({ address: "akash1grantee" });

      expect(fundingWalletRegistry.getGranterAddressByWalletAddress).toHaveBeenCalledWith("akash1grantee");
      expect(authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee).toHaveBeenCalledWith("akash1funding", "akash1grantee", { height: 1234 });
      expect(result).toEqual({ limit: 5_000_000, height: 1234, granter: "akash1funding" });
    });

    it("reads the grant of the funding wallet it is told to, without asking which one backs the user wallet", async () => {
      const { service, fundingWalletRegistry, authzHttpService, blockHttpService } = setup({ denom: "uact" });
      blockHttpService.getFreshCurrentHeight.mockResolvedValue(1234);
      authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee.mockResolvedValue({
        authorization: { "@type": "/akash.escrow.v1.DepositAuthorization", spend_limits: [{ denom: "uact", amount: "42" }] },
        expiration: ""
      });

      const result = await service.retrieveDeploymentLimitAtLatestHeight({ address: "akash1grantee" }, { granter: "akash1draining" });

      expect(result).toEqual({ limit: 42, height: 1234, granter: "akash1draining" });
      expect(authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee).toHaveBeenCalledWith("akash1draining", "akash1grantee", { height: 1234 });
      expect(fundingWalletRegistry.getGranterAddressByWalletAddress).not.toHaveBeenCalled();
    });

    it("reads a limit of zero when the wallet holds no deposit grant at that height", async () => {
      const { service, fundingWalletRegistry, authzHttpService, blockHttpService } = setup({ denom: "uact" });
      fundingWalletRegistry.getGranterAddressByWalletAddress.mockResolvedValue("akash1funding");
      blockHttpService.getFreshCurrentHeight.mockResolvedValue(1234);
      authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee.mockResolvedValue(undefined);

      expect(await service.retrieveDeploymentLimitAtLatestHeight({ address: "akash1grantee" })).toEqual({ limit: 0, height: 1234, granter: "akash1funding" });
    });
  });

  describe("retrieveDeploymentLimit", () => {
    it("reads the limit of the grant from the funding wallet that backs the user wallet", async () => {
      const { service, fundingWalletRegistry, authzHttpService } = setup({ denom: "uact" });
      fundingWalletRegistry.getGranterAddressByWalletAddress.mockResolvedValue("akash1funding");
      authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee.mockResolvedValue({
        authorization: { "@type": "/akash.escrow.v1.DepositAuthorization", spend_limits: [{ denom: "uact", amount: "2500000" }] },
        expiration: ""
      });

      await expect(service.retrieveDeploymentLimit({ address: "akash1grantee" })).resolves.toBe(2_500_000);

      expect(fundingWalletRegistry.getGranterAddressByWalletAddress).toHaveBeenCalledWith("akash1grantee");
      expect(authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee).toHaveBeenCalledWith("akash1funding", "akash1grantee");
    });
  });

  describe("retrieveAndCalcFeeLimit", () => {
    it("sums the uakt of the fee allowance from the funding wallet that backs the user wallet", async () => {
      const { service, fundingWalletRegistry, authzHttpService } = setup();
      fundingWalletRegistry.getGranterAddressByWalletAddress.mockResolvedValue("akash1funding");
      authzHttpService.getFeeAllowanceForGranterAndGrantee.mockResolvedValue({
        granter: "akash1funding",
        grantee: "akash1grantee",
        allowance: {
          "@type": "/cosmos.feegrant.v1beta1.BasicAllowance",
          spend_limit: [
            { denom: "uakt", amount: "300" },
            { denom: "uact", amount: "9" }
          ],
          expiration: ""
        }
      });

      await expect(service.retrieveAndCalcFeeLimit({ address: "akash1grantee" })).resolves.toBe(300);

      expect(fundingWalletRegistry.getGranterAddressByWalletAddress).toHaveBeenCalledWith("akash1grantee");
      expect(authzHttpService.getFeeAllowanceForGranterAndGrantee).toHaveBeenCalledWith("akash1funding", "akash1grantee");
    });

    it("reads zero when the funding wallet gave no fee allowance", async () => {
      const { service, fundingWalletRegistry, authzHttpService } = setup();
      fundingWalletRegistry.getGranterAddressByWalletAddress.mockResolvedValue("akash1funding");
      authzHttpService.getFeeAllowanceForGranterAndGrantee.mockResolvedValue(undefined);

      await expect(service.retrieveAndCalcFeeLimit({ address: "akash1grantee" })).resolves.toBe(0);
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
    billingConfig.DEPLOYMENT_GRANT_DENOM = (input?.denom ?? "uakt") as "uakt" | "uact";
    const userWalletRepository = mock<UserWalletRepository>();
    const fundingWalletRegistry = mock<FundingWalletRegistryService>();
    const authzHttpService = mock<AuthzHttpService>();
    const deploymentHttpService = mock<DeploymentHttpService>();
    const statsService = mock<StatsService>();

    const blockHttpService = mock<BlockHttpService>();

    const service = new BalancesService(
      billingConfig,
      userWalletRepository,
      fundingWalletRegistry,
      authzHttpService,
      deploymentHttpService,
      statsService,
      blockHttpService
    );

    vi.spyOn(service, "getFreshLimitsUpdate").mockResolvedValue(input?.limitsUpdate ?? {});

    if (input?.deploymentLimit !== undefined) {
      vi.spyOn(service, "retrieveDeploymentLimit").mockResolvedValue(input.deploymentLimit);
    }

    if (input?.fiatAmount !== undefined) {
      vi.spyOn(service, "toFiatAmount").mockResolvedValue(input.fiatAmount);
    }

    return { service, userWalletRepository, statsService, fundingWalletRegistry, authzHttpService, blockHttpService };
  }
});
