import type { BidHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import { BidService } from "./bid.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { BidSeeder } from "@test/seeders/bid.seeder";
import { createProviderSeed, createProviderWithAttributeSignatures } from "@test/seeders/provider.seeder";

describe(BidService.name, () => {
  describe("list", () => {
    it("returns all bids when no auditor filter is configured", async () => {
      const { service, bidHttpService, userWalletRepository, authService } = setup({
        allowedAuditors: []
      });

      const userWallet = { address: faker.finance.ethereumAddress(), userId: 1 };
      const mockBids = [BidSeeder.create(), BidSeeder.create(), BidSeeder.create()];

      authService.ability = {} as any;
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: jest.fn().mockResolvedValue(userWallet)
      } as any);
      bidHttpService.list.mockResolvedValue(mockBids);

      const result = await service.list("123456");

      expect(result).toHaveLength(3);
      expect(bidHttpService.list).toHaveBeenCalledWith(userWallet.address, "123456");
    });

    it("filters bids to only include audited providers", async () => {
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const { service, bidHttpService, userWalletRepository, authService, providerRepository } = setup({
        allowedAuditors: [auditor]
      });

      const userWallet = { address: faker.finance.ethereumAddress(), userId: 1 };
      const auditedProvider1 = createProviderWithAttributeSignatures(auditor);
      const auditedProvider2 = createProviderWithAttributeSignatures(auditor);
      const unauditedProvider = { ...createProviderSeed(), providerAttributeSignatures: [], providerAttributes: [] } as any;

      const mockBids = [
        BidSeeder.create({ provider: auditedProvider1.owner }),
        BidSeeder.create({ provider: auditedProvider2.owner }),
        BidSeeder.create({ provider: unauditedProvider.owner })
      ];

      authService.ability = {} as any;
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: jest.fn().mockResolvedValue(userWallet)
      } as any);
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
      const unauditedProvider1 = { ...createProviderSeed(), providerAttributeSignatures: [], providerAttributes: [] } as any;
      const unauditedProvider2 = { ...createProviderSeed(), providerAttributeSignatures: [], providerAttributes: [] } as any;

      const mockBids = [BidSeeder.create({ provider: unauditedProvider1.owner }), BidSeeder.create({ provider: unauditedProvider2.owner })];

      authService.ability = {} as any;
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: jest.fn().mockResolvedValue(userWallet)
      } as any);
      bidHttpService.list.mockResolvedValue(mockBids);
      providerRepository.getProvidersByAddressesWithAttributes.mockResolvedValue([unauditedProvider1, unauditedProvider2]);

      const result = await service.list("123456");

      expect(result).toHaveLength(0);
    });

    it("throws error when user wallet not found", async () => {
      const { service, userWalletRepository, authService } = setup({});

      authService.ability = {} as any;
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: jest.fn().mockResolvedValue(null)
      } as any);

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

      authService.ability = {} as any;
      userWalletRepository.accessibleBy.mockReturnValue({
        findFirst: jest.fn().mockResolvedValue(userWallet)
      } as any);
      bidHttpService.list.mockResolvedValue([]);

      const result = await service.list("123456");

      expect(result).toHaveLength(0);
      expect(providerRepository.getProvidersByAddressesWithAttributes).not.toHaveBeenCalled();
    });
  });

  function setup(config: { allowedAuditors?: string[] }) {
    const bidHttpService = mock<BidHttpService>();
    const authService = mock<AuthService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const providerService = mock<ProviderService>();
    const billingConfig = mockConfigService<BillingConfigService>({
      MANAGED_WALLET_LEASE_ALLOWED_AUDITORS: config.allowedAuditors || []
    });
    const providerRepository = mock<ProviderRepository>();

    const service = new BidService(bidHttpService, authService, userWalletRepository, providerService, billingConfig, providerRepository);

    return {
      service,
      bidHttpService,
      authService,
      userWalletRepository,
      providerService,
      billingConfig,
      providerRepository
    };
  }
});
