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
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ProviderJwtTokenService } from "@src/provider/services/provider-jwt-token/provider-jwt-token.service";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { UserWalletRepository } from "../../repositories/user-wallet/user-wallet.repository";
import { ManagedSignerService } from "../managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";
import { StripeService } from "../stripe/stripe.service";
import { StripeErrorService } from "../stripe-error/stripe-error.service";
import { WalletInitializerService } from "./wallet-initializer.service";

import { createChainWallet } from "@test/seeders/chain-wallet.seeder";
import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(WalletInitializerService.name, () => {
  describe("startTrial", () => {
    it("throws 400 when email is not verified", async () => {
      const user = createUser({ emailVerified: false });
      const di = setup({ user });

      await expect(di.resolve(WalletInitializerService).startTrial(user.id)).rejects.toThrow(/email not verified/i);
    });

    it("throws 400 when stripeCustomerId is missing", async () => {
      const user = createUser({ emailVerified: true, stripeCustomerId: null as unknown as string });
      const di = setup({ user });

      await expect(di.resolve(WalletInitializerService).startTrial(user.id)).rejects.toThrow(/stripe customer id not found/i);
    });

    it("throws 400 on duplicate fingerprint in production", async () => {
      const user = createUser({ emailVerified: true, stripeCustomerId: faker.string.uuid(), lastFingerprint: "fp" });
      const di = setup({ user, isProduction: true, hasDuplicateFingerprint: true });

      await expect(di.resolve(WalletInitializerService).startTrial(user.id)).rejects.toThrow(/Unable to start trial/i);
    });

    describe("when onboarding_redesign_v1 is OFF", () => {
      it("throws 400 when the user has no payment method", async () => {
        const user = createUser({ emailVerified: true, stripeCustomerId: faker.string.uuid() });
        const di = setup({ user, hasPaymentMethods: false });

        await expect(di.resolve(WalletInitializerService).startTrial(user.id)).rejects.toThrow(/payment method/i);
      });

      it("throws 400 on duplicate trial account in production", async () => {
        const user = createUser({ emailVerified: true, stripeCustomerId: faker.string.uuid() });
        const di = setup({ user, hasPaymentMethods: true, hasDuplicateTrialAccount: true, isProduction: true });

        await expect(di.resolve(WalletInitializerService).startTrial(user.id)).rejects.toThrow(/already associated with another trial account/i);
      });

      it("returns a 3DS-required payload when Stripe says so", async () => {
        const user = createUser({ emailVerified: true, stripeCustomerId: faker.string.uuid() });
        const di = setup({ user, hasPaymentMethods: true, requires3DS: true });

        const result = await di.resolve(WalletInitializerService).startTrial(user.id);
        expect(result).toMatchObject({ requires3DS: true, clientSecret: "cs", paymentIntentId: "pi", paymentMethodId: "pm" });
      });

      it("calls initializeAndGrantTrialLimits on the happy path", async () => {
        const user = createUser({ emailVerified: true, stripeCustomerId: faker.string.uuid() });
        const newWallet = createUserWallet({ userId: user.id });
        const di = setup({
          user,
          hasPaymentMethods: true,
          getOrCreateWallet: vi.fn().mockResolvedValue({ wallet: newWallet, isNew: true }),
          updateWalletById: vi.fn().mockResolvedValue(newWallet)
        });
        const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
        managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(createChainWallet());

        await di.resolve(WalletInitializerService).startTrial(user.id);

        expect(managedUserWalletService.createAndAuthorizeTrialSpending).toHaveBeenCalled();
        expect(di.resolve(StripeService).validatePaymentMethodForTrial).toHaveBeenCalled();
      });
    });

    describe("when onboarding_redesign_v1 is ON", () => {
      it("skips payment-method validation and goes straight to wallet init", async () => {
        const user = createUser({ emailVerified: true, stripeCustomerId: faker.string.uuid() });
        const newWallet = createUserWallet({ userId: user.id });
        const di = setup({
          user,
          consoleOnboardingRedesign: true,
          hasPaymentMethods: false,
          getOrCreateWallet: vi.fn().mockResolvedValue({ wallet: newWallet, isNew: true }),
          updateWalletById: vi.fn().mockResolvedValue(newWallet)
        });
        const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
        managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(createChainWallet());

        await di.resolve(WalletInitializerService).startTrial(user.id);

        expect(di.resolve(StripeService).getPaymentMethods).not.toHaveBeenCalled();
        expect(di.resolve(StripeService).validatePaymentMethodForTrial).not.toHaveBeenCalled();
        expect(managedUserWalletService.createAndAuthorizeTrialSpending).toHaveBeenCalled();
      });

      it("still enforces the fingerprint anti-abuse check", async () => {
        const user = createUser({ emailVerified: true, stripeCustomerId: faker.string.uuid(), lastFingerprint: "fp" });
        const di = setup({ user, consoleOnboardingRedesign: true, isProduction: true, hasDuplicateFingerprint: true });

        await expect(di.resolve(WalletInitializerService).startTrial(user.id)).rejects.toThrow(/Unable to start trial/i);
      });

      it("does not require a stripeCustomerId", async () => {
        const user = createUser({ emailVerified: true, stripeCustomerId: null as unknown as string });
        const newWallet = createUserWallet({ userId: user.id });
        const di = setup({
          user,
          consoleOnboardingRedesign: true,
          getOrCreateWallet: vi.fn().mockResolvedValue({ wallet: newWallet, isNew: true }),
          updateWalletById: vi.fn().mockResolvedValue(newWallet)
        });
        const managedUserWalletService = di.resolve(ManagedUserWalletService) as MockProxy<ManagedUserWalletService>;
        managedUserWalletService.createAndAuthorizeTrialSpending.mockResolvedValue(createChainWallet());

        await expect(di.resolve(WalletInitializerService).startTrial(user.id)).resolves.toBeDefined();
        expect(managedUserWalletService.createAndAuthorizeTrialSpending).toHaveBeenCalled();
      });
    });
  });

  describe("initializeAndGrantTrialLimits", () => {
    it("creates a new wallet and authorizes trial spending when no wallet exists", async () => {
      const userId = "test-user-id";
      const newWallet = createUserWallet({ userId });
      const chainWallet = createChainWallet();
      const getOrCreateWallet = vi.fn().mockImplementation(async () => ({ wallet: newWallet, isNew: true }));
      const updateWalletById = vi.fn().mockImplementation(async () => newWallet);

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
          feeAllowance: chainWallet.limits.fees
        },
        expect.any(Object)
      );
    });

    it("does not authorizes trial spending for existing wallet", async () => {
      const userId = "test-user-id";
      const existingWallet = createUserWallet({ userId });
      const getOrCreateWallet = vi.fn().mockResolvedValue({ wallet: existingWallet, isNew: false });

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
      const getOrCreateWallet = vi.fn().mockImplementation(async () => ({ wallet: newWallet, isNew: true }));
      const deleteWalletById = vi.fn().mockImplementation(async () => null);

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
      const getOrCreateWallet = vi.fn().mockImplementation(async () => ({ wallet: newWallet, isNew: true }));
      const updateWalletById = vi.fn().mockImplementation(async () => newWallet);

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

  function setup(input?: {
    getOrCreateWallet?: UserWalletRepository["getOrCreate"];
    updateWalletById?: UserWalletRepository["updateById"];
    deleteWalletById?: UserWalletRepository["deleteById"];
    userId?: string;
    user?: UserOutput;
    isProduction?: boolean;
    hasPaymentMethods?: boolean;
    hasDuplicateTrialAccount?: boolean;
    hasDuplicateFingerprint?: boolean;
    requires3DS?: boolean;
    consoleOnboardingRedesign?: boolean;
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
        isEnabled: vi.fn(flag => {
          if (flag === FeatureFlags.ONBOARDING_REDESIGN_V1) return input?.consoleOnboardingRedesign ?? false;
          return true;
        })
      })
    );
    di.registerInstance(
      StripeService,
      mock<StripeService>({
        isProduction: input?.isProduction ?? false,
        getPaymentMethods: vi.fn(async () => {
          if (!input?.hasPaymentMethods) return [];
          return [{ ...generatePaymentMethod(), validated: true, isDefault: false }];
        }),
        hasDuplicateTrialAccount: vi.fn().mockResolvedValue(input?.hasDuplicateTrialAccount ?? false),
        validatePaymentMethodForTrial: vi
          .fn()
          .mockResolvedValue(
            input?.requires3DS
              ? { success: false, requires3DS: true, clientSecret: "cs", paymentIntentId: "pi", paymentMethodId: "pm" }
              : { success: true, requires3DS: false }
          )
      })
    );
    di.registerInstance(StripeErrorService, mock<StripeErrorService>({ isKnownError: vi.fn().mockReturnValue(false) }));
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
