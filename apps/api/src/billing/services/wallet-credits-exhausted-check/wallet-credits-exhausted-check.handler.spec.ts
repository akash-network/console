import { Err, Ok } from "ts-results";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletCreditsExhaustedCheck } from "@src/billing/events/wallet-credits-exhausted-check";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type {
  CreditsWarningIneligibility,
  CreditsWarningRecipientService
} from "@src/billing/services/credits-warning-recipient/credits-warning-recipient.service";
import type { JobPayload } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { creditsExhaustedNotification } from "@src/notifications/services/notification-templates/credits-exhausted-notification";
import { WalletCreditsExhaustedCheckHandler } from "./wallet-credits-exhausted-check.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";
import { createInitializedUserWallet } from "@test/seeders/user-wallet.seeder";

describe(WalletCreditsExhaustedCheckHandler.name, () => {
  it("warns a user whose credits-low email went out that their deployments are about to close", async () => {
    const paymentLink = "https://console.akash.network/billing?openPayment=true";
    const { handler, job, user, notificationService } = setup({ paymentLink });

    await handler.handle(job);

    expect(notificationService.createNotification).toHaveBeenCalledExactlyOnceWith(
      creditsExhaustedNotification(user, {
        firstClosingDseq: job.firstClosingDseq,
        unfundedDeploymentCount: job.unfundedDeploymentCount,
        firstClosureAt: job.firstClosureAt,
        paymentLink,
        billingUrl: "https://console.akash.network/billing"
      })
    );
  });

  it("stamps the wallet once the warning is sent and logs it", async () => {
    const { handler, job, wallet, userWalletRepository, logger } = setup();

    await handler.handle(job);

    expect(userWalletRepository.updateById).toHaveBeenCalledExactlyOnceWith(wallet.id, { creditsExhaustedNotifiedAt: expect.any(Date) });
    expect(logger.info).toHaveBeenCalledWith({
      event: "CREDITS_EXHAUSTED_EMAIL_SENT",
      userId: job.userId,
      firstClosingDseq: job.firstClosingDseq,
      unfundedDeploymentCount: job.unfundedDeploymentCount,
      firstClosureAt: job.firstClosureAt
    });
  });

  it("logs a failed stamp instead of failing the job, so a retry cannot resend the warning", async () => {
    const error = new Error("database unavailable");
    const { handler, job, userWalletRepository, logger } = setup();
    userWalletRepository.updateById.mockRejectedValue(error);

    await expect(handler.handle(job)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith({ event: "CREDITS_EXHAUSTED_NOTIFIED_STAMP_FAILED", userId: job.userId, error });
  });

  it("stamps nothing when the warning cannot be sent, so the next funding pass tries again", async () => {
    const { handler, job, notificationService, userWalletRepository } = setup();
    notificationService.createNotification.mockRejectedValue(new Error("notifications unavailable"));

    await expect(handler.handle(job)).rejects.toThrow("notifications unavailable");

    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
  });

  it("does not warn a user the credits-low email has not reached yet", async () => {
    const { handler, job, notificationService, userWalletRepository, logger } = setup({ creditsLowNotifiedAt: null });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "CREDITS_EXHAUSTED_CHECK_SKIPPED", userId: job.userId, reason: "credits_low_not_notified" });
  });

  it("does not warn twice within one low episode", async () => {
    const { handler, job, notificationService, userWalletRepository, logger } = setup({ creditsExhaustedNotifiedAt: new Date() });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "CREDITS_EXHAUSTED_CHECK_SKIPPED", userId: job.userId, reason: "already_notified" });
  });

  it.each<CreditsWarningIneligibility>(["auto_reload_enabled", "trialing", "abuse_locked"])("does not warn a %s user", async reason => {
    const { handler, job, notificationService, userWalletRepository, logger } = setup({ ineligibility: reason });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "CREDITS_EXHAUSTED_CHECK_SKIPPED", userId: job.userId, reason });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each<CreditsWarningIneligibility>(["no_wallet", "no_email"])("warns operators instead of the user on an unexpected %s", async reason => {
    const { handler, job, notificationService, logger } = setup({ ineligibility: reason });

    await handler.handle(job);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({ event: "CREDITS_EXHAUSTED_CHECK_SKIPPED", userId: job.userId, reason });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("uses the singleton policy so the per-user singletonKey keeps two checks of one user from both warning", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("singleton");
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: WalletCreditsExhaustedCheckHandler.name });
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input?: {
    ineligibility?: CreditsWarningIneligibility;
    creditsLowNotifiedAt?: Date | null;
    creditsExhaustedNotifiedAt?: Date | null;
    paymentLink?: string;
  }) {
    const user = createUser({ email: "user@example.com" });
    const wallet = createInitializedUserWallet({
      userId: user.id,
      isTrialing: false,
      creditsLowNotifiedAt: input?.creditsLowNotifiedAt === undefined ? new Date("2026-10-01T00:00:00.000Z") : input.creditsLowNotifiedAt,
      creditsExhaustedNotifiedAt: input?.creditsExhaustedNotifiedAt ?? null
    });
    const job: JobPayload<WalletCreditsExhaustedCheck> = {
      userId: user.id,
      firstClosingDseq: "1234567",
      unfundedDeploymentCount: 2,
      firstClosureAt: "2026-10-05T12:00:00.000Z",
      version: 1
    };

    const creditsWarningRecipientService = mock<CreditsWarningRecipientService>();
    creditsWarningRecipientService.find.mockResolvedValue(input?.ineligibility ? Err(input.ineligibility) : Ok({ wallet, user }));
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.updateById.mockResolvedValue(undefined);
    const notificationService = mock<NotificationService>({
      createNotification: vi.fn().mockResolvedValue(undefined)
    });
    const billingConfig = mockConfigService<BillingConfigService>({
      CONSOLE_WEB_PAYMENT_LINK: input?.paymentLink ?? "https://console.akash.network/billing?openPayment=true"
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new WalletCreditsExhaustedCheckHandler(
      creditsWarningRecipientService,
      userWalletRepository,
      notificationService,
      billingConfig,
      createLogger
    );

    return { handler, job, user, wallet, creditsWarningRecipientService, userWalletRepository, notificationService, logger, createLogger };
  }
});
