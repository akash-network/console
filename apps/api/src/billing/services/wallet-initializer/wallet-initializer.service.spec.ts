import { Registry } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import { TrialStarted } from "@src/billing/events/trial-started";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ProviderJwtTokenService } from "@src/provider/services/provider-jwt-token/provider-jwt-token.service";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { UserWalletRepository } from "../../repositories/user-wallet/user-wallet.repository";
import { ManagedSignerService } from "../managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";
import { StripeService } from "../stripe/stripe.service";
import { WalletInitializerService } from "./wallet-initializer.service";

import { createChainWallet } from "@test/seeders/chain-wallet.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(WalletInitializerService.name, () => {
  describe("startTrial", () => {
    it("throws 400 when email is not verified", async () => {
      const user = createUser({ emailVerified: false });
      const di = setup({ user });

      await expect(di.resolve(WalletInitializerService).startTrial(user.id)).rejects.toThrow(/email not verified/i);
    });

    it("throws 400 on duplicate fingerprint in production", async () => {
      const user = createUser({ emailVerified: true, stripeCustomerId: faker.string.uuid(), lastFingerprint: "fp" });
      const di = setup({ user, isProduction: true, hasDuplicateFingerprint: true });

      await expect(di.resolve(WalletInitializerService).startTrial(user.id)).rejects.toThrow(/Unable to start trial/i);
    });

    it("goes straight to wallet init without requiring a payment method", async () => {
      const user = createUser({ emailVerified: true, stripeCustomerId: faker.string.uuid() });
      const newWallet = createUserWallet({ userId: user.id, activatedAt: null });
      const di = setup({
        user,
        getOrCreateWallet: vi.fn().mockResolvedValue({ wallet: newWallet, isNew: true }),
        claimActivation: vi.fn().mockResolvedValue({ ...newWallet, activatedAt: new Date() }),
        updateWalletById: vi.fn().mockResolvedValue(newWallet)
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(createChainWallet());

      await di.resolve(WalletInitializerService).startTrial(user.id);

      expect(di.resolve(StripeService).getPaymentMethods).not.toHaveBeenCalled();
      expect(managedUserWalletService.createAndAuthorizeTrialSpending).toHaveBeenCalled();
    });

    it("does not require a stripeCustomerId", async () => {
      const user = createUser({ emailVerified: true, stripeCustomerId: null as unknown as string });
      const newWallet = createUserWallet({ userId: user.id, activatedAt: null });
      const di = setup({
        user,
        getOrCreateWallet: vi.fn().mockResolvedValue({ wallet: newWallet, isNew: true }),
        claimActivation: vi.fn().mockResolvedValue({ ...newWallet, activatedAt: new Date() }),
        updateWalletById: vi.fn().mockResolvedValue(newWallet)
      });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(createChainWallet());

      await expect(di.resolve(WalletInitializerService).startTrial(user.id)).resolves.toBeDefined();
      expect(managedUserWalletService.createAndAuthorizeTrialSpending).toHaveBeenCalled();
    });
  });

  describe("initializeAndGrantTrialLimits", () => {
    it("derives and saves the address when the wallet is missing one", async () => {
      const userId = "test-user-id";
      const orphanWallet = createUserWallet({ userId, address: null as unknown as string, activatedAt: null });
      const derivedAddress = "akash1derived";
      const getOrCreateWallet = vi.fn().mockResolvedValue({ wallet: orphanWallet, isNew: true });
      const updateWalletById = vi.fn().mockImplementation(async (id, patch) => ({ ...orphanWallet, ...patch }));
      const claimActivation = vi.fn().mockResolvedValue({ ...orphanWallet, address: derivedAddress, activatedAt: new Date() });

      const di = setup({ getOrCreateWallet, updateWalletById, claimActivation });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createWallet.mockResolvedValue({ address: derivedAddress });
      managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(createChainWallet({ address: derivedAddress }));

      await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(managedUserWalletService.createWallet).toHaveBeenCalledWith({ addressIndex: orphanWallet.id });
      expect(updateWalletById).toHaveBeenCalledWith(orphanWallet.id, { address: derivedAddress }, { returning: true });
    });

    it("returns the current state without chain calls when the wallet is already activated", async () => {
      const userId = "test-user-id";
      const activatedWallet = createUserWallet({ userId, activatedAt: new Date() });
      const getOrCreateWallet = vi.fn().mockResolvedValue({ wallet: activatedWallet, isNew: false });

      const di = setup({ getOrCreateWallet });
      const managedUserWalletService = di.resolve(ManagedUserWalletService);

      const result = await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(result.address).toBe(activatedWallet.address);
      expect(managedUserWalletService.createAndAuthorizeTrialSpending).not.toHaveBeenCalled();
      expect(di.resolve(DomainEventsService).publish).not.toHaveBeenCalled();
    });

    it("claims activation, authorizes trial spending and saves the granted allowances", async () => {
      const userId = "test-user-id";
      const wallet = createUserWallet({ userId, activatedAt: null });
      const chainWallet = createChainWallet();
      const getOrCreateWallet = vi.fn().mockResolvedValue({ wallet, isNew: false });
      const claimActivation = vi.fn().mockResolvedValue({ ...wallet, activatedAt: new Date() });
      const updateWalletById = vi.fn().mockImplementation(async (id, patch) => ({ ...wallet, ...patch }));

      const di = setup({ getOrCreateWallet, claimActivation, updateWalletById });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(chainWallet);

      await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(claimActivation).toHaveBeenCalledWith(wallet.id);
      expect(managedUserWalletService.createAndAuthorizeTrialSpending).toHaveBeenCalledWith(di.resolve(ManagedSignerService), { addressIndex: wallet.id });
      expect(updateWalletById).toHaveBeenCalledWith(
        wallet.id,
        {
          deploymentAllowance: chainWallet.limits.deployment,
          feeAllowance: chainWallet.limits.fees
        },
        { returning: true }
      );
    });

    it("throws 409 when activation is already claimed by a concurrent request", async () => {
      const userId = "test-user-id";
      const wallet = createUserWallet({ userId, activatedAt: null });
      const getOrCreateWallet = vi.fn().mockResolvedValue({ wallet, isNew: false });
      const claimActivation = vi.fn().mockResolvedValue(undefined);

      const di = setup({ getOrCreateWallet, claimActivation });
      const managedUserWalletService = di.resolve(ManagedUserWalletService);

      await expect(di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId)).rejects.toMatchObject({ status: 409 });
      expect(managedUserWalletService.createAndAuthorizeTrialSpending).not.toHaveBeenCalled();
      expect(di.resolve(DomainEventsService).publish).not.toHaveBeenCalled();
    });

    it("unsets activation and keeps the wallet when authorization fails", async () => {
      const userId = "test-user-id";
      const wallet = createUserWallet({ userId, activatedAt: null });
      const getOrCreateWallet = vi.fn().mockResolvedValue({ wallet, isNew: false });
      const claimActivation = vi.fn().mockResolvedValue({ ...wallet, activatedAt: new Date() });
      const updateWalletById = vi.fn().mockImplementation(async (id, patch) => ({ ...wallet, ...patch }));
      const deleteWalletById = vi.fn();

      const di = setup({ getOrCreateWallet, claimActivation, updateWalletById, deleteWalletById });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeTrialSpending.mockRejectedValue(new Error("Failed to authorize trial"));

      await expect(di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId)).rejects.toThrow("Failed to authorize trial");

      expect(updateWalletById).toHaveBeenCalledWith(wallet.id, { activatedAt: null });
      expect(deleteWalletById).not.toHaveBeenCalled();
      expect(di.resolve(DomainEventsService).publish).not.toHaveBeenCalled();
    });

    it(`publishes "TrialStarted" event on successful activation`, async () => {
      const userId = "test-user-id";
      const wallet = createUserWallet({ userId, activatedAt: null });
      const chainWallet = createChainWallet();
      const getOrCreateWallet = vi.fn().mockResolvedValue({ wallet, isNew: false });
      const claimActivation = vi.fn().mockResolvedValue({ ...wallet, activatedAt: new Date() });
      const updateWalletById = vi.fn().mockImplementation(async (id, patch) => ({ ...wallet, ...patch }));

      const di = setup({ userId, getOrCreateWallet, claimActivation, updateWalletById });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(chainWallet);

      await di.resolve(WalletInitializerService).initializeAndGrantTrialLimits(userId);

      expect(di.resolve(DomainEventsService).publish).toHaveBeenCalledWith(new TrialStarted({ userId }));
    });
  });

  describe("ensureWallet", () => {
    it("creates the wallet and saves a derived address when none exists", async () => {
      const userId = "test-user-id";
      const bareWallet = createUserWallet({ userId, address: null as unknown as string, activatedAt: null });
      const derivedAddress = "akash1derived";
      const getOrCreateWallet = vi.fn().mockResolvedValue({ wallet: bareWallet, isNew: true });
      const updateWalletById = vi.fn().mockImplementation(async (id, patch) => ({ ...bareWallet, ...patch }));

      const di = setup({ getOrCreateWallet, updateWalletById });
      const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
      managedUserWalletService.createWallet.mockResolvedValue({ address: derivedAddress });

      const result = await di.resolve(WalletInitializerService).ensureWallet(userId);

      expect(getOrCreateWallet).toHaveBeenCalledWith({ userId });
      expect(managedUserWalletService.createWallet).toHaveBeenCalledWith({ addressIndex: bareWallet.id });
      expect(updateWalletById).toHaveBeenCalledWith(bareWallet.id, { address: derivedAddress }, { returning: true });
      expect(result.address).toBe(derivedAddress);
    });

    it("returns the existing wallet without deriving an address again", async () => {
      const userId = "test-user-id";
      const existingWallet = createUserWallet({ userId });
      const getOrCreateWallet = vi.fn().mockResolvedValue({ wallet: existingWallet, isNew: false });
      const updateWalletById = vi.fn();

      const di = setup({ getOrCreateWallet, updateWalletById });
      const managedUserWalletService = di.resolve(ManagedUserWalletService);

      const result = await di.resolve(WalletInitializerService).ensureWallet(userId);

      expect(managedUserWalletService.createWallet).not.toHaveBeenCalled();
      expect(updateWalletById).not.toHaveBeenCalled();
      expect(result).toEqual(existingWallet);
    });
  });

  function setup(input?: {
    getOrCreateWallet?: UserWalletRepository["getOrCreate"];
    updateWalletById?: UserWalletRepository["updateById"];
    deleteWalletById?: UserWalletRepository["deleteById"];
    claimActivation?: UserWalletRepository["claimActivation"];
    userId?: string;
    user?: UserOutput;
    isProduction?: boolean;
    hasDuplicateFingerprint?: boolean;
  }) {
    const di = container.createChildContainer();
    di.registerInstance(TYPE_REGISTRY, new Registry());
    di.registerInstance(ManagedUserWalletService, mock<ManagedUserWalletService>());
    di.registerInstance(
      UserWalletRepository,
      mock<UserWalletRepository>({
        getOrCreate: input?.getOrCreateWallet,
        updateById: input?.updateWalletById,
        deleteById: input?.deleteWalletById ?? vi.fn(),
        claimActivation: input?.claimActivation,
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
        currentUser: input?.user ?? createUser({ id: input?.userId })
      })
    );
    di.registerInstance(DomainEventsService, mock<DomainEventsService>());
    di.registerInstance(
      ProviderJwtTokenService,
      mock<ProviderJwtTokenService>({
        generateJwtToken: vi.fn().mockResolvedValue("mock-jwt-token")
      })
    );
    di.registerInstance(ManagedSignerService, mock<ManagedSignerService>());

    di.registerInstance(
      FeatureFlagsService,
      mock<FeatureFlagsService>({
        isEnabled: vi.fn(() => true)
      })
    );
    di.registerInstance(
      StripeService,
      mock<StripeService>({
        isProduction: input?.isProduction ?? false,
        getPaymentMethods: vi.fn(async () => [])
      })
    );
    di.registerInstance(
      UserRepository,
      mock<UserRepository>({
        findTrialUsersByFingerprint: vi.fn().mockResolvedValue(input?.hasDuplicateFingerprint ? [{ id: faker.string.uuid() }] : [])
      })
    );

    container.clearInstances();

    return di;
  }
});
