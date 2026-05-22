import type { MongoAbility } from "@casl/ability";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { container as rootContainer } from "tsyringe";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import { type UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService, WalletInitializerService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { WalletController } from "./wallet.controller";

import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe("WalletController", () => {
  it("forbids starting a trial for a user with not verified email", async () => {
    const user = createUser({
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
    const user = createUser({
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
    const user = createUser({
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

  it("forbids starting a trial for a user with duplicate fingerprint", async () => {
    const user = createUser({
      emailVerified: true,
      stripeCustomerId: faker.string.uuid(),
      lastFingerprint: "duplicate-fingerprint"
    });
    const container = setup({
      user,
      hasDuplicateFingerprint: true,
      hasPaymentMethods: true
    });
    const walletController = container.resolve(WalletController);
    await expect(() =>
      walletController.create({
        data: {
          userId: user.id
        }
      })
    ).rejects.toThrow(/Unable to start trial/i);
    expect(container.resolve(WalletInitializerService).initializeAndGrantTrialLimits).not.toHaveBeenCalled();
  });

  it("allows starting a trial when user has no fingerprint", async () => {
    const user = createUser({
      emailVerified: true,
      stripeCustomerId: faker.string.uuid(),
      lastFingerprint: null
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

  it("creates a wallet for a user with all valid requirements", async () => {
    const user = createUser({
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
    const user = createUser({
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
        denom: "uakt",
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
    const user = createUser({
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

  describe("getWallets", () => {
    it("returns wallets with denom from billing config", async () => {
      const userId = faker.string.uuid();
      const wallets = [
        {
          id: faker.string.uuid(),
          userId,
          address: faker.string.alphanumeric(44),
          creditAmount: 100,
          isTrialing: true,
          createdAt: new Date()
        },
        {
          id: faker.string.uuid(),
          userId,
          address: faker.string.alphanumeric(44),
          creditAmount: 200,
          isTrialing: false,
          createdAt: new Date()
        }
      ];
      const container = setup({
        user: createUser(),
        wallets
      });
      const walletController = container.resolve(WalletController);

      const result = await walletController.getWallets({ userId });

      expect(result).toEqual({
        data: wallets.map(wallet => ({ ...wallet, denom: "uakt" }))
      });
      expect(container.resolve(WalletReaderService).getWallets).toHaveBeenCalledWith({ userId });
    });

    it("returns empty list when no wallets found", async () => {
      const userId = faker.string.uuid();
      const container = setup({
        user: createUser(),
        wallets: []
      });
      const walletController = container.resolve(WalletController);

      const result = await walletController.getWallets({ userId });

      expect(result).toEqual({ data: [] });
    });
  });

  it("handles stripe error in controller", async () => {
    const user = createUser({
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

  describe("signTx — wallet readiness gate (console_onboarding_redesign FF)", () => {
    it("returns 503 with Retry-After header when wallet status is 'pending' and FF is on", async () => {
      const user = createUser();
      const container = setup({
        user,
        userWallet: createUserWallet({ userId: user.id, status: "pending" }),
        featureFlagEnabled: flag => flag === FeatureFlags.CONSOLE_ONBOARDING_REDESIGN
      });
      const walletController = container.resolve(WalletController);

      await expect(
        walletController.signTx({ data: { userId: user.id, messages: [{ typeUrl: "/akash.cert.v1.MsgCreateCertificate", value: "" }] } })
      ).rejects.toMatchObject({
        status: 503,
        headers: { "Retry-After": "2" }
      });
      expect(container.resolve(ManagedSignerService).executeDerivedEncodedTxByUserId).not.toHaveBeenCalled();
    });

    it("returns 500 with wallet_init_failed code when wallet status is 'failed' and FF is on", async () => {
      const user = createUser();
      const container = setup({
        user,
        userWallet: createUserWallet({ userId: user.id, status: "failed" }),
        featureFlagEnabled: true
      });
      const walletController = container.resolve(WalletController);

      await expect(
        walletController.signTx({ data: { userId: user.id, messages: [{ typeUrl: "/akash.cert.v1.MsgCreateCertificate", value: "" }] } })
      ).rejects.toMatchObject({
        status: 500,
        errorCode: "wallet_init_failed"
      });
      expect(container.resolve(ManagedSignerService).executeDerivedEncodedTxByUserId).not.toHaveBeenCalled();
    });

    it("proceeds with signing when wallet status is 'ready' and FF is on", async () => {
      const user = createUser();
      const container = setup({
        user,
        userWallet: createUserWallet({ userId: user.id, status: "ready" }),
        featureFlagEnabled: true
      });
      const walletController = container.resolve(WalletController);

      await walletController.signTx({ data: { userId: user.id, messages: [{ typeUrl: "/akash.cert.v1.MsgCreateCertificate", value: "" }] } });

      expect(container.resolve(ManagedSignerService).executeDerivedEncodedTxByUserId).toHaveBeenCalledWith(user.id, expect.any(Array));
    });

    it("does not check wallet status when FF is off", async () => {
      const user = createUser();
      const container = setup({
        user,
        featureFlagEnabled: false
      });
      const walletController = container.resolve(WalletController);

      await walletController.signTx({ data: { userId: user.id, messages: [{ typeUrl: "/akash.cert.v1.MsgCreateCertificate", value: "" }] } });

      expect(container.resolve(UserWalletRepository).findOneByUserId).not.toHaveBeenCalled();
      expect(container.resolve(ManagedSignerService).executeDerivedEncodedTxByUserId).toHaveBeenCalledWith(user.id, expect.any(Array));
    });
  });

  function setup(input?: {
    user?: UserOutput;
    hasPaymentMethods?: boolean;
    hasDuplicateTrialAccount?: boolean;
    hasDuplicateFingerprint?: boolean;
    requires3DS?: boolean;
    validationFails?: boolean;
    stripeError?: boolean;
    wallets?: UserWalletPublicOutput[];
    userWallet?: ReturnType<typeof createUserWallet>;
    featureFlagEnabled?: boolean | ((flag: string) => boolean);
  }) {
    rootContainer.register(AuthService, {
      useValue: mock<AuthService>({
        isAuthenticated: true,
        ability: createMongoAbility<MongoAbility>([
          {
            action: "create",
            subject: "UserWallet"
          },
          {
            action: "sign",
            subject: "UserWallet"
          }
        ]),
        currentUser: input?.user || createUser()
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
    rootContainer.register(UserRepository, {
      useValue: mock<UserRepository>({
        findTrialUsersByFingerprint: jest.fn().mockResolvedValue(input?.hasDuplicateFingerprint ? [{ id: faker.string.uuid() }] : [])
      })
    });
    rootContainer.register(BillingConfigService, {
      useValue: mock<BillingConfigService>({
        get: jest.fn().mockReturnValue("uakt")
      })
    });
    rootContainer.register(ManagedSignerService, {
      useValue: mock<ManagedSignerService>()
    });
    rootContainer.register(RefillService, {
      useValue: mock<RefillService>()
    });
    rootContainer.register(WalletReaderService, {
      useValue: mock<WalletReaderService>({
        getWallets: jest.fn().mockResolvedValue(input?.wallets ?? [])
      })
    });
    rootContainer.register(BalancesService, {
      useValue: mock<BalancesService>()
    });
    const userWalletRepository = mock<UserWalletRepository>({
      findOneByUserId: jest.fn().mockResolvedValue(input?.userWallet)
    });
    rootContainer.register(UserWalletRepository, {
      useValue: userWalletRepository
    });

    const featureFlagImpl =
      typeof input?.featureFlagEnabled === "function"
        ? input.featureFlagEnabled
        : () => (input?.featureFlagEnabled === undefined ? true : Boolean(input.featureFlagEnabled));
    const featureFlagsService = mock<FeatureFlagsService>({
      isEnabled: jest.fn().mockImplementation(featureFlagImpl)
    });
    rootContainer.register(FeatureFlagsService, {
      useValue: featureFlagsService
    });

    return rootContainer;
  }
});
