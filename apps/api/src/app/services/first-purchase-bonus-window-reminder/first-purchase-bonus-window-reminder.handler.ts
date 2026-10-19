import { inject, singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { firstPurchaseBonusWindowReminderNotification } from "@src/notifications/services/notification-templates/first-purchase-bonus-window-reminder-notification";
import { PromotionalNotificationService } from "@src/notifications/services/promotional-notification/promotional-notification.service";
import { UserRepository } from "@src/user/repositories";
import { FirstPurchaseBonusWindowReminderJob } from "./first-purchase-bonus-window-reminder.job";

@singleton()
export class FirstPurchaseBonusWindowReminderHandler implements JobHandler<FirstPurchaseBonusWindowReminderJob> {
  public readonly accepts = FirstPurchaseBonusWindowReminderJob;

  /** Keeps one reminder queued per person and window, which the window-opened handler relies on when it is delivered twice. */
  public readonly policy = "short";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly firstPurchaseBonusService: FirstPurchaseBonusService,
    private readonly promotionalNotificationService: PromotionalNotificationService,
    private readonly analyticsService: AnalyticsService,
    private readonly billingConfig: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: FirstPurchaseBonusWindowReminderHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ userId, reason }: JobPayload<FirstPurchaseBonusWindowReminderJob>): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user?.email) {
      this.#logger.info({ event: "FIRST_PURCHASE_BONUS_WINDOW_REMINDER_SKIPPED", userId, reason, skipReason: "User or email not found" });
      return;
    }

    const { window, endsAt } = await this.firstPurchaseBonusService.evaluate({ userId }, userId, new Date());
    const windowClosesAt = window === reason ? endsAt : null;
    if (!windowClosesAt) {
      this.#logger.info({ event: "FIRST_PURCHASE_BONUS_WINDOW_REMINDER_SKIPPED", userId, reason, skipReason: "Window is no longer open" });
      return;
    }

    const outcome = await this.promotionalNotificationService.send(
      user,
      firstPurchaseBonusWindowReminderNotification(user, {
        reason,
        closesAt: windowClosesAt.toISOString(),
        paymentLink: this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK")
      })
    );

    if (outcome === "sent") {
      this.analyticsService.track(
        userId,
        "first_purchase_bonus_window_email_sent",
        { reason, kind: "reminder" },
        { insertId: `windowEmailSent.reminder.${reason}.${userId}` }
      );
    }
    this.#logger.info({ event: "FIRST_PURCHASE_BONUS_WINDOW_REMINDER_HANDLED", userId, reason, outcome });
  }
}
