import { faker } from "@faker-js/faker";
import { addDays, addMilliseconds, subDays } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FirstPurchaseBonusWindowOpened } from "@src/billing/events/first-purchase-bonus-window-opened";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { BonusEligibility, FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import type { EventPayload, JobQueueService } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { firstPurchaseBonusWindowOpenedNotification } from "@src/notifications/services/notification-templates/first-purchase-bonus-window-opened-notification";
import type {
  PromotionalNotificationOutcome,
  PromotionalNotificationService
} from "@src/notifications/services/promotional-notification/promotional-notification.service";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { FirstPurchaseBonusWindowReminderJob } from "../first-purchase-bonus-window-reminder/first-purchase-bonus-window-reminder.job";
import { FirstPurchaseBonusWindowOpenedHandler } from "./first-purchase-bonus-window-opened.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";

const NOW = new Date("2026-10-19T12:00:00.000Z");
const WINDOW_CLOSES_AT = new Date("2026-10-26T11:00:00.000Z");
const PAYMENT_LINK = "https://console.akash.network/billing?openPayment=true";

describe(FirstPurchaseBonusWindowOpenedHandler.name, () => {
  it("emails the person that the bonus is still theirs until the window closes", async () => {
    const { handler, payload, user, promotionalNotificationService } = setup();

    await handler.handle(payload);

    expect(promotionalNotificationService.send).toHaveBeenCalledExactlyOnceWith(
      user,
      firstPurchaseBonusWindowOpenedNotification(user, { reason: "small_first_purchase", closesAt: WINDOW_CLOSES_AT.toISOString(), paymentLink: PAYMENT_LINK })
    );
  });

  it("checks whether the person can still earn the bonus on their own account when it handles the event", async () => {
    const { handler, payload, firstPurchaseBonusService } = setup();

    await handler.handle(payload);

    expect(firstPurchaseBonusService.evaluate).toHaveBeenCalledWith({ userId: payload.userId }, payload.userId, NOW);
  });

  it("dates the email with the window's live close rather than the one the event carried", async () => {
    const liveClose = addDays(WINDOW_CLOSES_AT, -1);
    const { handler, payload, user, promotionalNotificationService } = setup({
      eligibility: { eligible: true, endsAt: liveClose, window: "small_first_purchase" }
    });

    await handler.handle(payload);

    expect(promotionalNotificationService.send).toHaveBeenCalledWith(
      user,
      firstPurchaseBonusWindowOpenedNotification(user, { reason: "small_first_purchase", closesAt: liveClose.toISOString(), paymentLink: PAYMENT_LINK })
    );
  });

  it("schedules one reminder per person and window 2 days before the window closes", async () => {
    const { handler, payload, jobQueueService } = setup();

    await handler.handle(payload);

    expect(jobQueueService.enqueue).toHaveBeenCalledExactlyOnceWith(
      new FirstPurchaseBonusWindowReminderJob({ userId: payload.userId, reason: "small_first_purchase", closesAt: WINDOW_CLOSES_AT.toISOString() }),
      { singletonKey: `firstPurchaseBonusWindowReminder.small_first_purchase.${payload.userId}`, startAfter: subDays(WINDOW_CLOSES_AT, 2) }
    );
  });

  it.each([
    { case: "exactly 2 days", closesAt: addDays(NOW, 2), scheduled: false },
    { case: "just over 2 days", closesAt: addMilliseconds(addDays(NOW, 2), 1), scheduled: true }
  ])("schedules a reminder only when the window closes in more than 2 days, here $case away", async ({ closesAt, scheduled }) => {
    const { handler, payload, jobQueueService, promotionalNotificationService } = setup({
      eligibility: { eligible: true, endsAt: closesAt, window: "small_first_purchase" }
    });

    await handler.handle(payload);

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(scheduled ? 1 : 0);
    expect(promotionalNotificationService.send).toHaveBeenCalledOnce();
  });

  it("tracks the window opening and the email sent, once per person and window", async () => {
    const { handler, payload, analyticsService } = setup();

    await handler.handle(payload);

    expect(analyticsService.track.mock.calls).toEqual([
      [
        payload.userId,
        "first_purchase_bonus_window_opened",
        { reason: "small_first_purchase", has_deadline: true },
        { insertId: `windowOpened.small_first_purchase.${payload.userId}` }
      ],
      [
        payload.userId,
        "first_purchase_bonus_window_email_sent",
        { reason: "small_first_purchase", kind: "opened" },
        { insertId: `windowEmailSent.opened.small_first_purchase.${payload.userId}` }
      ]
    ]);
  });

  it.each(["unsubscribed", "unsubscribe_unavailable"] as const)(
    "tracks the window opening and schedules the reminder, but no email sent, when the email is %s",
    async outcome => {
      const { handler, payload, analyticsService, jobQueueService } = setup({ outcome });

      await handler.handle(payload);

      expect(analyticsService.track).toHaveBeenCalledExactlyOnceWith(
        payload.userId,
        "first_purchase_bonus_window_opened",
        expect.anything(),
        expect.anything()
      );
      expect(jobQueueService.enqueue).toHaveBeenCalledOnce();
    }
  );

  it.each([
    { case: "the person can no longer earn the bonus", eligibility: { eligible: false, endsAt: null, window: null } },
    { case: "the account has no window open", eligibility: { eligible: true, endsAt: null, window: null } },
    { case: "another window is the open one", eligibility: { eligible: true, endsAt: WINDOW_CLOSES_AT, window: "gpu_win_back" } }
  ] satisfies { case: string; eligibility: BonusEligibility }[])("sends, tracks and schedules nothing when $case", async ({ eligibility }) => {
    const { handler, payload, promotionalNotificationService, analyticsService, jobQueueService, logger } = setup({ eligibility });

    await handler.handle(payload);

    expect(promotionalNotificationService.send).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "FIRST_PURCHASE_BONUS_WINDOW_OPENED_EMAIL_SKIPPED", userId: payload.userId }));
  });

  it.each([
    { case: "is gone", user: undefined },
    { case: "has no email", user: createUser({ email: null }) }
  ])("sends, tracks and schedules nothing when the user $case", async ({ user }) => {
    const { handler, payload, promotionalNotificationService, analyticsService, jobQueueService, firstPurchaseBonusService } = setup({ user });

    await handler.handle(payload);

    expect(firstPurchaseBonusService.evaluate).not.toHaveBeenCalled();
    expect(promotionalNotificationService.send).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("looks the person up by the event's user", async () => {
    const { handler, payload, userRepository } = setup();

    await handler.handle(payload);

    expect(userRepository.findById).toHaveBeenCalledWith(payload.userId);
  });

  it("creates the logger with the handler context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: FirstPurchaseBonusWindowOpenedHandler.name });
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
    const payload: EventPayload<FirstPurchaseBonusWindowOpened> = {
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
    const jobQueueService = mock<JobQueueService>();
    const analyticsService = mock<AnalyticsService>();
    const billingConfig = mockConfigService<BillingConfigService>({ CONSOLE_WEB_PAYMENT_LINK: PAYMENT_LINK });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new FirstPurchaseBonusWindowOpenedHandler(
      userRepository,
      firstPurchaseBonusService,
      promotionalNotificationService,
      jobQueueService,
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
      jobQueueService,
      analyticsService,
      logger,
      createLogger
    };
  }
});
