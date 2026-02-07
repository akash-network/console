import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { ManagedSignerService, ManagedUserWalletService } from "@src/billing/services";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import type { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { SemaphoreFactory } from "../../../core/lib/pg-semaphore";

import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(RefillService.name, () => {
  describe("topUpWallet", () => {
    const userId = "test-user-id";
    const amountUsd = 100;

    it("should top up existing wallet", async () => {
      const { service, userWalletRepository, managedUserWalletService, managedSignerService, balancesService, walletInitializerService, analyticsService } =
        setup();
      const existingWallet = UserWalletSeeder.create({ userId });
      userWalletRepository.findOneBy.mockResolvedValue(existingWallet);
      managedUserWalletService.authorizeSpending.mockResolvedValue();
      balancesService.retrieveDeploymentLimit.mockResolvedValue(5000);
      balancesService.refreshUserWalletLimits.mockResolvedValue();

      await service.topUpWallet(amountUsd, userId);

      expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ userId });
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(managedSignerService, {
        address: existingWallet.address,
        limits: { deployment: 1005000, fees: 1000 }
      });
      expect(balancesService.retrieveDeploymentLimit).toHaveBeenCalledWith(existingWallet);
      expect(balancesService.refreshUserWalletLimits).toHaveBeenCalledWith(existingWallet, { endTrial: true });
      expect(walletInitializerService.initialize).not.toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith(userId, "balance_top_up");
    });

    it("should create new wallet when none exists", async () => {
      const { service, userWalletRepository, walletInitializerService, balancesService, managedUserWalletService, managedSignerService, analyticsService } =
        setup();
      const newWallet = UserWalletSeeder.create({ userId });
      userWalletRepository.findOneBy.mockResolvedValue(undefined);
      walletInitializerService.initialize.mockResolvedValue(newWallet);
      managedUserWalletService.authorizeSpending.mockResolvedValue();
      balancesService.retrieveDeploymentLimit.mockResolvedValue(0);
      balancesService.refreshUserWalletLimits.mockResolvedValue();

      await service.topUpWallet(amountUsd, userId);

      expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ userId });
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(managedSignerService, {
        address: newWallet.address,
        limits: { deployment: 1000000, fees: 1000 }
      });
      expect(balancesService.refreshUserWalletLimits).toHaveBeenCalledWith(newWallet, { endTrial: true });
      expect(walletInitializerService.initialize).toHaveBeenCalledWith(userId);
      expect(analyticsService.track).toHaveBeenCalledWith(userId, "balance_top_up");
    });

    it("should handle race condition when creating wallet", async () => {
      const { service, userWalletRepository, managedUserWalletService, managedSignerService, balancesService, walletInitializerService, analyticsService } =
        setup();
      const existingWallet = UserWalletSeeder.create({ userId });
      userWalletRepository.findOneBy.mockResolvedValue(undefined);
      managedUserWalletService.authorizeSpending.mockResolvedValue();
      balancesService.retrieveDeploymentLimit.mockResolvedValue(0);
      balancesService.refreshUserWalletLimits.mockResolvedValue();
      walletInitializerService.initialize.mockImplementation(async () => {
        userWalletRepository.findOneBy.mockResolvedValue(existingWallet);
        return existingWallet;
      });

      await Promise.all([service.topUpWallet(amountUsd, userId), service.topUpWallet(2 * amountUsd, userId)]);

      expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ userId });
      expect(userWalletRepository.findOneBy).toHaveBeenCalledTimes(2);
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(managedSignerService, {
        address: existingWallet.address,
        limits: { deployment: 1000000, fees: 1000 }
      });
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(managedSignerService, {
        address: existingWallet.address,
        limits: { deployment: 2 * 1000000, fees: 1000 }
      });
      expect(balancesService.refreshUserWalletLimits).toHaveBeenCalledWith(existingWallet, { endTrial: true });
      expect(walletInitializerService.initialize).toHaveBeenCalledWith(userId);
      expect(walletInitializerService.initialize).toHaveBeenCalledTimes(1);
      expect(analyticsService.track).toHaveBeenCalledWith(userId, "balance_top_up");
    });

    function setup() {
      SemaphoreFactory.useMemory();
      const billingConfig = mock<BillingConfig>();
      const userWalletRepository = mock<UserWalletRepository>();
      const managedUserWalletService = mock<ManagedUserWalletService>();
      const managedSignerService = mock<ManagedSignerService>();
      const balancesService = mock<BalancesService>();
      const walletInitializerService = mock<WalletInitializerService>();
      const analyticsService = mock<AnalyticsService>();

      billingConfig.FEE_ALLOWANCE_REFILL_AMOUNT = 1000;

      const service = new RefillService(
        billingConfig,
        userWalletRepository,
        managedUserWalletService,
        managedSignerService,
        balancesService,
        walletInitializerService,
        analyticsService
      );

      return {
        service,
        billingConfig,
        userWalletRepository,
        managedUserWalletService,
        managedSignerService,
        balancesService,
        walletInitializerService,
        analyticsService
      };
    }
  });

  describe("reduceWalletBalance", () => {
    const userId = "test-user-id";

    it("reduces wallet balance by the specified amount", async () => {
      const { service, userWalletRepository, managedUserWalletService, managedSignerService, balancesService, analyticsService } = setup();
      const existingWallet = UserWalletSeeder.create({ userId, address: "akash1test..." });

      userWalletRepository.findOneBy.mockResolvedValue(existingWallet);
      balancesService.retrieveDeploymentLimit.mockResolvedValue(5000000); // Current limit (500 usd worth)
      managedUserWalletService.authorizeSpending.mockResolvedValue();
      balancesService.refreshUserWalletLimits.mockResolvedValue();

      await service.reduceWalletBalance(100, userId); // Reduce by $1 (100 cents)

      expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ userId });
      expect(balancesService.retrieveDeploymentLimit).toHaveBeenCalledWith(existingWallet);
      // 5000000 - (100 * 10000) = 5000000 - 1000000 = 4000000
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(managedSignerService, {
        address: existingWallet.address,
        limits: { deployment: 4000000, fees: 1000 }
      });
      expect(balancesService.refreshUserWalletLimits).toHaveBeenCalledWith(existingWallet);
      expect(analyticsService.track).toHaveBeenCalledWith(userId, "balance_refund");
    });

    it("does not reduce balance below zero", async () => {
      const { service, userWalletRepository, managedUserWalletService, managedSignerService, balancesService, analyticsService } = setup();
      const existingWallet = UserWalletSeeder.create({ userId, address: "akash1test..." });

      userWalletRepository.findOneBy.mockResolvedValue(existingWallet);
      balancesService.retrieveDeploymentLimit.mockResolvedValue(50000); // Current limit $0.50
      managedUserWalletService.authorizeSpending.mockResolvedValue();
      balancesService.refreshUserWalletLimits.mockResolvedValue();

      await service.reduceWalletBalance(100, userId); // Try to reduce by $1 (100 cents)

      // Should set to 0, not negative
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(managedSignerService, {
        address: existingWallet.address,
        limits: { deployment: 0, fees: 1000 }
      });
      expect(analyticsService.track).toHaveBeenCalledWith(userId, "balance_refund");
    });

    it("does nothing when wallet does not exist", async () => {
      const { service, userWalletRepository, managedUserWalletService, balancesService, analyticsService } = setup();

      userWalletRepository.findOneBy.mockResolvedValue(undefined);

      await service.reduceWalletBalance(100, userId);

      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
      expect(balancesService.retrieveDeploymentLimit).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("does nothing when wallet has no address", async () => {
      const { service, userWalletRepository, managedUserWalletService, balancesService, analyticsService } = setup();
      const walletWithoutAddress = UserWalletSeeder.create({ userId, address: null });

      userWalletRepository.findOneBy.mockResolvedValue(walletWithoutAddress);

      await service.reduceWalletBalance(100, userId);

      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
      expect(balancesService.retrieveDeploymentLimit).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    function setup() {
      SemaphoreFactory.useMemory();
      const billingConfig = mock<BillingConfig>();
      const userWalletRepository = mock<UserWalletRepository>();
      const managedUserWalletService = mock<ManagedUserWalletService>();
      const managedSignerService = mock<ManagedSignerService>();
      const balancesService = mock<BalancesService>();
      const walletInitializerService = mock<WalletInitializerService>();
      const analyticsService = mock<AnalyticsService>();

      billingConfig.FEE_ALLOWANCE_REFILL_AMOUNT = 1000;

      const service = new RefillService(
        billingConfig,
        userWalletRepository,
        managedUserWalletService,
        managedSignerService,
        balancesService,
        walletInitializerService,
        analyticsService
      );

      return {
        service,
        billingConfig,
        userWalletRepository,
        managedUserWalletService,
        managedSignerService,
        balancesService,
        walletInitializerService,
        analyticsService
      };
    }
  });
});
