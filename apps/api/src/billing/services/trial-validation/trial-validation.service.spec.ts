import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { BidHttpService } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { TrialValidationService } from "./trial-validation.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createBid } from "@test/seeders/bid.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(TrialValidationService.name, () => {
  describe("validateLeaseGpuModels", () => {
    it("skips validation when wallet is not trialing", async () => {
      const wallet = createUserWallet({ isTrialing: false });
      const { service, bidHttpService } = setupGpu({ blockedGpuModels: ["nvidia/h100"] });

      await service.validateLeaseGpuModels([createLeaseMessage()], wallet);

      expect(bidHttpService.list).not.toHaveBeenCalled();
    });

    it("skips validation when blocked-set is empty", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service, bidHttpService } = setupGpu({ blockedGpuModels: [] });

      await service.validateLeaseGpuModels([createLeaseMessage()], wallet);

      expect(bidHttpService.list).not.toHaveBeenCalled();
    });

    it("allows lease when bid GPU is not in the blocked-set", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service } = setupGpu({
        blockedGpuModels: ["nvidia/h100"],
        bid: createBidWithGpu("nvidia", "rtx-4090", { dseq: "111", gseq: 1, oseq: 1, bseq: 1, provider: "akash1prov" })
      });

      await expect(
        service.validateLeaseGpuModels([createLeaseMessage({ dseq: "111", gseq: 1, oseq: 1, bseq: 1, provider: "akash1prov" })], wallet)
      ).resolves.toBeUndefined();
    });

    it("rejects lease with 402 when bid GPU is in the blocked-set", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service } = setupGpu({
        blockedGpuModels: ["nvidia/h100"],
        bid: createBidWithGpu("nvidia", "h100", { dseq: "111", gseq: 1, oseq: 1, bseq: 1, provider: "akash1prov" })
      });

      await expect(
        service.validateLeaseGpuModels([createLeaseMessage({ dseq: "111", gseq: 1, oseq: 1, bseq: 1, provider: "akash1prov" })], wallet)
      ).rejects.toMatchObject({
        status: 402,
        message: expect.stringContaining("Nvidia H100")
      });
    });

    it("passes when there are no MsgCreateLease messages", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service, bidHttpService } = setupGpu({ blockedGpuModels: ["nvidia/h100"] });

      await service.validateLeaseGpuModels([createDeploymentMessage()], wallet);

      expect(bidHttpService.list).not.toHaveBeenCalled();
    });

    it("rejects with 403 when the referenced bid cannot be resolved", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service } = setupGpu({ blockedGpuModels: ["nvidia/h100"] });

      await expect(
        service.validateLeaseGpuModels([createLeaseMessage({ dseq: "111", gseq: 1, oseq: 1, bseq: 1, provider: "akash1prov" })], wallet)
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining("Referenced lease bid not found")
      });
    });
  });

  describe("validateDeploymentGpuModels", () => {
    it("skips validation when wallet is not trialing", async () => {
      const wallet = createUserWallet({ isTrialing: false });
      const { service } = setupGpu({ blockedGpuModels: ["nvidia/h100"] });

      await expect(service.validateDeploymentGpuModels([createDeploymentMessageWithGpu("nvidia", "h100")], wallet)).resolves.toBeUndefined();
    });

    it("skips validation when blocked-set is empty", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service } = setupGpu({ blockedGpuModels: [] });

      await expect(service.validateDeploymentGpuModels([createDeploymentMessageWithGpu("nvidia", "h100")], wallet)).resolves.toBeUndefined();
    });

    it("allows deployment when requested GPU is not in the blocked-set", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service } = setupGpu({ blockedGpuModels: ["nvidia/h100"] });

      await expect(service.validateDeploymentGpuModels([createDeploymentMessageWithGpu("nvidia", "rtx-4090")], wallet)).resolves.toBeUndefined();
    });

    it("rejects deployment with 402 when requested GPU is in the blocked-set", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service } = setupGpu({ blockedGpuModels: ["nvidia/h100"] });

      await expect(service.validateDeploymentGpuModels([createDeploymentMessageWithGpu("nvidia", "h100")], wallet)).rejects.toMatchObject({
        status: 402,
        message: expect.stringContaining("Nvidia H100")
      });
    });

    it("passes when there are no MsgCreateDeployment messages", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const { service } = setupGpu({ blockedGpuModels: ["nvidia/h100"] });

      await expect(service.validateDeploymentGpuModels([createLeaseMessage()], wallet)).resolves.toBeUndefined();
    });
  });

  function createDeploymentMessage(): EncodeObject {
    return {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({})
    };
  }

  function createDeploymentMessageWithGpu(vendor: string, model: string): EncodeObject {
    return {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({
        groups: [
          {
            name: "test",
            resources: [
              {
                resource: {
                  id: 1,
                  gpu: {
                    units: { val: new Uint8Array([1]) },
                    attributes: [{ key: `vendor/${vendor}/model/${model}`, value: "true" }]
                  }
                },
                count: 1
              }
            ]
          }
        ]
      })
    };
  }

  function createLeaseMessage(bidId?: { dseq?: string; gseq?: number; oseq?: number; bseq?: number; provider?: string; owner?: string }): EncodeObject {
    return {
      typeUrl: `/${MsgCreateLease.$type}`,
      value: MsgCreateLease.fromPartial({
        bidId: {
          owner: bidId?.owner ?? "akash1owner",
          dseq: bidId?.dseq ?? "111",
          gseq: bidId?.gseq ?? 1,
          oseq: bidId?.oseq ?? 1,
          bseq: bidId?.bseq ?? 1,
          provider: bidId?.provider ?? "akash1prov"
        }
      })
    };
  }

  function createBidWithGpu(
    vendor: string,
    model: string,
    ids: { dseq: string; gseq: number; oseq: number; bseq: number; provider: string }
  ): ReturnType<typeof createBid> {
    const bid = createBid({ dseq: ids.dseq, gseq: ids.gseq, oseq: ids.oseq, bseq: ids.bseq, provider: ids.provider });
    bid.bid.resources_offer[0].resources.gpu = {
      units: { val: "1" },
      attributes: [{ key: `vendor/${vendor}/model/${model}`, value: "true" }]
    };
    return bid;
  }

  describe("getTopUpMinAmountUsd", () => {
    it("returns the standard $20 floor when the wallet is not trialing", () => {
      const { service } = setupTopUp({ trialMin: 100 });
      expect(service.getTopUpMinAmountUsd({ isTrialing: false })).toBe(20);
    });

    it("returns the configured trial minimum when the wallet is trialing", () => {
      const { service } = setupTopUp({ trialMin: 100 });
      expect(service.getTopUpMinAmountUsd({ isTrialing: true })).toBe(100);
    });

    it("honors a custom trial minimum from config", () => {
      const { service } = setupTopUp({ trialMin: 250 });
      expect(service.getTopUpMinAmountUsd({ isTrialing: true })).toBe(250);
    });
  });

  describe("validateTopUpAmount", () => {
    it("resolves when no wallet is provided", () => {
      const { service } = setupTopUp({ trialMin: 100 });
      expect(() => service.validateTopUpAmount(undefined, 1)).not.toThrow();
    });

    it("resolves for non-trial users regardless of amount", () => {
      const { service } = setupTopUp({ trialMin: 100 });
      const wallet = createUserWallet({ isTrialing: false });
      expect(() => service.validateTopUpAmount(wallet, 1)).not.toThrow();
    });

    it("resolves for trial users paying at or above the trial minimum", () => {
      const { service } = setupTopUp({ trialMin: 100 });
      const wallet = createUserWallet({ isTrialing: true });
      expect(() => service.validateTopUpAmount(wallet, 100)).not.toThrow();
      expect(() => service.validateTopUpAmount(wallet, 250)).not.toThrow();
    });

    it("throws 402 for trial users paying below the trial minimum", () => {
      const { service } = setupTopUp({ trialMin: 100 });
      const wallet = createUserWallet({ isTrialing: true });
      expect(() => service.validateTopUpAmount(wallet, 50)).toThrow(
        expect.objectContaining({ status: 402, message: "First top-up must be at least $100 while on the free trial." })
      );
    });
  });

  function setupTopUp(input: { trialMin: number }) {
    const providerRepository = mock<ProviderRepository>();
    const bidHttpService = mock<BidHttpService>();
    const blockedGpuService = mock<BlockedGpuService>();
    const config = mockConfigService<BillingConfigService>({
      MANAGED_WALLET_TRIAL_MIN_TOP_UP_AMOUNT: input.trialMin
    });
    const service = new TrialValidationService(config, providerRepository, bidHttpService, blockedGpuService);
    return { service };
  }

  function setupGpu(input: { blockedGpuModels: string[]; bid?: ReturnType<typeof createBid> }) {
    const config = mock<BillingConfigService>();
    const providerRepository = mock<ProviderRepository>();
    const bidHttpService = mock<BidHttpService>();
    bidHttpService.list.mockResolvedValue(input.bid ? [input.bid] : []);
    const blockedGpuConfig = mockConfigService<BillingConfigService>({
      MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: input.blockedGpuModels
    });
    const blockedGpuService = new BlockedGpuService(blockedGpuConfig);
    const service = new TrialValidationService(config, providerRepository, bidHttpService, blockedGpuService);
    return { service, config, providerRepository, bidHttpService, blockedGpuService };
  }
});
