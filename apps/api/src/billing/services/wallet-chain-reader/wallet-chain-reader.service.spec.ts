import type { AuthzHttpService, DeploymentHttpService, DepositDeploymentGrant, FeeAllowance } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { SpendRateService } from "@src/deployment/services/spend-rate/spend-rate.service";
import { WalletChainReaderService } from "./wallet-chain-reader.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createBankBalancesResponse } from "@test/seeders/bank-balances-response.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createInitializedUserWallet } from "@test/seeders/user-wallet.seeder";

describe(WalletChainReaderService.name, () => {
  describe("getBalances", () => {
    it("reads the wallet's bank balances, grants and active deployments", async () => {
      const wallet = createInitializedUserWallet();
      const { service, chainSdk, authzHttpService, deploymentHttpService } = setup();

      await service.getBalances(wallet);

      expect(chainSdk.cosmos.bank.v1beta1.getAllBalances).toHaveBeenCalledWith({ address: wallet.address });
      expect(authzHttpService.getAllDepositDeploymentGrants).toHaveBeenCalledWith({ grantee: wallet.address, limit: 1000 });
      expect(deploymentHttpService.findAll).toHaveBeenCalledWith({ owner: wallet.address, state: "active" });
    });

    it("returns the bank balances per denom", async () => {
      const { service } = setup({
        balances: [
          { denom: "uakt", amount: "1500" },
          { denom: "uact", amount: "2500" }
        ]
      });

      const result = await service.getBalances(createInitializedUserWallet());

      expect(result.balances).toEqual([
        { denom: "uakt", amount: "1500" },
        { denom: "uact", amount: "2500" }
      ]);
    });

    it("sums the spend limits of every grant per denom", async () => {
      const { service } = setup({
        grants: [
          createGrant([
            { denom: "uact", amount: "1000" },
            { denom: "uakt", amount: "5" }
          ]),
          createGrant([{ denom: "uact", amount: "250" }])
        ]
      });

      const result = await service.getBalances(createInitializedUserWallet());

      expect(result.deploymentGrants).toEqual([
        { denom: "uact", amount: "1250" },
        { denom: "uakt", amount: "5" }
      ]);
    });

    it("counts a spend limit it cannot parse as nothing", async () => {
      const { service } = setup({ grants: [createGrant([{ denom: "uact", amount: "not-a-number" }]), createGrant([{ denom: "uact", amount: "3" }])] });

      const result = await service.getBalances(createInitializedUserWallet());

      expect(result.deploymentGrants).toEqual([{ denom: "uact", amount: "3" }]);
    });

    it("returns each active deployment's escrow funds and the height they settled at", async () => {
      const deployment = createDeploymentInfoSeed({ dseq: "123", denom: "uact", amount: "4200.5" });
      deployment.escrow_account.state.settled_at = "987654";
      const { service } = setup({ deployments: [deployment] });

      const result = await service.getBalances(createInitializedUserWallet());

      expect(result.activeDeployments).toEqual([{ dseq: "123", escrow: { funds: [{ denom: "uact", amount: "4200.5" }], settledAt: 987654 } }]);
    });

    it("leaves out the escrow of deployments whose spend the caller may not read", async () => {
      const wallet = createInitializedUserWallet();
      const { service, spendRateService } = setup({
        deployments: [createDeploymentInfoSeed({ dseq: "123" }), createDeploymentInfoSeed({ dseq: "456" })],
        visibleDseqs: ["456"]
      });

      const result = await service.getBalances(wallet);

      expect(result.activeDeployments.map(({ dseq }) => dseq)).toEqual(["456"]);
      expect(spendRateService.keepDeploymentsWithVisibleSpend).toHaveBeenCalledWith(wallet, ["123", "456"]);
    });

    it("shares one chain round-trip between overlapping reads of the same wallet", async () => {
      const wallet = createInitializedUserWallet();
      const { service, chainSdk } = setup();

      const [first, second] = await Promise.all([service.getBalances(wallet), service.getBalances(wallet)]);

      expect(first).toEqual(second);
      expect(chainSdk.cosmos.bank.v1beta1.getAllBalances).toHaveBeenCalledTimes(1);
    });

    it("reads the chain again once the previous read settled", async () => {
      const wallet = createInitializedUserWallet();
      const { service, chainSdk } = setup();

      await service.getBalances(wallet);
      await service.getBalances(wallet);

      expect(chainSdk.cosmos.bank.v1beta1.getAllBalances).toHaveBeenCalledTimes(2);
    });
  });

  describe("getFeeAllowances", () => {
    it("returns the granter, spend limit and expiration of each valid allowance", async () => {
      const address = createAkashAddress();
      const granter = createAkashAddress();
      const { service, authzHttpService } = setup({
        allowances: [createAllowance({ granter, grantee: address, spendLimit: [{ denom: "uakt", amount: "100" }], expiration: "2030-01-01T00:00:00Z" })]
      });

      const result = await service.getFeeAllowances(address);

      expect(authzHttpService.getValidFeeAllowancesForGrantee).toHaveBeenCalledWith(address);
      expect(result).toEqual([{ granter, spendLimit: [{ denom: "uakt", amount: "100" }], expiration: "2030-01-01T00:00:00Z" }]);
    });

    it("reports an allowance without spend limit or expiration as unlimited and open-ended", async () => {
      const allowance = createAllowance({});
      Object.assign(allowance.allowance, { spend_limit: undefined, expiration: undefined });
      const { service } = setup({ allowances: [allowance] });

      const [result] = await service.getFeeAllowances(createAkashAddress());

      expect(result).toEqual({ granter: allowance.granter, spendLimit: [], expiration: null });
    });
  });

  function createGrant(spendLimits: { denom: string; amount: string }[]): DepositDeploymentGrant {
    return {
      granter: createAkashAddress(),
      grantee: createAkashAddress(),
      authorization: { "@type": "/akash.escrow.v1.DepositAuthorization", spend_limits: spendLimits as DepositDeploymentGrant["authorization"]["spend_limits"] },
      expiration: "2030-01-01T00:00:00Z"
    };
  }

  function createAllowance(input: { granter?: string; grantee?: string; spendLimit?: { denom: string; amount: string }[]; expiration?: string }): FeeAllowance {
    return {
      granter: input.granter ?? createAkashAddress(),
      grantee: input.grantee ?? createAkashAddress(),
      allowance: {
        "@type": "/cosmos.feegrant.v1beta1.BasicAllowance",
        spend_limit: (input.spendLimit ?? []) as FeeAllowance["allowance"]["spend_limit"],
        expiration: input.expiration ?? "2030-01-01T00:00:00Z"
      }
    };
  }

  function setup(input?: {
    balances?: { denom: string; amount: string }[];
    grants?: DepositDeploymentGrant[];
    deployments?: ReturnType<typeof createDeploymentInfoSeed>[];
    allowances?: FeeAllowance[];
    visibleDseqs?: string[];
  }) {
    const chainSdk = mockDeep<ChainSDK>();
    const bankBalances = createBankBalancesResponse();
    chainSdk.cosmos.bank.v1beta1.getAllBalances.mockResolvedValue({ ...bankBalances, balances: input?.balances ?? bankBalances.balances });
    const authzHttpService = mock<AuthzHttpService>({
      getAllDepositDeploymentGrants: vi.fn().mockResolvedValue(input?.grants ?? []),
      getValidFeeAllowancesForGrantee: vi.fn().mockResolvedValue(input?.allowances ?? [])
    });
    const deploymentHttpService = mock<DeploymentHttpService>({
      findAll: vi.fn().mockResolvedValue({ deployments: input?.deployments ?? [], pagination: { next_key: null, total: "0" } })
    });
    const spendRateService = mock<SpendRateService>({
      keepDeploymentsWithVisibleSpend: vi.fn(async (_wallet, dseqs) => input?.visibleDseqs ?? dseqs)
    });
    const service = new WalletChainReaderService(chainSdk, authzHttpService, deploymentHttpService, spendRateService);

    return { service, chainSdk, authzHttpService, deploymentHttpService, spendRateService };
  }
});
