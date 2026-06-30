import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import type { BidHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { BidService } from "./bid.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createBid } from "@test/seeders/bid.seeder";
import { createProviderSeed, createProviderWithAttributeSignatures } from "@test/seeders/provider.seeder";

describe(BidService.name, () => {
  describe("list", () => {
    it("returns all bids when no auditor filter is configured", async () => {
      const { service, bidHttpService, userWalletRepository, authService } = setup({
        allowedAuditors: []
      });

      const userWallet = { address: faker.finance.ethereumAddress(), userId: 1 };
      const mockBids = [createBid(), createBid(), createBid()];

      authService.ability = {} as unknown as AuthService["ability"];
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: vi.fn().mockResolvedValue(userWallet)
      } as unknown as ReturnType<UserWalletRepository["accessibleBy"]>);
      bidHttpService.list.mockResolvedValue(mockBids);

      const result = await service.list("123456");

      expect(result).toHaveLength(3);
      expect(bidHttpService.list).toHaveBeenCalledWith(userWallet.address, "123456");
    });

    it("filters out bids that offer a blocked GPU model for trialing wallets", async () => {
      const { service, bidHttpService, userWalletRepository, authService } = setup({
        allowedAuditors: [],
        blockedGpuModels: ["nvidia/h100"]
      });

      const userWallet = { address: faker.finance.ethereumAddress(), userId: 1, isTrialing: true };
      const blockedBid = createBidWithGpu("nvidia", "h100");
      const allowedBid = createBidWithGpu("nvidia", "rtx-4090");

      authService.ability = {} as unknown as AuthService["ability"];
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: vi.fn().mockResolvedValue(userWallet)
      } as unknown as ReturnType<UserWalletRepository["accessibleBy"]>);
      bidHttpService.list.mockResolvedValue([blockedBid, allowedBid]);

      const result = await service.list("123456");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(allowedBid);
    });

    it("does not filter blocked GPU bids for non-trialing wallets", async () => {
      const { service, bidHttpService, userWalletRepository, authService } = setup({
        allowedAuditors: [],
        blockedGpuModels: ["nvidia/h100"]
      });

      const userWallet = { address: faker.finance.ethereumAddress(), userId: 1, isTrialing: false };
      const blockedBid = createBidWithGpu("nvidia", "h100");

      authService.ability = {} as unknown as AuthService["ability"];
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: vi.fn().mockResolvedValue(userWallet)
      } as unknown as ReturnType<UserWalletRepository["accessibleBy"]>);
      bidHttpService.list.mockResolvedValue([blockedBid]);

      const result = await service.list("123456");

      expect(result).toEqual([blockedBid]);
    });

    it("filters bids to only include audited providers", async () => {
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const { service, bidHttpService, userWalletRepository, authService, providerRepository } = setup({
        allowedAuditors: [auditor]
      });

      const userWallet = { address: faker.finance.ethereumAddress(), userId: 1 };
      const auditedProvider1 = createProviderWithAttributeSignatures(auditor);
      const auditedProvider2 = createProviderWithAttributeSignatures(auditor);
      const unauditedProvider = {
        ...createProviderSeed(),
        providerAttributeSignatures: [],
        providerAttributes: []
      } as unknown as Provider;

      const mockBids = [
        createBid({ provider: auditedProvider1.owner }),
        createBid({ provider: auditedProvider2.owner }),
        createBid({ provider: unauditedProvider.owner })
      ];

      authService.ability = {} as unknown as AuthService["ability"];
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: vi.fn().mockResolvedValue(userWallet)
      } as unknown as ReturnType<UserWalletRepository["accessibleBy"]>);
      bidHttpService.list.mockResolvedValue(mockBids);
      providerRepository.getProvidersByAddressesWithAttributes.mockResolvedValue([auditedProvider1, auditedProvider2, unauditedProvider]);

      const result = await service.list("123456");

      expect(result).toHaveLength(2);
      expect(result.map(r => r.bid.id.provider)).toEqual([auditedProvider1.owner, auditedProvider2.owner]);
      expect(providerRepository.getProvidersByAddressesWithAttributes).toHaveBeenCalledWith([
        auditedProvider1.owner,
        auditedProvider2.owner,
        unauditedProvider.owner
      ]);
    });

    it("returns empty array when no bids match auditor requirements", async () => {
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const { service, bidHttpService, userWalletRepository, authService, providerRepository } = setup({
        allowedAuditors: [auditor]
      });

      const userWallet = { address: faker.finance.ethereumAddress(), userId: 1 };
      const unauditedProvider1 = {
        ...createProviderSeed(),
        providerAttributeSignatures: [],
        providerAttributes: []
      } as unknown as Provider;
      const unauditedProvider2 = {
        ...createProviderSeed(),
        providerAttributeSignatures: [],
        providerAttributes: []
      } as unknown as Provider;

      const mockBids = [createBid({ provider: unauditedProvider1.owner }), createBid({ provider: unauditedProvider2.owner })];

      authService.ability = {} as unknown as AuthService["ability"];
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: vi.fn().mockResolvedValue(userWallet)
      } as unknown as ReturnType<UserWalletRepository["accessibleBy"]>);
      bidHttpService.list.mockResolvedValue(mockBids);
      providerRepository.getProvidersByAddressesWithAttributes.mockResolvedValue([unauditedProvider1, unauditedProvider2]);

      const result = await service.list("123456");

      expect(result).toHaveLength(0);
    });

    it("throws error when user wallet not found", async () => {
      const { service, userWalletRepository, authService } = setup({});

      authService.ability = {} as unknown as AuthService["ability"];
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: vi.fn().mockResolvedValue(null)
      } as unknown as ReturnType<UserWalletRepository["accessibleBy"]>);

      await expect(service.list("123456")).rejects.toMatchObject({
        status: 404,
        message: "UserWallet Not Found"
      });
    });

    it("handles empty bids array", async () => {
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const { service, bidHttpService, userWalletRepository, authService, providerRepository } = setup({
        allowedAuditors: [auditor]
      });

      const userWallet = { address: faker.finance.ethereumAddress(), userId: 1 };

      authService.ability = {} as unknown as AuthService["ability"];
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: vi.fn().mockResolvedValue(userWallet)
      } as unknown as ReturnType<UserWalletRepository["accessibleBy"]>);
      bidHttpService.list.mockResolvedValue([]);

      const result = await service.list("123456");

      expect(result).toHaveLength(0);
      expect(providerRepository.getProvidersByAddressesWithAttributes).not.toHaveBeenCalled();
    });
  });

  function setup(config: { allowedAuditors?: string[]; blockedGpuModels?: string[] }) {
    const bidHttpService = mock<BidHttpService>();
    const authService = mock<AuthService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const billingConfig = mockConfigService<BillingConfigService>({
      MANAGED_WALLET_LEASE_ALLOWED_AUDITORS: config.allowedAuditors || []
    });
    const blockedGpuConfig = mockConfigService<BillingConfigService>({
      MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: config.blockedGpuModels || []
    });
    const blockedGpuService = new BlockedGpuService(blockedGpuConfig);
    const providerRepository = mock<ProviderRepository>();

    const service = new BidService(bidHttpService, authService, userWalletRepository, billingConfig, providerRepository, blockedGpuService);

    return {
      service,
      bidHttpService,
      authService,
      userWalletRepository,
      billingConfig,
      providerRepository,
      blockedGpuService
    };
  }

  function createBidWithGpu(vendor: string, model: string) {
    const bid = createBid();
    bid.bid.resources_offer[0].resources.gpu = {
      units: { val: "1" },
      attributes: [{ key: `vendor/${vendor}/model/${model}`, value: "true" }]
    };
    return bid;
  }
});
