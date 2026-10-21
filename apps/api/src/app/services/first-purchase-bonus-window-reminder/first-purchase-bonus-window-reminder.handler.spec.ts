import { faker } from "@faker-js/faker";
import { addDays } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { BonusEligibility, FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import type { JobPayload } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { firstPurchaseBonusWindowReminderNotification } from "@src/notifications/services/notification-templates/first-purchase-bonus-window-reminder-notification";
import type {
  PromotionalNotificationOutcome,
  PromotionalNotificationService
} from "@src/notifications/services/promotional-notification/promotional-notification.service";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { FirstPurchaseBonusWindowReminderHandler } from "./first-purchase-bonus-window-reminder.handler";
import type { FirstPurchaseBonusWindowReminderJob } from "./first-purchase-bonus-window-reminder.job";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";

const NOW = new Date("2026-10-24T11:00:00.000Z");
const WINDOW_CLOSES_AT = new Date("2026-10-26T11:00:00.000Z");
const PAYMENT_LINK = "https://console.akash.network/billing?openPayment=true";

describe(FirstPurchaseBonusWindowReminderHandler.name, () => {
  it("reminds the person that the bonus ends when the window closes", async () => {
    const { handler, payload, user, promotionalNotificationService } = setup();

    await handler.handle(payload);

    expect(promotionalNotificationService.send).toHaveBeenCalledExactlyOnceWith(
      user,
      firstPurchaseBonusWindowReminderNotification(user, {
        reason: "small_first_purchase",
        closesAt: WINDOW_CLOSES_AT.toISOString(),
        paymentLink: PAYMENT_LINK
      })
    );
  });

  it("checks whether the person can still earn the bonus on their own account when the reminder is due", async () => {
    const { handler, payload, firstPurchaseBonusService } = setup();

    await handler.handle(payload);

    expect(firstPurchaseBonusService.evaluate).toHaveBeenCalledWith({ userId: payload.userId }, payload.userId, NOW);
  });

  it("dates the reminder with the window's live close rather than the one it was scheduled for", async () => {
    const liveClose = addDays(WINDOW_CLOSES_AT, -1);
    const { handler, payload, user, promotionalNotificationService } = setup({
      eligibility: { eligible: true, endsAt: liveClose, window: "small_first_purchase" }
    });

    await handler.handle(payload);

    expect(promotionalNotificationService.send).toHaveBeenCalledWith(
      user,
      firstPurchaseBonusWindowReminderNotification(user, { reason: "small_first_purchase", closesAt: liveClose.toISOString(), paymentLink: PAYMENT_LINK })
    );
  });

  it("tracks the reminder sent, once per person and window", async () => {
    const { handler, payload, analyticsService } = setup();

    await handler.handle(payload);

    expect(analyticsService.track).toHaveBeenCalledExactlyOnceWith(
      payload.userId,
      "first_purchase_bonus_window_email_sent",
      { reason: "small_first_purchase", kind: "reminder" },
      { insertId: `windowEmailSent.reminder.small_first_purchase.${payload.userId}` }
    );
  });

  it.each(["unsubscribed", "unsubscribe_unavailable"] as const)("tracks nothing when the reminder is %s", async outcome => {
    const { handler, payload, analyticsService } = setup({ outcome });

    await handler.handle(payload);

    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it.each([
    { case: "the person earned the bonus since", eligibility: { eligible: false, endsAt: null, window: null } },
    { case: "the account has no window open", eligibility: { eligible: true, endsAt: null, window: null } },
    { case: "another window is the open one", eligibility: { eligible: true, endsAt: WINDOW_CLOSES_AT, window: "gpu_win_back" } }
  ] satisfies { case: string; eligibility: BonusEligibility }[])("reminds nothing when $case", async ({ eligibility }) => {
    const { handler, payload, promotionalNotificationService, analyticsService, logger } = setup({ eligibility });

    await handler.handle(payload);

    expect(promotionalNotificationService.send).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "FIRST_PURCHASE_BONUS_WINDOW_REMINDER_SKIPPED", userId: payload.userId }));
  });

  it.each([
    { case: "is gone", user: undefined },
    { case: "has no email", user: createUser({ email: null }) }
  ])("reminds nothing when the user $case", async ({ user }) => {
    const { handler, payload, promotionalNotificationService, firstPurchaseBonusService } = setup({ user });

    await handler.handle(payload);

    expect(firstPurchaseBonusService.evaluate).not.toHaveBeenCalled();
    expect(promotionalNotificationService.send).not.toHaveBeenCalled();
  });

  it("looks the person up by the reminder's user", async () => {
    const { handler, payload, userRepository } = setup();

    await handler.handle(payload);

    expect(userRepository.findById).toHaveBeenCalledWith(payload.userId);
  });

  it("keeps one reminder queued per key", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("short");
  });

  it("creates the logger with the handler context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: FirstPurchaseBonusWindowReminderHandler.name });
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input: { user?: UserOutput; eligibility?: BonusEligibility; outcome?: PromotionalNotificationOutcome } = {}) {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const user = "user" in input ? input.user : createUser({ id: faker.string.uuid(), email: faker.internet.email() });
    const payload: JobPayload<FirstPurchaseBonusWindowReminderJob> = {
      userId: user?.id ?? faker.string.uuid(),
      reason: "small_first_purchase",
      closesAt: WINDOW_CLOSES_AT.toISOString(),
      version: 1
    };
    const userRepository = mock<UserRepository>({ findById: vi.fn().mockResolvedValue(user) });
    const firstPurchaseBonusService = mock<FirstPurchaseBonusService>({
      evaluate: vi.fn().mockResolvedValue(input.eligibility ?? { eligible: true, endsAt: WINDOW_CLOSES_AT, window: "small_first_purchase" })
    });
    const promotionalNotificationService = mock<PromotionalNotificationService>({ send: vi.fn().mockResolvedValue(input.outcome ?? "sent") });
    const analyticsService = mock<AnalyticsService>();
    const billingConfig = mockConfigService<BillingConfigService>({ CONSOLE_WEB_PAYMENT_LINK: PAYMENT_LINK });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new FirstPurchaseBonusWindowReminderHandler(
      userRepository,
      firstPurchaseBonusService,
      promotionalNotificationService,
      analyticsService,
      billingConfig,
      createLogger
    );

    return {
      handler,
      payload,
      user: user as UserOutput,
      userRepository,
      firstPurchaseBonusService,
      promotionalNotificationService,
      analyticsService,
      logger,
      createLogger
    };
  }
});
