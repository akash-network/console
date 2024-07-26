import { WalletService } from "@test/services/wallet.service";
import { container } from "tsyringe";

import { app } from "@src/app";
import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { BILLING_CONFIG, BillingConfig, USER_WALLET_SCHEMA, UserWalletSchema } from "@src/billing/providers";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";
import { ApiPgDatabase, POSTGRES_DB } from "@src/core";
import { USER_SCHEMA, UserSchema } from "@src/user/providers";

jest.setTimeout(240000);

describe("Wallets Refill", () => {
  const managedUserWalletService = container.resolve(ManagedUserWalletService);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletSchema = container.resolve<UserWalletSchema>(USER_WALLET_SCHEMA);
  const userSchema = container.resolve<UserSchema>(USER_SCHEMA);
  const config = container.resolve<BillingConfig>(BILLING_CONFIG);
  const walletController = container.resolve(WalletController);
  const walletService = new WalletService(app);
  const userWalletRepository = container.resolve(UserWalletRepository);

  afterEach(async () => {
    await Promise.all([db.delete(userWalletSchema), db.delete(userSchema)]);
  });

  describe("console refill-wallets", () => {
    it("should refill draining wallets", async () => {
      const prepareRecords = Array.from({ length: 15 }).map(async () => {
        const records = await walletService.createUserAndWallet();
        const user = records.user;
        let wallet = records.wallet;

        expect(wallet.creditAmount).toBe(config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + config.TRIAL_FEES_ALLOWANCE_AMOUNT);
        const limits = {
          deployment: config.DEPLOYMENT_ALLOWANCE_REFILL_THRESHOLD,
          fees: config.FEE_ALLOWANCE_REFILL_THRESHOLD
        };
        await managedUserWalletService.authorizeSpending({
          address: wallet.address,
          limits
        });
        await userWalletRepository.updateById(
          wallet.id,
          {
            deploymentAllowance: String(limits.deployment),
            feeAllowance: String(limits.fees)
          },
          { returning: true }
        );
        wallet = await walletService.getWalletByUserId(user.id);

        expect(wallet.creditAmount).toBe(config.DEPLOYMENT_ALLOWANCE_REFILL_THRESHOLD + config.FEE_ALLOWANCE_REFILL_THRESHOLD);

        return { user, wallet };
      });

      const records = await Promise.all(prepareRecords);
      await walletController.refillWallets();

      await Promise.all(
        records.map(async ({ wallet, user }) => {
          wallet = await walletService.getWalletByUserId(user.id);
          expect(wallet.creditAmount).toBe(config.DEPLOYMENT_ALLOWANCE_REFILL_AMOUNT + config.FEE_ALLOWANCE_REFILL_AMOUNT);
        })
      );
    });
  });
});
