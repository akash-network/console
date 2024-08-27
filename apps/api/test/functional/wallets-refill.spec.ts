import { WalletService } from "@test/services/wallet.service";
import { container } from "tsyringe";

import { app } from "@src/app";
import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { BILLING_CONFIG, BillingConfig } from "@src/billing/providers";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";
import { ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";

jest.setTimeout(240000);

describe("Wallets Refill", () => {
  const managedUserWalletService = container.resolve(ManagedUserWalletService);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletsTable = resolveTable("UserWallets");
  const usersTable = resolveTable("Users");
  const config = container.resolve<BillingConfig>(BILLING_CONFIG);
  const walletController = container.resolve(WalletController);
  const walletService = new WalletService(app);
  const userWalletRepository = container.resolve(UserWalletRepository);

  afterEach(async () => {
    await Promise.all([db.delete(userWalletsTable), db.delete(usersTable)]);
  });

  describe("console refill-wallets", () => {
    it("should refill wallets low on fee allowance", async () => {
      const prepareRecords = Array.from({ length: 15 }).map(async () => {
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
            feeAllowance: limits.fees
          },
          { returning: true }
        );

        expect(walletRecord.feeAllowance).toBe(config.FEE_ALLOWANCE_REFILL_THRESHOLD);
        expect(wallet.isTrialing).toBe(true);

        return { user, token, wallet };
      });

      const records = await Promise.all(prepareRecords);
      await walletController.refillWallets();

      await Promise.all(
        records.map(async ({ wallet }) => {
          const walletRecord = await userWalletRepository.findById(wallet.id);

          expect(walletRecord.feeAllowance).toBe(config.FEE_ALLOWANCE_REFILL_AMOUNT);
        })
      );
    });
  });
});
