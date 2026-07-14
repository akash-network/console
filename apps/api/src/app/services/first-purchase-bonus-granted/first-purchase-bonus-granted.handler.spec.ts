import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FirstPurchaseBonusGranted } from "@src/billing/events/first-purchase-bonus-granted";
import type { EventPayload } from "@src/core";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { firstPurchaseBonusGrantedNotification } from "@src/notifications/services/notification-templates/first-purchase-bonus-granted-notification";
import type { UserRepository } from "@src/user/repositories";
import { FirstPurchaseBonusGrantedHandler } from "./first-purchase-bonus-granted.handler";

import { createUser } from "@test/seeders/user.seeder";

describe(FirstPurchaseBonusGrantedHandler.name, () => {
  const payload: EventPayload<FirstPurchaseBonusGranted> = { userId: "user-123", bonusAmountCents: 1500, paidAmountCents: 15000, version: 1 };

  it("sends the bonus-granted notification when the user has an email", async () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const { handler, userRepository, notificationService } = setup({ findUserById: vi.fn().mockResolvedValue(user) });

    await handler.handle(payload);

    expect(userRepository.findById).toHaveBeenCalledWith("user-123");
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      firstPurchaseBonusGrantedNotification(user, { bonusAmountCents: 1500, paidAmountCents: 15000 })
    );
  });

  it("skips and warns when the user is not found", async () => {
    const { handler, notificationService, logger } = setup({ findUserById: vi.fn().mockResolvedValue(null) });

    await handler.handle(payload);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "FIRST_PURCHASE_BONUS_EMAIL_SKIPPED", userId: "user-123" }));
  });

  it("skips and warns when the user has no email", async () => {
    const user = createUser({ id: "user-123", email: null });
    const { handler, notificationService, logger } = setup({ findUserById: vi.fn().mockResolvedValue(user) });

    await handler.handle(payload);

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "FIRST_PURCHASE_BONUS_EMAIL_SKIPPED" }));
  });

  function setup(input?: { findUserById?: UserRepository["findById"] }) {
    const mocks = {
      notificationService: mock<NotificationService>({
        createNotification: vi.fn().mockResolvedValue(undefined)
      }),
      userRepository: mock<UserRepository>({
        findById: input?.findUserById ?? vi.fn()
      }),
      logger: mock<LoggerService>()
    };

    const handler = new FirstPurchaseBonusGrantedHandler(mocks.notificationService, mocks.userRepository, mocks.logger);

    return { handler, ...mocks };
  }
});
