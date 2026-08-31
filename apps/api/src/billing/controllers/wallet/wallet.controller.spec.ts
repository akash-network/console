import type { MongoAbility } from "@casl/ability";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { container as rootContainer } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import { type UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { UserOutput } from "@src/user/repositories";
import { WalletController } from "./wallet.controller";

import { createUser } from "@test/seeders/user.seeder";

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
          createdAt: new Date()
        },
        {
          id: faker.number.int(),
          userId,
          address: faker.string.alphanumeric(44),
          creditAmount: 200,
          isTrialing: false,
          trialEndsAt: null,
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

  function setup(input?: { user?: UserOutput; wallets?: UserWalletPublicOutput[] }) {
    const authService = mock<AuthService>({ currentUser: input?.user ?? createUser() });
    authService.ability = createMongoAbility<MongoAbility>([{ action: "read", subject: "UserWallet" }]);
    rootContainer.register(AuthService, { useValue: authService });
    rootContainer.register(BillingConfigService, {
      useValue: mock<BillingConfigService>({ get: vi.fn().mockReturnValue("uakt") })
    });
    rootContainer.register(ManagedSignerService, { useValue: mock<ManagedSignerService>() });
    rootContainer.register(RefillService, { useValue: mock<RefillService>() });
    rootContainer.register(WalletReaderService, {
      useValue: mock<WalletReaderService>({ getWallets: vi.fn().mockResolvedValue(input?.wallets ?? []) })
    });
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
