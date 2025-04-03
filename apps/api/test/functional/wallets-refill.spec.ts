import { container } from "tsyringe";

import { app } from "@src/app";
import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import type { BillingConfig } from "@src/billing/providers";
import { BILLING_CONFIG } from "@src/billing/providers";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";

import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(240000);

describe("Wallets Refill", () => {
  const managedUserWalletService = container.resolve(ManagedUserWalletService);
  const config = container.resolve<BillingConfig>(BILLING_CONFIG);
  const walletController = container.resolve(WalletController);
  const walletService = new WalletTestingService(app);
  const userWalletRepository = container.resolve(UserWalletRepository);

  describe("console refill-wallets", () => {
    it("should refill wallets low on fee allowance", async () => {
      config.FEE_ALLOWANCE_REFILL_THRESHOLD = 2;
      const NUMBER_OF_WALLETS = 5;
      const prepareRecords = Array.from({ length: NUMBER_OF_WALLETS }).map(async (_, index) => {
        const records = await walletService.createUserAndWallet();
        const { user, token } = records;
        const { wallet } = records;
        let walletRecord = await userWalletRepository.findById(wallet.id);

        expect(wallet.creditAmount).toBe(config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT);
        expect(walletRecord.feeAllowance).toBe(config.TRIAL_FEES_ALLOWANCE_AMOUNT);

        const limits = {
          fees: config.FEE_ALLOWANCE_REFILL_THRESHOLD
        };
        await managedUserWalletService.authorizeSpending({
          address: wallet.address,
          limits
        });
        walletRecord = await userWalletRepository.updateById(
          wallet.id,
          {
            feeAllowance: limits.fees,
            isTrialing: index === NUMBER_OF_WALLETS - 1
          },
          { returning: true }
        );

        expect(walletRecord.feeAllowance).toBe(config.FEE_ALLOWANCE_REFILL_THRESHOLD);
        expect(wallet.isTrialing).toBe(true);

        return { user, token, wallet };
      });

      const records = await Promise.all(prepareRecords);
      await walletController.refillWallets();
      const trialingWallet = records.pop();

      await Promise.all([
        ...records.map(async ({ wallet }) => {
          const walletRecord = await userWalletRepository.findById(wallet.id);

          expect(walletRecord.feeAllowance).toBe(config.FEE_ALLOWANCE_REFILL_AMOUNT);
        }),
        userWalletRepository.findById(trialingWallet.wallet.id).then(walletRecord => {
          expect(walletRecord.feeAllowance).toBe(config.FEE_ALLOWANCE_REFILL_THRESHOLD);
        })
      ]);
    });
  });
});
