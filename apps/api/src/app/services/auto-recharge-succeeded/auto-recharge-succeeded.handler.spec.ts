import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AutoRechargeSucceeded } from "@src/billing/events/auto-recharge-succeeded";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { BillingContactsService } from "@src/billing/services/billing-contacts/billing-contacts.service";
import type { EventPayload } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { autoRechargeSucceededNotification } from "@src/notifications/services/notification-templates/auto-recharge-succeeded-notification";
import type { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { UserRepository } from "@src/user/repositories";
import { AutoRechargeSucceededHandler } from "./auto-recharge-succeeded.handler";

import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(AutoRechargeSucceededHandler.name, () => {
  const payload: EventPayload<AutoRechargeSucceeded> = { userId: "user-123", transactionId: "txn-1", amountCents: 5000, version: 1 };

  it("sends the auto-recharge notification with the resulting balance and a plain billing link", async () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const wallet = createUserWallet({ userId: "user-123" });
    const { handler, userWalletRepository, balancesService, notificationService } = setup({
      user,
      wallet,
      balanceUsd: 120.5,
      paymentLink: "https://console.akash.network/billing?openPayment=true"
    });

    await handler.handle(payload);

    expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith("user-123");
    expect(balancesService.getDeploymentBalanceInFiat).toHaveBeenCalledWith(wallet.address);
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      autoRechargeSucceededNotification(user, {
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
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTO_RECHARGE_SUCCESS_EMAIL_SKIPPED", userId: "user-123" }));
  });

  it("skips and warns when the user has no email", async () => {
    const user = createUser({ id: "user-123", email: null });
    const { handler, notificationService, logger } = setup({ user });

    await handler.handle(payload);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTO_RECHARGE_SUCCESS_EMAIL_SKIPPED" }));
  });

  it("skips and warns when the wallet address is missing", async () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const { handler, notificationService, logger } = setup({ user, wallet: undefined });

    await handler.handle(payload);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTO_RECHARGE_SUCCESS_EMAIL_SKIPPED", reason: "Wallet address not found" }));
  });

  it("skips a recharge that names neither a wallet nor a member", async () => {
    const { handler, notificationService, userWalletRepository, logger } = setup({ user: null });

    await handler.handle({ ...payload, userId: null });

    expect(userWalletRepository.findOneByUserId).not.toHaveBeenCalled();
    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTO_RECHARGE_SUCCESS_EMAIL_SKIPPED", reason: "Wallet address not found" }));
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup({ user: null });

    expect(createLogger).toHaveBeenCalledWith({ context: AutoRechargeSucceededHandler.name });
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup({ user: null });

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("emails every owner and billing member of a team's wallet, logging a failed send instead of failing", async () => {
    const teamWallet = { ...createUserWallet({ organizationId: "org-team" }), userId: null };
    const contacts = [createUser({ email: "owner@example.com" }), createUser({ email: "billing@example.com" })];
    const { handler, notificationService, userWalletRepository, organizationMemberRepository, logger } = setup({ user: null });
    const error = new Error("notifications unavailable");
    userWalletRepository.findById.mockResolvedValue(teamWallet);
    organizationMemberRepository.findBillingContacts.mockResolvedValue(contacts);
    notificationService.createNotification.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);

    await handler.handle({ userId: "member-1", transactionId: "tx-1", amountCents: 2500, walletId: teamWallet.id, version: 1 });

    expect(organizationMemberRepository.findBillingContacts).toHaveBeenCalledWith("org-team");
    expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith({ event: "AUTO_RECHARGE_SUCCESS_EMAIL_FAILED", userId: "member-1", recipientUserId: contacts[0].id, error });
  });

  function setup(input: {
    user: ReturnType<typeof createUser> | null;
    wallet?: ReturnType<typeof createUserWallet>;
    balanceUsd?: number;
    paymentLink?: string;
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
        get: vi.fn().mockReturnValue(input.paymentLink ?? "https://console.akash.network/billing?openPayment=true")
      }),
      organizationMemberRepository: mock<OrganizationMemberRepository>(),
      logger: mock<ReturnType<CreateLogger>>()
    };

    const createLogger = vi.fn<CreateLogger>(() => mocks.logger);

    const handler = new AutoRechargeSucceededHandler(
      mocks.notificationService,
      new BillingContactsService(mocks.userRepository, mocks.organizationMemberRepository),
      mocks.userWalletRepository,
      mocks.balancesService,
      mocks.billingConfig,
      createLogger
    );

    return { handler, createLogger, ...mocks };
  }
});
