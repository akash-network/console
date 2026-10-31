import type { MongoAbility } from "@casl/ability";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { container as rootContainer } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import { type UserWalletPublicOutput, UserWalletRepository, type WalletInitialized } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import { WalletChainReaderService } from "@src/billing/services/wallet-chain-reader/wallet-chain-reader.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { UserOutput } from "@src/user/repositories";
import { WalletController } from "./wallet.controller";

import { createUser } from "@test/seeders/user.seeder";
import { createInitializedUserWallet } from "@test/seeders/user-wallet.seeder";

describe("WalletController", () => {
  describe("getWallets", () => {
    it("returns wallets with denom from billing config", async () => {
      const userId = faker.string.uuid();
      const wallets = [
        {
          id: faker.number.int(),
          userId,
          address: faker.string.alphanumeric(44),
          creditAmount: 100,
          isTrialing: true,
          trialEndsAt: faker.date.future(),
          trialDurationDays: 30,
          createdAt: new Date()
        },
        {
          id: faker.number.int(),
          userId,
          address: faker.string.alphanumeric(44),
          creditAmount: 200,
          isTrialing: false,
          trialEndsAt: null,
          trialDurationDays: null,
          createdAt: new Date()
        }
      ];
      const container = setup({ user: createUser(), wallets });
      const walletController = container.resolve(WalletController);

      const result = await walletController.getWallets({ userId });

      expect(result).toEqual({ data: wallets.map(wallet => ({ ...wallet, denom: "uakt", topUpMinAmountUsd: wallet.isTrialing ? 100 : 20 })) });
      expect(container.resolve(WalletReaderService).getWallets).toHaveBeenCalledWith({ userId });
    });

    it("returns empty list when no wallets found", async () => {
      const userId = faker.string.uuid();
      const container = setup({ user: createUser(), wallets: [] });
      const walletController = container.resolve(WalletController);

      const result = await walletController.getWallets({ userId });

      expect(result).toEqual({ data: [] });
    });
  });

  describe("getWalletBalances", () => {
    it("reads the balances of the wallet the current user can read", async () => {
      const user = createUser();
      const wallet = createInitializedUserWallet({ userId: user.id });
      const balances = { balances: [{ denom: "uact", amount: "10" }], deploymentGrants: [], activeDeployments: [] };
      const container = setup({ user, readableWallet: wallet });
      vi.mocked(container.resolve(WalletChainReaderService).getBalances).mockResolvedValue(balances);

      const result = await container.resolve(WalletController).getWalletBalances();

      expect(result).toEqual({ data: balances });
      expect(container.resolve(WalletReaderService).getReadableWalletByUserId).toHaveBeenCalledWith(user.id);
      expect(container.resolve(WalletChainReaderService).getBalances).toHaveBeenCalledWith(wallet.address);
    });
  });

  describe("listFeeAllowances", () => {
    it("lists the fee allowances of the wallet the current user can read", async () => {
      const user = createUser();
      const wallet = createInitializedUserWallet({ userId: user.id });
      const allowances = [{ granter: "akash1granter", spendLimit: [], expiration: null }];
      const container = setup({ user, readableWallet: wallet });
      vi.mocked(container.resolve(WalletChainReaderService).getFeeAllowances).mockResolvedValue(allowances);

      const result = await container.resolve(WalletController).listFeeAllowances();

      expect(result).toEqual({ data: allowances });
      expect(container.resolve(WalletReaderService).getReadableWalletByUserId).toHaveBeenCalledWith(user.id);
      expect(container.resolve(WalletChainReaderService).getFeeAllowances).toHaveBeenCalledWith(wallet.address);
    });
  });

  function setup(input?: { user?: UserOutput; wallets?: UserWalletPublicOutput[]; readableWallet?: WalletInitialized }) {
    const authService = mock<AuthService>({ currentUser: input?.user ?? createUser() });
    authService.ability = createMongoAbility<MongoAbility>([{ action: "read", subject: "UserWallet" }]);
    rootContainer.register(AuthService, { useValue: authService });
    rootContainer.register(BillingConfigService, {
      useValue: mock<BillingConfigService>({ get: vi.fn().mockReturnValue("uakt") })
    });
    rootContainer.register(ManagedSignerService, { useValue: mock<ManagedSignerService>() });
    rootContainer.register(RefillService, { useValue: mock<RefillService>() });
    rootContainer.register(WalletReaderService, {
      useValue: mock<WalletReaderService>({
        getWallets: vi.fn().mockResolvedValue(input?.wallets ?? []),
        getReadableWalletByUserId: vi.fn().mockResolvedValue(input?.readableWallet)
      })
    });
    rootContainer.register(WalletChainReaderService, { useValue: mock<WalletChainReaderService>() });
    rootContainer.register(BalancesService, { useValue: mock<BalancesService>() });
    rootContainer.register(UserWalletRepository, {
      useValue: mock<UserWalletRepository>({ toPublic: vi.fn(wallet => wallet) })
    });
    rootContainer.register(TrialValidationService, {
      useValue: mock<TrialValidationService>({
        getTopUpMinAmountUsd: vi.fn(wallet => (wallet?.isTrialing ? 100 : 20))
      })
    });

    return rootContainer;
  }
});
