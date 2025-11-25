import { faker } from "@faker-js/faker";
import createHttpError from "http-errors";
import { mock } from "jest-mock-extended";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import type { WalletSettingRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { JobMeta, JobQueueService, LoggerService } from "@src/core";
import type { JobPayload } from "../../../core";
import { WalletBalanceReloadCheckHandler } from "./wallet-balance-reload-check.handler";

import { generateBalance } from "@test/seeders/balance.seeder";
import { generateMergedPaymentMethod as generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletBalanceReloadCheckHandler.name, () => {
  describe("handle", () => {
    it("triggers reload when balance is below threshold", async () => {
      const {
        handler,
        walletSettingRepository,
        balancesService,
        stripeService,
        jobQueueService,
        loggerService,
        walletSettingWithWallet,
        walletSetting,
        wallet,
        job,
        jobMeta
      } = setup();
      const paymentMethod = generatePaymentMethod();
      const balance = generateBalance({ balance: 15.0, deployments: 0, total: 15.0 });
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(walletSettingWithWallet);
      balancesService.getFullBalanceInFiat.mockResolvedValue(balance);
      stripeService.getDefaultPaymentMethod.mockResolvedValue(paymentMethod);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith({
        customer: walletSettingWithWallet.user.stripeCustomerId,
        payment_method: paymentMethod.id,
        amount: walletSetting.autoReloadAmount,
        currency: "usd",
        confirm: true,
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${jobMeta.id}`
      });
      expect(loggerService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "WALLET_BALANCE_RELOADED",
          walletAddress: wallet.address,
          balance: 15.0,
          threshold: 30.0,
          amount: 100.0
        })
      );
    });

    it("triggers reload when balance equals threshold", async () => {
      const { handler, walletSettingRepository, balancesService, stripeService, jobQueueService, walletSettingWithWallet, walletSetting, job, jobMeta } =
        setup();
      const paymentMethod = generatePaymentMethod();
      const balance = generateBalance({ balance: 30.0, deployments: 0, total: 30.0 });
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(walletSettingWithWallet);
      balancesService.getFullBalanceInFiat.mockResolvedValue(balance);
      stripeService.getDefaultPaymentMethod.mockResolvedValue(paymentMethod);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith({
        customer: walletSettingWithWallet.user.stripeCustomerId,
        payment_method: paymentMethod.id,
        amount: walletSetting.autoReloadAmount,
        currency: "usd",
        confirm: true,
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${jobMeta.id}`
      });
      expect(jobQueueService.enqueue).toHaveBeenCalled();
    });

    it("does not trigger reload when balance is above threshold", async () => {
      const { handler, walletSettingRepository, balancesService, stripeService, jobQueueService, loggerService, walletSettingWithWallet, job, jobMeta } =
        setup();
      const balance = generateBalance({ balance: 50.0, deployments: 0, total: 50.0 });
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(walletSettingWithWallet);
      balancesService.getFullBalanceInFiat.mockResolvedValue(balance);
      stripeService.getDefaultPaymentMethod.mockResolvedValue(generatePaymentMethod());
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
      expect(loggerService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "WALLET_BALANCE_RELOAD_SKIPPED"
        })
      );
      expect(jobQueueService.enqueue).toHaveBeenCalled();
    });

    it("re-enqueues next check and updates job ID", async () => {
      const { handler, walletSettingRepository, balancesService, stripeService, jobQueueService, walletSettingWithWallet, walletSetting, job, jobMeta } =
        setup();
      const jobId = faker.string.uuid();
      const balance = generateBalance({ balance: 50.0, deployments: 0, total: 50.0 });
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(walletSettingWithWallet);
      balancesService.getFullBalanceInFiat.mockResolvedValue(balance);
      stripeService.getDefaultPaymentMethod.mockResolvedValue(generatePaymentMethod());
      jobQueueService.enqueue.mockResolvedValue(jobId);

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.any(WalletBalanceReloadCheck),
        expect.objectContaining({
          singletonKey: `WalletBalanceReloadCheck.${job.userId}`
        })
      );
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(walletSetting.id, { autoReloadJobId: jobId });
    });

    it("does not update job ID when enqueue returns null", async () => {
      const { handler, walletSettingRepository, balancesService, stripeService, jobQueueService, walletSettingWithWallet, job, jobMeta } = setup();
      const balance = generateBalance({ balance: 50.0, deployments: 0, total: 50.0 });
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(walletSettingWithWallet);
      balancesService.getFullBalanceInFiat.mockResolvedValue(balance);
      stripeService.getDefaultPaymentMethod.mockResolvedValue(generatePaymentMethod());
      jobQueueService.enqueue.mockResolvedValue(null);

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(walletSettingRepository.updateById).not.toHaveBeenCalled();
    });

    it("logs validation error when wallet setting not found", async () => {
      const { handler, walletSettingRepository, loggerService, job, jobMeta } = setup();
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(undefined);

      await handler.handle(job, jobMeta);

      expect(loggerService.info).toHaveBeenCalledWith({
        event: "WALLET_SETTING_NOT_FOUND",
        message: "Wallet setting not found. Skipping wallet balance reload check.",
        userId: job.userId
      });
      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
    });

    it("logs validation error when auto reload is disabled", async () => {
      const { handler, walletSettingRepository, loggerService, walletSettingWithWallet, job, jobMeta } = setup();
      const disabledSetting = { ...walletSettingWithWallet, autoReloadEnabled: false };
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(disabledSetting);

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(loggerService.info).toHaveBeenCalledWith({
        event: "AUTO_RELOAD_DISABLED",
        message: "Auto reload disabled. Skipping wallet balance reload check.",
        userId: job.userId
      });
    });

    it("logs validation error when auto reload threshold is not set", async () => {
      const { handler, walletSettingRepository, loggerService, walletSettingWithWallet, job, jobMeta } = setup();
      const invalidSetting = { ...walletSettingWithWallet, autoReloadThreshold: undefined };
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(invalidSetting);

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(loggerService.info).toHaveBeenCalledWith({
        event: "AUTO_RELOAD_THRESHOLD_NOT_SET",
        message: "Auto reload threshold not set. Skipping wallet balance reload check.",
        userId: job.userId
      });
    });

    it("logs validation error when auto reload amount is not set", async () => {
      const { handler, walletSettingRepository, loggerService, walletSettingWithWallet, job, jobMeta } = setup();
      const invalidSetting = { ...walletSettingWithWallet, autoReloadAmount: undefined };
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(invalidSetting);

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(loggerService.info).toHaveBeenCalledWith({
        event: "AUTO_RELOAD_AMOUNT_NOT_SET",
        message: "Auto reload amount not set. Skipping wallet balance reload check.",
        userId: job.userId
      });
    });

    it("logs validation error when wallet is not initialized", async () => {
      const { handler, walletSettingRepository, loggerService, walletSettingWithWallet, job, jobMeta } = setup();
      const walletWithoutAddress = UserWalletSeeder.create({ address: null });
      const settingWithUninitializedWallet = { ...walletSettingWithWallet, wallet: walletWithoutAddress };
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(settingWithUninitializedWallet);

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(loggerService.info).toHaveBeenCalledWith({
        event: "WALLET_NOT_INITIALIZED",
        message: "Wallet not initialized. Skipping wallet balance reload check.",
        userId: job.userId
      });
    });

    it("logs validation error when user stripe customer ID is not set", async () => {
      const { handler, walletSettingRepository, loggerService, walletSettingWithWallet, job, jobMeta } = setup();
      const userWithoutStripe = { ...walletSettingWithWallet.user, stripeCustomerId: null };
      const settingWithoutStripe = { ...walletSettingWithWallet, user: userWithoutStripe };
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(settingWithoutStripe);

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(loggerService.info).toHaveBeenCalledWith({
        event: "USER_STRIPE_CUSTOMER_ID_NOT_SET",
        message: "User stripe customer ID not set. Skipping wallet balance reload check.",
        userId: job.userId
      });
    });

    it("logs validation error when default payment method cannot be retrieved", async () => {
      const { handler, walletSettingRepository, balancesService, stripeService, loggerService, walletSettingWithWallet, job, jobMeta } = setup();
      const balance = generateBalance({ balance: 15.0, deployments: 0, total: 15.0 });
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(walletSettingWithWallet);
      balancesService.getFullBalanceInFiat.mockResolvedValue(balance);
      const error = createHttpError(404, "Default payment method not found", { source: "stripe" });
      stripeService.getDefaultPaymentMethod.mockRejectedValue(error);

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(loggerService.info).toHaveBeenCalledWith({
        event: "ERROR_RETRIEVING_DEFAULT_PAYMENT_METHOD",
        message: "Default payment method not found",
        source: "stripe",
        userId: job.userId
      });
    });
  });

  function setup() {
    const user = UserSeeder.create();
    const userWithStripe = { ...user, stripeCustomerId: faker.string.uuid() };
    const wallet = UserWalletSeeder.create({ userId: user.id });
    const walletSetting = generateWalletSetting({
      userId: user.id,
      walletId: wallet.id,
      autoReloadEnabled: true,
      autoReloadThreshold: 30.0,
      autoReloadAmount: 100.0
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
    const stripeService = mock<StripeService>();
    stripeService.getDefaultPaymentMethod.mockResolvedValue(generatePaymentMethod());
    const jobQueueService = mock<JobQueueService>();
    const loggerService = mock<LoggerService>();

    const handler = new WalletBalanceReloadCheckHandler(walletSettingRepository, balancesService, jobQueueService, stripeService, loggerService);

    return {
      handler,
      walletSettingRepository,
      balancesService,
      stripeService,
      jobQueueService,
      loggerService,
      walletSetting,
      walletSettingWithWallet,
      wallet,
      job,
      jobMeta
    };
  }
});
