import { Registry } from "@cosmjs/proto-signing";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TrialStarted } from "@src/billing/events/trial-started";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ProviderJwtTokenService } from "@src/provider/services/provider-jwt-token/provider-jwt-token.service";
import { UserWalletRepository } from "../../repositories/user-wallet/user-wallet.repository";
import { ManagedSignerService } from "../managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";
import { WalletInitializerService } from "./wallet-initializer.service";

import { createChainWallet } from "@test/seeders/chain-wallet.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(WalletInitializerService.name, () => {
  describe("initializeAndGrantTrialLimits", () => {
    it("creates a new wallet and authorizes trial spending when no wallet exists", async () => {
      const userId = "test-user-id";
      const newWallet = UserWalletSeeder.create({ userId });
      const chainWallet = createChainWallet();
      const getOrCreateWallet = jest.fn().mockImplementation(async () => ({ wallet: newWallet, isNew: true }));
      const updateWalletById = jest.fn().mockImplementation(async () => newWallet);

      const di = setup({
        getOrCreateWallet,
        updateWalletById,
        enabledFeatures: [FeatureFlags.ANONYMOUS_FREE_TRIAL]
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(chainWallet);

      await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(getOrCreateWallet).toHaveBeenCalledWith({ userId });
      expect(managedUserWalletService.createAndAuthorizeTrialSpending).toHaveBeenCalledWith(di.resolve(ManagedSignerService), { addressIndex: newWallet.id });
      expect(updateWalletById).toHaveBeenCalledWith(
        newWallet.id,
        {
          address: chainWallet.address,
          deploymentAllowance: chainWallet.limits.deployment,
          feeAllowance: chainWallet.limits.fees
        },
        expect.any(Object)
      );
    });

    it("does not authorizes trial spending for existing wallet", async () => {
      const userId = "test-user-id";
      const existingWallet = UserWalletSeeder.create({ userId });
      const getOrCreateWallet = jest.fn().mockResolvedValue({ wallet: existingWallet, isNew: false });

      const di = setup({
        getOrCreateWallet,
        enabledFeatures: [FeatureFlags.ANONYMOUS_FREE_TRIAL]
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService);

      await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(getOrCreateWallet).toHaveBeenCalledWith({ userId });
      expect(managedUserWalletService.createAndAuthorizeTrialSpending).not.toHaveBeenCalled();
    });

    it("throws an error when cannot authorize trial spending and deletes user wallet", async () => {
      const userId = "test-user-id";
      const newWallet = UserWalletSeeder.create({ userId });
      const getOrCreateWallet = jest.fn().mockImplementation(async () => ({ wallet: newWallet, isNew: true }));
      const deleteWalletById = jest.fn().mockImplementation(async () => null);

      const di = setup({
        getOrCreateWallet,
        deleteWalletById,
        enabledFeatures: [FeatureFlags.ANONYMOUS_FREE_TRIAL]
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeTrialSpending.mockRejectedValue(new Error("Failed to authorize trial"));

      await expect(di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId)).rejects.toThrow("Failed to authorize trial");
      expect(managedUserWalletService.createAndAuthorizeTrialSpending).toHaveBeenCalledWith(di.resolve(ManagedSignerService), { addressIndex: newWallet.id });
      expect(deleteWalletById).toHaveBeenCalledWith(newWallet.id);
      expect(di.resolve(DomainEventsService).publish).not.toHaveBeenCalled();
    });

    it(`publishes "TrialStarted" event when ANONYMOUS_FREE_TRIAL is disabled`, async () => {
      const userId = "test-user-id";
      const newWallet = UserWalletSeeder.create({ userId });
      const chainWallet = createChainWallet();
      const getOrCreateWallet = jest.fn().mockImplementation(async () => ({ wallet: newWallet, isNew: true }));
      const updateWalletById = jest.fn().mockImplementation(async () => newWallet);

      const di = setup({
        userId,
        getOrCreateWallet,
        updateWalletById,
        enabledFeatures: []
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(chainWallet);

      await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(di.resolve(DomainEventsService).publish).toHaveBeenCalledWith(new TrialStarted({ userId }));
    });
  });

  function setup(input?: {
    getOrCreateWallet?: UserWalletRepository["getOrCreate"];
    updateWalletById?: UserWalletRepository["updateById"];
    deleteWalletById?: UserWalletRepository["deleteById"];
    userId?: string;
    enabledFeatures?: FeatureFlagValue[];
  }) {
    const di = container.createChildContainer();
    di.registerInstance(TYPE_REGISTRY, new Registry());
    di.registerInstance(ManagedUserWalletService, mock<ManagedUserWalletService>());
    di.registerInstance(
      UserWalletRepository,
      mock<UserWalletRepository>({
        getOrCreate: input?.getOrCreateWallet,
        updateById: input?.updateWalletById,
        deleteById: input?.deleteWalletById ?? jest.fn(),
        accessibleBy() {
          return this as unknown as UserWalletRepository;
        },
        toPublic: value => ({
          ...value,
          isTrialing: !!value.isTrialing
        })
      }) as unknown as UserWalletRepository
    );
    di.registerInstance(
      AuthService,
      mock<AuthService>({
        ability: {},
        currentUser: UserSeeder.create({ id: input?.userId })
      })
    );
    di.registerInstance(DomainEventsService, mock<DomainEventsService>());
    di.registerInstance(
      FeatureFlagsService,
      mock<FeatureFlagsService>({
        isEnabled: jest.fn(flag => !!input?.enabledFeatures?.includes(flag))
      })
    );
    di.registerInstance(
      ProviderJwtTokenService,
      mock<ProviderJwtTokenService>({
        generateJwtToken: jest.fn().mockResolvedValue("mock-jwt-token")
      })
    );
    di.registerInstance(ManagedSignerService, mock<ManagedSignerService>());

    container.clearInstances();

    return di;
  }
});
