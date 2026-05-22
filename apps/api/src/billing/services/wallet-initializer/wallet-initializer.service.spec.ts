import { Registry } from "@cosmjs/proto-signing";
import { container } from "tsyringe";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import { TrialStarted } from "@src/billing/events/trial-started";
import { BILLING_CONFIG, type BillingConfig } from "@src/billing/providers/config.provider";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { LoggerService } from "@src/core/providers/logging.provider";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { ProviderJwtTokenService } from "@src/provider/services/provider-jwt-token/provider-jwt-token.service";
import { UserWalletRepository } from "../../repositories/user-wallet/user-wallet.repository";
import { ManagedSignerService } from "../managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";
import { WalletInitializerService } from "./wallet-initializer.service";

import { createChainWallet } from "@test/seeders/chain-wallet.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(WalletInitializerService.name, () => {
  describe("initializeAndGrantTrialLimits", () => {
    it("creates a new wallet and authorizes trial spending when no wallet exists", async () => {
      const userId = "test-user-id";
      const newWallet = createUserWallet({ userId });
      const chainWallet = createChainWallet();
      const getOrCreateWallet = jest.fn().mockImplementation(async () => ({ wallet: newWallet, isNew: true }));
      const updateWalletById = jest.fn().mockImplementation(async () => newWallet);

      const di = setup({
        getOrCreateWallet,
        updateWalletById
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
          feeAllowance: chainWallet.limits.fees,
          status: "ready"
        },
        expect.any(Object)
      );
    });

    it("does not authorizes trial spending for existing wallet", async () => {
      const userId = "test-user-id";
      const existingWallet = createUserWallet({ userId });
      const getOrCreateWallet = jest.fn().mockResolvedValue({ wallet: existingWallet, isNew: false });

      const di = setup({
        getOrCreateWallet
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService);

      await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(getOrCreateWallet).toHaveBeenCalledWith({ userId });
      expect(managedUserWalletService.createAndAuthorizeTrialSpending).not.toHaveBeenCalled();
    });

    it("throws an error when cannot authorize trial spending and deletes user wallet", async () => {
      const userId = "test-user-id";
      const newWallet = createUserWallet({ userId });
      const getOrCreateWallet = jest.fn().mockImplementation(async () => ({ wallet: newWallet, isNew: true }));
      const deleteWalletById = jest.fn().mockImplementation(async () => null);

      const di = setup({
        getOrCreateWallet,
        deleteWalletById
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeTrialSpending.mockRejectedValue(new Error("Failed to authorize trial"));

      await expect(di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId)).rejects.toThrow("Failed to authorize trial");
      expect(managedUserWalletService.createAndAuthorizeTrialSpending).toHaveBeenCalledWith(di.resolve(ManagedSignerService), { addressIndex: newWallet.id });
      expect(deleteWalletById).toHaveBeenCalledWith(newWallet.id);
      expect(di.resolve(DomainEventsService).publish).not.toHaveBeenCalled();
    });

    it(`publishes "TrialStarted" event`, async () => {
      const userId = "test-user-id";
      const newWallet = createUserWallet({ userId });
      const chainWallet = createChainWallet();
      const getOrCreateWallet = jest.fn().mockImplementation(async () => ({ wallet: newWallet, isNew: true }));
      const updateWalletById = jest.fn().mockImplementation(async () => newWallet);

      const di = setup({
        userId,
        getOrCreateWallet,
        updateWalletById
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(chainWallet);

      await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(di.resolve(DomainEventsService).publish).toHaveBeenCalledWith(new TrialStarted({ userId }));
    });
  });

  describe("initializeForOnboarding", () => {
    it("writes status='pending' before granting, then flips to 'ready' on success", async () => {
      const userId = "user-1";
      const pendingWallet = createUserWallet({ id: 1, userId, status: "pending" });
      const chainWallet = createChainWallet();
      const readyWallet = createUserWallet({
        id: 1,
        userId,
        status: "ready",
        address: chainWallet.address,
        deploymentAllowance: 50000,
        feeAllowance: 1000000
      });
      const createWallet = jest.fn().mockResolvedValue(pendingWallet);
      const updateWalletById = jest.fn().mockResolvedValue(readyWallet);
      const updateWalletStatus = jest.fn().mockResolvedValue(undefined);

      const di = setup({
        createWallet,
        updateWalletById,
        updateWalletStatus,
        billingConfig: { FEE_ALLOWANCE_REFILL_AMOUNT: 1000000 } as BillingConfig
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeOnboardingGrant.mockResolvedValue({
        address: chainWallet.address,
        limits: { deployment: 50000, fees: 1000000 }
      });

      const result = await di.resolve(WalletInitializerService).initializeForOnboarding(userId);

      expect(createWallet).toHaveBeenCalledWith({ userId, status: "pending" });
      expect(managedUserWalletService.createAndAuthorizeOnboardingGrant).toHaveBeenCalledWith(di.resolve(ManagedSignerService), {
        addressIndex: pendingWallet.id,
        deploymentAllowance: 50000,
        feeAllowance: 1000000
      });
      expect(updateWalletById).toHaveBeenCalledWith(
        pendingWallet.id,
        expect.objectContaining({ status: "ready", address: chainWallet.address, deploymentAllowance: 50000, feeAllowance: 1000000 }),
        expect.any(Object)
      );
      expect(updateWalletStatus).not.toHaveBeenCalled();
      expect(result.status).toBe("ready");
    });

    it("flips status to 'failed' and rethrows when chain work fails", async () => {
      const userId = "user-1";
      const pendingWallet = createUserWallet({ id: 1, userId, status: "pending" });
      const createWallet = jest.fn().mockResolvedValue(pendingWallet);
      const updateWalletStatus = jest.fn().mockResolvedValue(undefined);

      const di = setup({
        createWallet,
        updateWalletStatus
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeOnboardingGrant.mockRejectedValue(new Error("chain failed"));

      await expect(di.resolve(WalletInitializerService).initializeForOnboarding(userId)).rejects.toThrow("chain failed");

      expect(updateWalletStatus).toHaveBeenCalledWith(pendingWallet.id, "failed");
    });
  });

  function setup(input?: {
    getOrCreateWallet?: UserWalletRepository["getOrCreate"];
    createWallet?: UserWalletRepository["create"];
    updateWalletById?: UserWalletRepository["updateById"];
    updateWalletStatus?: UserWalletRepository["updateStatus"];
    deleteWalletById?: UserWalletRepository["deleteById"];
    userId?: string;
    billingConfig?: BillingConfig;
  }) {
    const di = container.createChildContainer();
    di.registerInstance(TYPE_REGISTRY, new Registry());
    di.registerInstance(ManagedUserWalletService, mock<ManagedUserWalletService>());
    di.registerInstance(
      UserWalletRepository,
      mock<UserWalletRepository>({
        getOrCreate: input?.getOrCreateWallet,
        create: input?.createWallet,
        updateById: input?.updateWalletById,
        updateStatus: input?.updateWalletStatus ?? jest.fn(),
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
        currentUser: createUser({ id: input?.userId })
      })
    );
    di.registerInstance(DomainEventsService, mock<DomainEventsService>());
    di.registerInstance(
      ProviderJwtTokenService,
      mock<ProviderJwtTokenService>({
        generateJwtToken: jest.fn().mockResolvedValue("mock-jwt-token")
      })
    );
    di.registerInstance(ManagedSignerService, mock<ManagedSignerService>());
    di.registerInstance(LoggerService, mock<LoggerService>());
    di.registerInstance(BILLING_CONFIG, input?.billingConfig ?? ({ FEE_ALLOWANCE_REFILL_AMOUNT: 1000000 } as BillingConfig));

    container.clearInstances();

    return di;
  }
});
