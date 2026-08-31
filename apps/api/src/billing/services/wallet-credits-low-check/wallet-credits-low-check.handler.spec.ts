import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import type { UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { JobPayload } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { creditsRunningLowNotification } from "@src/notifications/services/notification-templates/credits-running-low-notification";
import type { UserRepository } from "@src/user/repositories";
import { WalletCreditsLowCheckHandler } from "./wallet-credits-low-check.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletCreditsLowCheckHandler.name, () => {
  it("sends the credits-running-low notification when paid, Auto Recharge is off, and coverage is below a week", async () => {
    const balanceUsd = 12.5;
    const weeklyCostUsd = 35;
    const paymentLink = "https://console.akash.network/billing?openPayment=true";
    const { handler, user, wallet, notificationService, balancesService, drainingDeploymentService, job } = setup({
      balanceUsd,
      weeklyCostUsd,
      paymentLink
    });

    await handler.handle(job);

    expect(balancesService.getDeploymentBalanceInFiat).toHaveBeenCalledWith(wallet.address);
    expect(drainingDeploymentService.calculateWeeklyCoverageForAddress).toHaveBeenCalledWith(wallet.address);
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      creditsRunningLowNotification(user, {
        balanceUsd,
        weeklyCostUsd,
        daysRemaining: 2,
        paymentLink,
        billingUrl: "https://console.akash.network/billing"
      })
    );
  });

  it("reports less than a day when a runtime-limited deployment front-loads the weekly cost", async () => {
    const paymentLink = "https://console.akash.network/billing?openPayment=true";
    const { handler, user, notificationService, job } = setup({
      balanceUsd: 5,
      weeklyCostUsd: 10,
      cumulativeDailyCostsUsd: [10, 10, 10, 10, 10, 10, 10],
      paymentLink
    });

    await handler.handle(job);

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      creditsRunningLowNotification(user, {
        balanceUsd: 5,
        weeklyCostUsd: 10,
        daysRemaining: 0,
        paymentLink,
        billingUrl: "https://console.akash.network/billing"
      })
    );
  });

  it("does not send when Auto Recharge is enabled", async () => {
    const { handler, notificationService, userWalletRepository, drainingDeploymentService, logger, job } = setup({
      autoReloadEnabled: true
    });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(drainingDeploymentService.calculateWeeklyCoverageForAddress).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_CHECK_SKIPPED", reason: "auto_reload_enabled" }));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("does not send when the wallet is trialing", async () => {
    const { handler, notificationService, userWalletRepository, logger, job } = setup({
      isTrialing: true
    });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_CHECK_SKIPPED", reason: "trialing" }));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("does not send when weekly cost is 0", async () => {
    const { handler, notificationService, userWalletRepository, logger, job } = setup({
      weeklyCostUsd: 0,
      creditsLowSince: null
    });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_CHECK_SKIPPED", reason: "zero_cost" }));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("does not send when balance is at or above weekly cost", async () => {
    const { handler, notificationService, userWalletRepository, logger, job } = setup({
      balanceUsd: 35,
      weeklyCostUsd: 35,
      creditsLowSince: null
    });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_CHECK_SKIPPED", reason: "sufficient_balance" }));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("does not send when already notified and still low", async () => {
    const { handler, notificationService, userWalletRepository, logger, job } = setup({
      creditsLowNotifiedAt: new Date("2026-01-01T00:00:00.000Z")
    });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_CHECK_SKIPPED", reason: "already_notified" }));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("starts the low window instead of sending when credits first read low", async () => {
    const { handler, notificationService, userWalletRepository, wallet, logger, job } = setup({ creditsLowSince: null });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).toHaveBeenCalledWith(wallet.id, { creditsLowSince: expect.any(Date) });
    expect(userWalletRepository.isCreditsLowConfirmed).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_CHECK_SKIPPED", reason: "low_unconfirmed" }));
  });

  it("does not send while credits have not read low for the whole confirmation window", async () => {
    const { handler, notificationService, userWalletRepository, wallet, logger, job } = setup({ isLowConfirmed: false });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.isCreditsLowConfirmed).toHaveBeenCalledWith(wallet.id, 30);
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_CHECK_SKIPPED", reason: "low_unconfirmed" }));
  });

  it("sends once credits have read low for the whole confirmation window", async () => {
    const { handler, notificationService, userWalletRepository, wallet, job } = setup({ confirmWindowMinutes: 45 });

    await handler.handle(job);

    expect(userWalletRepository.isCreditsLowConfirmed).toHaveBeenCalledWith(wallet.id, 45);
    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
  });

  it("restarts the low window when credits read sufficient before the email goes out", async () => {
    const { handler, notificationService, userWalletRepository, wallet, logger, job } = setup({
      balanceUsd: 40,
      weeklyCostUsd: 35
    });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).toHaveBeenCalledWith(wallet.id, { creditsLowSince: null });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_CHECK_SKIPPED", reason: "sufficient_balance" }));
  });

  it("keeps the low window running when the wallet is already notified", async () => {
    const { handler, userWalletRepository, job } = setup({
      creditsLowNotifiedAt: new Date("2026-01-01T00:00:00.000Z")
    });

    await handler.handle(job);

    expect(userWalletRepository.isCreditsLowConfirmed).not.toHaveBeenCalled();
  });

  it("starts the recovery window instead of clearing creditsLowNotifiedAt when the balance first reads recovered", async () => {
    const { handler, notificationService, userWalletRepository, wallet, job } = setup({
      creditsLowNotifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      balanceUsd: 40,
      weeklyCostUsd: 35
    });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).toHaveBeenCalledWith(wallet.id, { creditsSufficientSince: expect.any(Date) });
    expect(userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed).not.toHaveBeenCalled();
  });

  it("starts the recovery window instead of clearing creditsLowNotifiedAt when weekly cost reads 0 with deployments still on auto top-up", async () => {
    const { handler, userWalletRepository, wallet, job } = setup({
      creditsLowNotifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      weeklyCostUsd: 0
    });

    await handler.handle(job);

    expect(userWalletRepository.updateById).toHaveBeenCalledWith(wallet.id, { creditsSufficientSince: expect.any(Date) });
    expect(userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed).not.toHaveBeenCalled();
  });

  it("clears creditsLowNotifiedAt right away when no deployment is on auto top-up anymore", async () => {
    const { handler, userWalletRepository, wallet, user, logger, job } = setup({
      creditsLowNotifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      creditsSufficientSince: new Date("2026-01-01T00:10:00.000Z"),
      weeklyCostUsd: 0,
      hasAutoTopUpSettings: false
    });

    await handler.handle(job);

    expect(userWalletRepository.updateById).toHaveBeenCalledWith(wallet.id, {
      creditsLowNotifiedAt: null,
      creditsSufficientSince: null,
      creditsLowSince: null
    });
    expect(userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "CREDITS_LOW_NOTIFIED_CLEARED", userId: user.id, reason: "zero_cost" });
  });

  it("clears creditsLowNotifiedAt once credits have read sufficient for the whole confirmation window", async () => {
    const creditsSufficientSince = new Date("2026-01-01T00:10:00.000Z");
    const { handler, userWalletRepository, wallet, user, logger, job } = setup({
      creditsLowNotifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      creditsSufficientSince,
      balanceUsd: 40,
      weeklyCostUsd: 35,
      confirmWindowMinutes: 30
    });
    userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed.mockResolvedValue(true);

    await handler.handle(job);

    expect(userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed).toHaveBeenCalledWith(wallet.id, 30);
    expect(logger.info).toHaveBeenCalledWith({
      event: "CREDITS_LOW_NOTIFIED_CLEARED",
      userId: user.id,
      reason: "sufficient_balance",
      creditsSufficientSince
    });
  });

  it("keeps creditsLowNotifiedAt when the recovery window has not elapsed yet", async () => {
    const { handler, userWalletRepository, wallet, logger, job } = setup({
      creditsLowNotifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      creditsSufficientSince: new Date("2026-01-01T00:10:00.000Z"),
      balanceUsd: 40,
      weeklyCostUsd: 35
    });
    userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed.mockResolvedValue(false);

    await handler.handle(job);

    expect(userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed).toHaveBeenCalledWith(wallet.id, expect.any(Number));
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_NOTIFIED_CLEARED" }));
  });

  it("restarts the recovery window when credits read low again while notified", async () => {
    const { handler, notificationService, userWalletRepository, wallet, logger, job } = setup({
      creditsLowNotifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      creditsSufficientSince: new Date("2026-01-01T00:10:00.000Z")
    });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).toHaveBeenCalledWith(wallet.id, { creditsSufficientSince: null });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_CHECK_SKIPPED", reason: "already_notified" }));
  });

  it("fails the job when the recovery window cannot be recorded", async () => {
    const { handler, userWalletRepository, job } = setup({
      creditsLowNotifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      balanceUsd: 40,
      weeklyCostUsd: 35
    });
    userWalletRepository.updateById.mockRejectedValue(new Error("connection reset"));

    await expect(handler.handle(job)).rejects.toThrow("connection reset");
  });

  it("does not send when the user has no email", async () => {
    const { handler, notificationService, userWalletRepository, logger, job } = setup({
      user: createUser({ email: null })
    });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_CHECK_SKIPPED", reason: "no_email" }));
  });

  it("does not fail the job when stamping creditsLowNotifiedAt fails after a successful send", async () => {
    const { handler, notificationService, userWalletRepository, user, logger, job } = setup();
    const error = new Error("connection reset");
    userWalletRepository.updateById.mockRejectedValue(error);

    await expect(handler.handle(job)).resolves.toBeUndefined();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith({ event: "CREDITS_LOW_NOTIFIED_STAMP_FAILED", userId: user.id, error });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_EMAIL_SENT" }));
  });

  it("stamps creditsLowNotifiedAt after a successful send", async () => {
    const { handler, notificationService, userWalletRepository, wallet, logger, job } = setup();

    await handler.handle(job);

    expect(notificationService.createNotification).toHaveBeenCalled();
    expect(userWalletRepository.updateById).toHaveBeenCalledWith(wallet.id, {
      creditsLowNotifiedAt: expect.any(Date),
      creditsSufficientSince: null,
      creditsLowSince: null
    });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "CREDITS_LOW_EMAIL_SENT" }));
  });

  it("sends when wallet settings are missing", async () => {
    const { handler, notificationService, userWalletRepository, job } = setup({
      walletSettingNotFound: true
    });

    await handler.handle(job);

    expect(notificationService.createNotification).toHaveBeenCalled();
    expect(userWalletRepository.updateById).toHaveBeenCalledWith(expect.any(Number), {
      creditsLowNotifiedAt: expect.any(Date),
      creditsSufficientSince: null,
      creditsLowSince: null
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: WalletCreditsLowCheckHandler.name });
  });

  function setup(input?: {
    autoReloadEnabled?: boolean;
    walletSettingNotFound?: boolean;
    isTrialing?: boolean;
    creditsLowNotifiedAt?: Date | null;
    creditsSufficientSince?: Date | null;
    creditsLowSince?: Date | null;
    isLowConfirmed?: boolean;
    user?: ReturnType<typeof createUser>;
    balanceUsd?: number;
    weeklyCostUsd?: number;
    cumulativeDailyCostsUsd?: number[];
    hasAutoTopUpSettings?: boolean;
    confirmWindowMinutes?: number;
    paymentLink?: string;
  }) {
    const user = input?.user ?? createUser({ email: "user@example.com" });
    const wallet = createUserWallet({
      userId: user.id,
      isTrialing: input?.isTrialing ?? false,
      creditsLowNotifiedAt: input?.creditsLowNotifiedAt ?? null,
      creditsSufficientSince: input?.creditsSufficientSince ?? null,
      creditsLowSince: input?.creditsLowSince === undefined ? new Date("2026-01-01T00:00:00.000Z") : input.creditsLowSince
    });
    const walletSetting = generateWalletSetting({
      userId: user.id,
      walletId: wallet.id,
      autoReloadEnabled: input?.autoReloadEnabled ?? false
    });
    const job: JobPayload<WalletCreditsLowCheck> = {
      userId: user.id,
      version: 1
    };
    const paymentLink = input?.paymentLink ?? "https://console.akash.network/billing?openPayment=true";
    const balanceUsd = input?.balanceUsd ?? 12.5;
    const weeklyCostUsd = input?.weeklyCostUsd ?? 35;
    const cumulativeDailyCostsUsd =
      input?.cumulativeDailyCostsUsd ?? (weeklyCostUsd === 0 ? [] : Array.from({ length: 7 }, (_, day) => ((day + 1) * weeklyCostUsd) / 7));

    const walletSettingRepository = mock<WalletSettingRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const userRepository = mock<UserRepository>();
    const balancesService = mock<BalancesService>();
    const drainingDeploymentService = mock<DrainingDeploymentService>();
    const notificationService = mock<NotificationService>({
      createNotification: vi.fn().mockResolvedValue(undefined)
    });
    const billingConfig = mockConfigService<BillingConfigService>({
      CONSOLE_WEB_PAYMENT_LINK: paymentLink,
      CREDITS_LOW_RECOVERY_CONFIRM_WINDOW_MIN: input?.confirmWindowMinutes ?? 30,
      CREDITS_LOW_CONFIRM_WINDOW_MIN: input?.confirmWindowMinutes ?? 30
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    walletSettingRepository.findByUserId.mockResolvedValue(input?.walletSettingNotFound ? undefined : walletSetting);

    userWalletRepository.findOneByUserId.mockResolvedValue(wallet);
    userRepository.findById.mockResolvedValue(user);
    balancesService.getDeploymentBalanceInFiat.mockResolvedValue(balanceUsd);
    drainingDeploymentService.calculateWeeklyCoverageForAddress.mockResolvedValue({
      weeklyCostUsd,
      cumulativeDailyCostsUsd,
      hasAutoTopUpSettings: input?.hasAutoTopUpSettings ?? true
    });
    userWalletRepository.updateById.mockResolvedValue(undefined);
    userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed.mockResolvedValue(false);
    userWalletRepository.isCreditsLowConfirmed.mockResolvedValue(input?.isLowConfirmed ?? true);

    const handler = new WalletCreditsLowCheckHandler(
      walletSettingRepository,
      userWalletRepository,
      userRepository,
      balancesService,
      drainingDeploymentService,
      notificationService,
      billingConfig,
      createLogger
    );

    return {
      handler,
      walletSettingRepository,
      userWalletRepository,
      userRepository,
      balancesService,
      drainingDeploymentService,
      notificationService,
      billingConfig,
      logger,
      createLogger,
      user,
      wallet,
      walletSetting,
      job
    };
  }
});
