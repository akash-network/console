import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AutoTopUpSucceeded } from "@src/billing/events/auto-top-up-succeeded";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { EventPayload } from "@src/core";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { autoTopUpSucceededNotification } from "@src/notifications/services/notification-templates/auto-top-up-succeeded-notification";
import type { UserRepository } from "@src/user/repositories";
import { AutoTopUpSucceededHandler } from "./auto-top-up-succeeded.handler";

import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(AutoTopUpSucceededHandler.name, () => {
  const payload: EventPayload<AutoTopUpSucceeded> = { userId: "user-123", transactionId: "txn-1", amountCents: 5000, version: 1 };

  it("sends the auto-top-up notification with the resulting balance and billing link", async () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const wallet = createUserWallet({ userId: "user-123" });
    const { handler, userWalletRepository, balancesService, notificationService } = setup({
      user,
      wallet,
      balanceUsd: 120.5,
      billingUrl: "https://console.akash.network/billing"
    });

    await handler.handle(payload);

    expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith("user-123");
    expect(balancesService.getDeploymentBalanceInFiat).toHaveBeenCalledWith(wallet.address);
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      autoTopUpSucceededNotification(user, {
        transactionId: "txn-1",
        amountCents: 5000,
        balanceUsd: 120.5,
        billingUrl: "https://console.akash.network/billing"
      })
    );
  });

  it("skips and warns when the user is not found", async () => {
    const { handler, notificationService, logger } = setup({ user: null });

    await handler.handle(payload);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTO_TOP_UP_SUCCESS_EMAIL_SKIPPED", userId: "user-123" }));
  });

  it("skips and warns when the user has no email", async () => {
    const user = createUser({ id: "user-123", email: null });
    const { handler, notificationService, logger } = setup({ user });

    await handler.handle(payload);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTO_TOP_UP_SUCCESS_EMAIL_SKIPPED" }));
  });

  it("skips and warns when the wallet address is missing", async () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const { handler, notificationService, logger } = setup({ user, wallet: undefined });

    await handler.handle(payload);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTO_TOP_UP_SUCCESS_EMAIL_SKIPPED", reason: "Wallet address not found" }));
  });

  function setup(input: {
    user: ReturnType<typeof createUser> | null;
    wallet?: ReturnType<typeof createUserWallet>;
    balanceUsd?: number;
    billingUrl?: string;
  }) {
    const mocks = {
      notificationService: mock<NotificationService>({
        createNotification: vi.fn().mockResolvedValue(undefined)
      }),
      userRepository: mock<UserRepository>({
        findById: vi.fn().mockResolvedValue(input.user)
      }),
      userWalletRepository: mock<UserWalletRepository>({
        findOneByUserId: vi.fn().mockResolvedValue(input.wallet)
      }),
      balancesService: mock<BalancesService>({
        getDeploymentBalanceInFiat: vi.fn().mockResolvedValue(input.balanceUsd ?? 0)
      }),
      billingConfig: mock<BillingConfigService>({
        get: vi.fn().mockReturnValue(input.billingUrl ?? "https://console.akash.network/billing")
      }),
      logger: mock<LoggerService>()
    };

    const handler = new AutoTopUpSucceededHandler(
      mocks.notificationService,
      mocks.userRepository,
      mocks.userWalletRepository,
      mocks.balancesService,
      mocks.billingConfig,
      mocks.logger
    );

    return { handler, ...mocks };
  }
});
