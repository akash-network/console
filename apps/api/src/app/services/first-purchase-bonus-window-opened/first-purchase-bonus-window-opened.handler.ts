import { inject, singleton } from "tsyringe";

import { type EmailedBonusWindowReason, FirstPurchaseBonusWindowOpened } from "@src/billing/events/first-purchase-bonus-window-opened";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type BonusEligibility, FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import { type CreateLogger, type EventPayload, type JobHandler, type JobPermissions, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { firstPurchaseBonusWindowOpenedNotification } from "@src/notifications/services/notification-templates/first-purchase-bonus-window-opened-notification";
import { PromotionalNotificationService } from "@src/notifications/services/promotional-notification/promotional-notification.service";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import {
  firstPurchaseBonusWindowRemindAt,
  FirstPurchaseBonusWindowReminderJob,
  firstPurchaseBonusWindowReminderOptionsFor
} from "../first-purchase-bonus-window-reminder/first-purchase-bonus-window-reminder.job";

@singleton()
export class FirstPurchaseBonusWindowOpenedHandler implements JobHandler<FirstPurchaseBonusWindowOpened> {
  public readonly accepts = FirstPurchaseBonusWindowOpened;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly firstPurchaseBonusService: FirstPurchaseBonusService,
    private readonly promotionalNotificationService: PromotionalNotificationService,
    private readonly jobQueueService: JobQueueService,
    private readonly analyticsService: AnalyticsService,
    private readonly billingConfig: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: FirstPurchaseBonusWindowOpenedHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Reads the deadline from the live eligibility, which counts a first payment whose webhook arrived after this event was published. */
  async handle({ userId, reason, closesAt }: EventPayload<FirstPurchaseBonusWindowOpened>): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user?.email) {
      this.#logger.info({ event: "FIRST_PURCHASE_BONUS_WINDOW_OPENED_EMAIL_SKIPPED", userId, reason, skipReason: "User or email not found" });
      return;
    }

    const now = new Date();
    const eligibility = await this.firstPurchaseBonusService.evaluate({ userId }, userId, now);

    if (closesAt === null) {
      await this.#announceWithoutDeadline(user, reason, eligibility);
      return;
    }

    const windowClosesAt = eligibility.window === reason ? eligibility.endsAt : null;
    if (!windowClosesAt) {
      this.#logger.info({ event: "FIRST_PURCHASE_BONUS_WINDOW_OPENED_EMAIL_SKIPPED", userId, reason, closesAt, skipReason: "Window is no longer open" });
      return;
    }

    this.#trackOpened(userId, reason, true);
    await this.#scheduleReminder({ userId, reason, closesAt: windowClosesAt.toISOString() }, now);
    await this.#sendOpenedEmail(user, reason, windowClosesAt.toISOString());
  }

  /** A person who never paid keeps the bonus until their first purchase, so no reminder follows, and a purchase made since then ends this offer. */
  async #announceWithoutDeadline(user: UserOutput, reason: EmailedBonusWindowReason, { eligible, endsAt }: BonusEligibility): Promise<void> {
    if (!eligible || endsAt) {
      this.#logger.info({
        event: "FIRST_PURCHASE_BONUS_WINDOW_OPENED_EMAIL_SKIPPED",
        userId: user.id,
        reason,
        closesAt: null,
        skipReason: "Bonus is no longer open without a deadline"
      });
      return;
    }

    this.#trackOpened(user.id, reason, false);
    await this.#sendOpenedEmail(user, reason, null);
  }

  #trackOpened(userId: string, reason: EmailedBonusWindowReason, hasDeadline: boolean): void {
    this.analyticsService.track(
      userId,
      "first_purchase_bonus_window_opened",
      { reason, has_deadline: hasDeadline },
      { insertId: `windowOpened.${reason}.${userId}` }
    );
  }

  async #sendOpenedEmail(user: UserOutput, reason: EmailedBonusWindowReason, closesAt: string | null): Promise<void> {
    const userId = user.id;
    const outcome = await this.promotionalNotificationService.send(
      user,
      firstPurchaseBonusWindowOpenedNotification(user, { reason, closesAt, paymentLink: this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK") })
    );

    if (outcome === "sent") {
      this.analyticsService.track(
        userId,
        "first_purchase_bonus_window_email_sent",
        { reason, kind: "opened" },
        { insertId: `windowEmailSent.opened.${reason}.${userId}` }
      );
    }
    this.#logger.info({ event: "FIRST_PURCHASE_BONUS_WINDOW_OPENED_EMAIL_HANDLED", userId, reason, outcome });
  }

  async #scheduleReminder(reminder: FirstPurchaseBonusWindowReminderJob["data"], now: Date): Promise<void> {
    if (firstPurchaseBonusWindowRemindAt(reminder.reason, new Date(reminder.closesAt)) <= now) return;

    await this.jobQueueService.enqueue(new FirstPurchaseBonusWindowReminderJob(reminder), firstPurchaseBonusWindowReminderOptionsFor(reminder));
  }
}
