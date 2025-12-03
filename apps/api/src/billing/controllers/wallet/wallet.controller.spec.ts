import type { MongoAbility } from "@casl/ability";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";
import { container as rootContainer } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { WalletInitializerService } from "@src/billing/services";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { UserOutput } from "@src/user/repositories";
import { WalletController } from "./wallet.controller";

import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";

describe("WalletController", () => {
  describe("when ANONYMOUS_FREE_TRIAL is enabled", () => {
    it("creates a wallet for user with not verified email", async () => {
      const user = UserSeeder.create({
        emailVerified: false
      });
      const container = setup({
        enabledFeatures: [FeatureFlags.ANONYMOUS_FREE_TRIAL],
        user
      });
      const walletController = container.resolve(WalletController);
      await walletController.create({
        data: {
          userId: user.id
        }
      });
      expect(container.resolve(WalletInitializerService).initializeAndGrantTrialLimits).toHaveBeenCalledWith(user.id);
    });

    it("creates a wallet for a user without configured payments methods", async () => {
      const user = UserSeeder.create({
        emailVerified: true,
        stripeCustomerId: null
      });
      const container = setup({
        enabledFeatures: [FeatureFlags.ANONYMOUS_FREE_TRIAL],
        user
      });
      const walletController = container.resolve(WalletController);
      await walletController.create({
        data: {
          userId: user.id
        }
      });
      expect(container.resolve(WalletInitializerService).initializeAndGrantTrialLimits).toHaveBeenCalledWith(user.id);
    });
  });

  describe("when ANONYMOUS_FREE_TRIAL is disabled", () => {
    it("forbids starting a trial for a user with not verified email", async () => {
      const user = UserSeeder.create({
        emailVerified: false
      });
      const container = setup({
        user
      });
      const walletController = container.resolve(WalletController);
      await expect(() =>
        walletController.create({
          data: {
            userId: user.id
          }
        })
      ).rejects.toThrow(/email not verified/i);
      expect(container.resolve(WalletInitializerService).initializeAndGrantTrialLimits).not.toHaveBeenCalled();
    });

    it("forbids starting a trial for a user without configured payments methods", async () => {
      const user = UserSeeder.create({
        emailVerified: true,
        stripeCustomerId: faker.string.uuid()
      });
      const container = setup({
        user,
        hasPaymentMethods: false
      });
      const walletController = container.resolve(WalletController);
      await expect(() =>
        walletController.create({
          data: {
            userId: user.id
          }
        })
      ).rejects.toThrow(/You must have a payment method to start a trial/i);
      expect(container.resolve(WalletInitializerService).initializeAndGrantTrialLimits).not.toHaveBeenCalled();
    });

    it("forbids starting a trial for a user with duplicate trial account", async () => {
      const user = UserSeeder.create({
        emailVerified: true,
        stripeCustomerId: faker.string.uuid()
      });
      const container = setup({
        user,
        hasDuplicateTrialAccount: true,
        hasPaymentMethods: true
      });
      const walletController = container.resolve(WalletController);
      await expect(() =>
        walletController.create({
          data: {
            userId: user.id
          }
        })
      ).rejects.toThrow(/associated with another trial account/i);
      expect(container.resolve(WalletInitializerService).initializeAndGrantTrialLimits).not.toHaveBeenCalled();
    });

    it("creates a wallet for a user with all valid requirements", async () => {
      const user = UserSeeder.create({
        emailVerified: true,
        stripeCustomerId: faker.string.uuid()
      });
      const container = setup({
        user,
        hasPaymentMethods: true,
        hasDuplicateTrialAccount: false
      });
      const walletController = container.resolve(WalletController);
      await walletController.create({
        data: {
          userId: user.id
        }
      });
      expect(container.resolve(WalletInitializerService).initializeAndGrantTrialLimits).toHaveBeenCalledWith(user.id);
    });

    it("handles 3DS required scenario in controller", async () => {
      const user = UserSeeder.create({
        emailVerified: true,
        stripeCustomerId: faker.string.uuid()
      });
      const container = setup({
        user,
        hasPaymentMethods: true,
        hasDuplicateTrialAccount: false,
        requires3DS: true
      });
      const walletController = container.resolve(WalletController);
      const result = await walletController.create({
        data: {
          userId: user.id
        }
      });

      expect(result).toEqual({
        data: {
          id: null,
          userId: user.id,
          address: null,
          creditAmount: 0,
          isTrialing: false,
          createdAt: null,
          requires3DS: true,
          clientSecret: "test_client_secret",
          paymentIntentId: "test_payment_intent_id",
          paymentMethodId: "test_payment_method_id"
        }
      });
      expect(container.resolve(WalletInitializerService).initializeAndGrantTrialLimits).not.toHaveBeenCalled();
    });

    it("handles validation failure in controller", async () => {
      const user = UserSeeder.create({
        emailVerified: true,
        stripeCustomerId: faker.string.uuid()
      });
      const container = setup({
        user,
        hasPaymentMethods: true,
        hasDuplicateTrialAccount: false,
        validationFails: true
      });
      const walletController = container.resolve(WalletController);

      await expect(() =>
        walletController.create({
          data: {
            userId: user.id
          }
        })
      ).rejects.toThrow("Card validation failed");
      expect(container.resolve(WalletInitializerService).initializeAndGrantTrialLimits).not.toHaveBeenCalled();
    });

    it("handles stripe error in controller", async () => {
      const user = UserSeeder.create({
        emailVerified: true,
        stripeCustomerId: faker.string.uuid()
      });
      const container = setup({
        user,
        hasPaymentMethods: true,
        hasDuplicateTrialAccount: false,
        stripeError: true
      });
      const walletController = container.resolve(WalletController);

      await expect(() =>
        walletController.create({
          data: {
            userId: user.id
          }
        })
      ).rejects.toThrow("Stripe error occurred");
      expect(container.resolve(WalletInitializerService).initializeAndGrantTrialLimits).not.toHaveBeenCalled();
    });
  });

  function setup(input?: {
    user?: UserOutput;
    enabledFeatures?: FeatureFlagValue[];
    hasPaymentMethods?: boolean;
    hasDuplicateTrialAccount?: boolean;
    requires3DS?: boolean;
    validationFails?: boolean;
    stripeError?: boolean;
  }) {
    rootContainer.register(AuthService, {
      useValue: mock<AuthService>({
        ability: createMongoAbility<MongoAbility>([
          {
            action: "create",
            subject: "UserWallet"
          }
        ]),
        currentUser: input?.user || UserSeeder.create()
      })
    });
    rootContainer.register(FeatureFlagsService, {
      useValue: mock<FeatureFlagsService>({
        isEnabled: jest.fn().mockImplementation(flag => !!input?.enabledFeatures?.includes(flag))
      })
    });
    rootContainer.register(WalletInitializerService, {
      useValue: mock<WalletInitializerService>()
    });
    rootContainer.register(StripeService, {
      useValue: mock<StripeService>({
        isProduction: true,
        getPaymentMethods: jest.fn(async () => {
          if (!input?.hasPaymentMethods) return [];
          return [{ ...generatePaymentMethod(), validated: true, isDefault: false }];
        }),
        hasDuplicateTrialAccount: jest.fn().mockResolvedValue(input?.hasDuplicateTrialAccount ?? false),
        validatePaymentMethodForTrial: jest.fn().mockImplementation(() => {
          if (input?.validationFails) {
            throw new Error("Card validation failed");
          }
          if (input?.stripeError) {
            throw new Error("Stripe error occurred");
          }
          if (input?.requires3DS) {
            return Promise.resolve({
              success: false,
              requires3DS: true,
              clientSecret: "test_client_secret",
              paymentIntentId: "test_payment_intent_id",
              paymentMethodId: "test_payment_method_id"
            });
          }
          return Promise.resolve({
            success: true,
            requires3DS: false
          });
        })
      })
    });

    return rootContainer;
  }
});
