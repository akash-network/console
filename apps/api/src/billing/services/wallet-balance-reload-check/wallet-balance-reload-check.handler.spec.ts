import { faker } from "@faker-js/faker";
import { addMilliseconds, millisecondsInHour } from "date-fns";
import { mock } from "jest-mock-extended";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import type { WalletSettingRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { JobMeta, LoggerService } from "@src/core";
import type { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import type { JobPayload } from "../../../core";
import { WalletBalanceReloadCheckHandler } from "./wallet-balance-reload-check.handler";

import { generateBalance } from "@test/seeders/balance.seeder";
import { generateMergedPaymentMethod as generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletBalanceReloadCheckHandler.name, () => {
  describe("handle", () => {
    it("triggers reload when balance is below 25% of cost", async () => {
      // Given: balance = $10, costUntilTargetDate = $50
      // Expected: 25% threshold = $12.50, balance ($10) < threshold → reload
      // Expected: reload amount = max($50 - $10, $20) = $40
      // Expected: calculates cost for 7 days, schedules next check in 1 day
      const balance = 10.0;
      const costUntilTargetDateInDenom = 50_000_000; // 50 USD in udenom
      const costUntilTargetDateInFiat = 50.0;
      const expectedReloadAmount = 40.0; // max(50 - 10, 20) = 40

      const { handler, drainingDeploymentService, stripeService, loggerService, walletReloadJobService, job, jobMeta } = setup({
        balance: { total: balance },
        weeklyCostInDenom: costUntilTargetDateInDenom,
        weeklyCostInFiat: costUntilTargetDateInFiat
      });

      await handler.handle(job, jobMeta);

      // Verify calculateAllDeploymentCostUntilDate is called with 7 days
      expect(drainingDeploymentService.calculateAllDeploymentCostUntilDate).toHaveBeenCalled();
      const calculateCall = drainingDeploymentService.calculateAllDeploymentCostUntilDate.mock.calls[0];
      const reloadTargetDate = calculateCall[1];
      const millisecondsInDay = 24 * millisecondsInHour;
      const expectedReloadDate = addMilliseconds(new Date(), 7 * millisecondsInDay);
      expect(reloadTargetDate.getTime()).toBeCloseTo(expectedReloadDate.getTime(), -3);

      // Verify next check is scheduled for 1 day
      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalled();
      const scheduleCall = walletReloadJobService.scheduleForWalletSetting.mock.calls[0];
      const scheduledDate = scheduleCall[1]?.startAfter;
      expect(scheduledDate).toBeInstanceOf(Date);
      const expectedNextCheckDate = addMilliseconds(new Date(), millisecondsInDay);
      expect((scheduledDate as Date).getTime()).toBeCloseTo(expectedNextCheckDate.getTime(), -3);

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith({
        customer: expect.any(String),
        payment_method: expect.any(String),
        amount: expectedReloadAmount,
        currency: "usd",
        confirm: true,
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${jobMeta.id}`
      });
      expect(loggerService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "WALLET_BALANCE_RELOADED",
          balance,
          costUntilTargetDateInFiat
        })
      );
    });

    it("triggers reload with minimum amount when needed amount is below minimum", async () => {
      // Given: balance = $4, costUntilTargetDate = $20
      // Expected: 25% threshold = $5, balance ($4) < threshold → reload
      // Expected: reload amount = max($20 - $4, $20) = $20 (minimum)
      const balance = 4.0;
      const costUntilTargetDateInDenom = 20_000_000; // 20 USD in udenom
      const costUntilTargetDateInFiat = 20.0;
      const expectedReloadAmount = 20.0; // max(20 - 4, 20) = 20

      const { handler, stripeService, job, jobMeta } = setup({
        balance: { total: balance },
        weeklyCostInDenom: costUntilTargetDateInDenom,
        weeklyCostInFiat: costUntilTargetDateInFiat
      });

      await handler.handle(job, jobMeta);

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith({
        customer: expect.any(String),
        payment_method: expect.any(String),
        amount: expectedReloadAmount,
        currency: "usd",
        confirm: true,
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${jobMeta.id}`
      });
    });

    it("does not trigger reload when balance equals 25% of cost", async () => {
      // Given: balance = $12.50, costUntilTargetDate = $50
      // Expected: 25% threshold = $12.50, balance ($12.50) >= threshold → no reload
      const balance = 12.5;
      const costUntilTargetDateInDenom = 50_000_000;
      const costUntilTargetDateInFiat = 50.0;

      const { handler, stripeService, loggerService, job, jobMeta } = setup({
        balance: { total: balance },
        weeklyCostInDenom: costUntilTargetDateInDenom,
        weeklyCostInFiat: costUntilTargetDateInFiat
      });

      await handler.handle(job, jobMeta);

      expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
      expect(loggerService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "WALLET_BALANCE_RELOAD_SKIPPED",
          balance,
          costUntilTargetDateInFiat
        })
      );
    });

    it("does not trigger reload when balance is above 25% of cost", async () => {
      // Given: balance = $50, costUntilTargetDate = $50
      // Expected: 25% threshold = $12.50, balance ($50) >= threshold → no reload
      const balance = 50.0;
      const costUntilTargetDateInDenom = 50_000_000;
      const costUntilTargetDateInFiat = 50.0;

      const { handler, stripeService, loggerService, job, jobMeta } = setup({
        balance: { total: balance },
        weeklyCostInDenom: costUntilTargetDateInDenom,
        weeklyCostInFiat: costUntilTargetDateInFiat
      });

      await handler.handle(job, jobMeta);

      expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
      expect(loggerService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "WALLET_BALANCE_RELOAD_SKIPPED",
          balance,
          costUntilTargetDateInFiat
        })
      );
    });

    it("schedules next check and updates job ID", async () => {
      const jobId = faker.string.uuid();
      const balance = 50.0;
      const weeklyCostInDenom = 50_000_000;
      const weeklyCostInFiat = 50.0;

      const { handler, walletReloadJobService, walletSetting, job, jobMeta } = setup({
        balance: { total: balance },
        weeklyCostInDenom,
        weeklyCostInFiat,
        jobId
      });

      await handler.handle(job, jobMeta);

      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(
        expect.objectContaining({
          id: walletSetting.id,
          userId: job.userId
        }),
        expect.objectContaining({
          startAfter: expect.any(Date),
          prevAction: "complete"
        })
      );
    });

    it("logs error and throws when scheduling next check fails", async () => {
      const balance = 50.0;
      const weeklyCostInDenom = 50_000_000;
      const weeklyCostInFiat = 50.0;
      const error = new Error("Failed to schedule");

      const { handler, walletReloadJobService, loggerService, job, jobMeta } = setup({
        balance: { total: balance },
        weeklyCostInDenom,
        weeklyCostInFiat
      });
      walletReloadJobService.scheduleForWalletSetting.mockRejectedValue(error);

      await expect(handler.handle(job, jobMeta)).rejects.toThrow(error);

      expect(loggerService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "ERROR_SCHEDULING_NEXT_CHECK",
          walletAddress: expect.any(String),
          error
        })
      );
    });

    it("logs validation error when wallet setting not found", async () => {
      const { handler, walletSettingRepository, loggerService, job, jobMeta } = setup({
        walletSettingNotFound: true
      });

      await handler.handle(job, jobMeta);

      expect(loggerService.error).toHaveBeenCalledWith({
        event: "WALLET_SETTING_NOT_FOUND",
        message: "Wallet setting not found. Skipping wallet balance reload check.",
        userId: job.userId
      });
      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
    });

    it("logs validation error when auto reload is disabled", async () => {
      const { handler, walletSettingRepository, loggerService, job, jobMeta } = setup({
        autoReloadEnabled: false
      });

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(loggerService.error).toHaveBeenCalledWith({
        event: "AUTO_RELOAD_DISABLED",
        message: "Auto reload disabled. Skipping wallet balance reload check.",
        userId: job.userId
      });
    });

    it("logs validation error when wallet is not initialized", async () => {
      const { handler, walletSettingRepository, loggerService, job, jobMeta } = setup({
        wallet: UserWalletSeeder.create({ address: null })
      });

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(loggerService.error).toHaveBeenCalledWith({
        event: "WALLET_NOT_INITIALIZED",
        message: "Wallet not initialized. Skipping wallet balance reload check.",
        userId: job.userId
      });
    });

    it("logs validation error when user stripe customer ID is not set", async () => {
      const userWithoutStripe = UserSeeder.create();
      const userWithNullStripe = { ...userWithoutStripe, stripeCustomerId: null };
      const { handler, walletSettingRepository, loggerService, job, jobMeta } = setup({
        user: userWithNullStripe
      });

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(loggerService.error).toHaveBeenCalledWith({
        event: "USER_STRIPE_CUSTOMER_ID_NOT_SET",
        message: "User stripe customer ID not set. Skipping wallet balance reload check.",
        userId: job.userId
      });
    });

    it("logs validation error when default payment method cannot be retrieved", async () => {
      const balance = 15.0;

      const { handler, loggerService, stripeService, job, jobMeta } = setup({
        balance: { total: balance }
      });
      stripeService.getDefaultPaymentMethod.mockResolvedValue(undefined);

      await handler.handle(job, jobMeta);

      expect(loggerService.error).toHaveBeenCalledWith({
        event: "DEFAULT_PAYMENT_METHOD_NOT_FOUND",
        message: "Default payment method not found",
        userId: job.userId
      });
    });
  });

  function setup(input?: {
    balance?: { total: number };
    weeklyCostInDenom?: number;
    weeklyCostInFiat?: number;
    jobId?: string | null;
    walletSettingNotFound?: boolean;
    autoReloadEnabled?: boolean;
    wallet?: ReturnType<typeof UserWalletSeeder.create>;
    user?: ReturnType<typeof UserSeeder.create>;
  }) {
    const user = input?.user ?? UserSeeder.create();
    const userWithStripe =
      input?.user && input.user.stripeCustomerId === null
        ? user
        : input?.user && input.user.stripeCustomerId
          ? user
          : user.stripeCustomerId
            ? user
            : { ...user, stripeCustomerId: faker.string.uuid() };
    const wallet = input?.wallet ?? UserWalletSeeder.create({ userId: user.id });
    const walletSetting = generateWalletSetting({
      userId: user.id,
      walletId: wallet.id,
      autoReloadEnabled: input?.autoReloadEnabled ?? true
    });
    const walletSettingWithWallet = {
      ...walletSetting,
      wallet: {
        address: wallet.address!,
        isOldWallet: wallet.isOldWallet
      },
      user: userWithStripe
    };
    const job: JobPayload<WalletBalanceReloadCheck> = {
      userId: user.id,
      version: 1
    };
    const jobMeta: JobMeta = {
      id: faker.string.uuid()
    };

    const walletSettingRepository = mock<WalletSettingRepository>();
    const balancesService = mock<BalancesService>();
    const walletReloadJobService = mock<WalletReloadJobService>();
    const drainingDeploymentService = mock<DrainingDeploymentService>();
    const stripeService = mock<StripeService>();
    const loggerService = mock<LoggerService>();

    const balance = input?.balance ?? { total: 50.0 };
    const weeklyCostInDenom = input?.weeklyCostInDenom ?? 50_000_000;
    const weeklyCostInFiat = input?.weeklyCostInFiat ?? 50.0;
    const jobId = input?.jobId ?? faker.string.uuid();

    if (input?.walletSettingNotFound) {
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(undefined);
    } else {
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(walletSettingWithWallet);
    }

    if (!input?.walletSettingNotFound && userWithStripe.stripeCustomerId) {
      balancesService.getFullBalanceInFiat.mockResolvedValue(generateBalance(balance));
      balancesService.toFiatAmount.mockResolvedValue(weeklyCostInFiat);
      drainingDeploymentService.calculateAllDeploymentCostUntilDate.mockResolvedValue(weeklyCostInDenom);
      stripeService.getDefaultPaymentMethod.mockResolvedValue(generatePaymentMethod());
    }

    walletReloadJobService.scheduleForWalletSetting.mockResolvedValue(jobId);

    const handler = new WalletBalanceReloadCheckHandler(
      walletSettingRepository,
      balancesService,
      walletReloadJobService,
      stripeService,
      drainingDeploymentService,
      loggerService
    );

    return {
      handler,
      walletSettingRepository,
      balancesService,
      walletReloadJobService,
      drainingDeploymentService,
      stripeService,
      loggerService,
      walletSetting,
      walletSettingWithWallet,
      wallet,
      job,
      jobMeta
    };
  }
});
