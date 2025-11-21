import { mock } from "jest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { ManagedUserWalletService } from "@src/billing/services";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import type { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";

import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(RefillService.name, () => {
  describe("topUpWallet", () => {
    const userId = "test-user-id";
    const amountUsd = 100;

    it("should top up existing wallet", async () => {
      const { service, userWalletRepository, managedUserWalletService, balancesService, walletInitializerService, analyticsService } = setup();
      const existingWallet = UserWalletSeeder.create({ userId });
      userWalletRepository.findOneBy.mockResolvedValue(existingWallet);
      managedUserWalletService.authorizeSpending.mockResolvedValue();
      balancesService.retrieveDeploymentLimit.mockResolvedValue(5000);
      balancesService.refreshUserWalletLimits.mockResolvedValue();

      await service.topUpWallet(amountUsd, userId);

      expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ userId });
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(
        {
          address: existingWallet.address,
          limits: { deployment: 1005000, fees: 1000 }
        },
        false
      );
      expect(balancesService.retrieveDeploymentLimit).toHaveBeenCalledWith(existingWallet);
      expect(balancesService.refreshUserWalletLimits).toHaveBeenCalledWith(existingWallet, { endTrial: true });
      expect(walletInitializerService.initialize).not.toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith(userId, "balance_top_up");
    });

    it("should create new wallet when none exists", async () => {
      const { service, userWalletRepository, walletInitializerService, balancesService, managedUserWalletService, analyticsService } = setup();
      const newWallet = UserWalletSeeder.create({ userId });
      userWalletRepository.findOneBy.mockResolvedValue(undefined);
      walletInitializerService.initialize.mockResolvedValue(newWallet);
      managedUserWalletService.authorizeSpending.mockResolvedValue();
      balancesService.retrieveDeploymentLimit.mockResolvedValue(0);
      balancesService.refreshUserWalletLimits.mockResolvedValue();

      await service.topUpWallet(amountUsd, userId);

      expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ userId });
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(
        {
          address: newWallet.address,
          limits: { deployment: 1000000, fees: 1000 }
        },
        false
      );
      expect(balancesService.refreshUserWalletLimits).toHaveBeenCalledWith(newWallet, { endTrial: true });
      expect(walletInitializerService.initialize).toHaveBeenCalledWith(userId);
      expect(analyticsService.track).toHaveBeenCalledWith(userId, "balance_top_up");
    });

    it("should handle race condition when creating wallet", async () => {
      const { service, userWalletRepository, managedUserWalletService, balancesService, walletInitializerService, analyticsService } = setup();
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
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(
        {
          address: existingWallet.address,
          limits: { deployment: 1000000, fees: 1000 }
        },
        false
      );
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(
        {
          address: existingWallet.address,
          limits: { deployment: 2 * 1000000, fees: 1000 }
        },
        false
      );
      expect(balancesService.refreshUserWalletLimits).toHaveBeenCalledWith(existingWallet, { endTrial: true });
      expect(walletInitializerService.initialize).toHaveBeenCalledWith(userId);
      expect(walletInitializerService.initialize).toHaveBeenCalledTimes(1);
      expect(analyticsService.track).toHaveBeenCalledWith(userId, "balance_top_up");
    });

    function setup() {
      const billingConfig = mock<BillingConfig>();
      const userWalletRepository = mock<UserWalletRepository>();
      const managedUserWalletService = mock<ManagedUserWalletService>();
      const balancesService = mock<BalancesService>();
      const walletInitializerService = mock<WalletInitializerService>();
      const analyticsService = mock<AnalyticsService>();

      billingConfig.FEE_ALLOWANCE_REFILL_AMOUNT = 1000;

      const service = new RefillService(
        billingConfig,
        userWalletRepository,
        managedUserWalletService,
        balancesService,
        walletInitializerService,
        analyticsService
      );

      return {
        service,
        billingConfig,
        userWalletRepository,
        managedUserWalletService,
        balancesService,
        walletInitializerService,
        analyticsService
      };
    }
  });
});
