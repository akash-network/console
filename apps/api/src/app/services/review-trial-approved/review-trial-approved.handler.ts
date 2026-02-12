import { addDays, subDays } from "date-fns";
import { singleton } from "tsyringe";

import { ReviewTrialApproved } from "@src/billing/events/review-trial-approved";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { EventPayload, JobHandler, JobQueueService, LoggerService } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { RESOLVED_MARKER } from "@src/notifications/services/notification-data-resolver/notification-data-resolver.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { reviewTrialApprovedNotification } from "@src/notifications/services/notification-templates/review-trial-approved-notification";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class ReviewTrialApprovedHandler implements JobHandler<ReviewTrialApproved> {
  public readonly accepts = ReviewTrialApproved;

  public readonly concurrency = 10;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly jobQueueManager: JobQueueService,
    private readonly userRepository: UserRepository,
    private readonly logger: LoggerService,
    private readonly billingConfig: BillingConfigService
  ) {}

  async handle(payload: EventPayload<ReviewTrialApproved>): Promise<void> {
    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      this.logger.warn({
        event: "REVIEW_TRIAL_APPROVED_USER_NOT_FOUND",
        userId: payload.userId
      });
      return;
    }

    const TRIAL_ALLOWANCE_EXPIRATION_DAYS = this.billingConfig.get("TRIAL_ALLOWANCE_EXPIRATION_DAYS");
    const trialEndsAt = addDays(user.createdAt!, TRIAL_ALLOWANCE_EXPIRATION_DAYS);

    if (user.email) {
      this.logger.info({ event: "REVIEW_TRIAL_APPROVED_NOTIFICATION_SENDING", userId: user.id });
      await this.notificationService.createNotification(
        reviewTrialApprovedNotification(user, {
          trialEndsAt: trialEndsAt.toISOString(),
          initialCredits: this.billingConfig.get("TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT")
        })
      );
      this.logger.info({ event: "REVIEW_TRIAL_APPROVED_NOTIFICATION_SENT", userId: user.id });
    }

    const notificationConditions = { trial: true };
    const vars = {
      trialEndsAt: trialEndsAt.toISOString(),
      paymentLink: this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK"),
      remainingCredits: RESOLVED_MARKER,
      activeDeployments: RESOLVED_MARKER
    };
    await Promise.all([
      this.jobQueueManager.enqueue(
        new NotificationJob({
          template: "beforeTrialEnds",
          userId: user.id,
          vars,
          conditions: notificationConditions
        }),
        {
          singletonKey: `notification.beforeTrialEnds.${user.id}.${TRIAL_ALLOWANCE_EXPIRATION_DAYS - 7}`,
          startAfter: subDays(trialEndsAt, 7).toISOString()
        }
      ),
      this.jobQueueManager.enqueue(
        new NotificationJob({
          template: "beforeTrialEnds",
          userId: user.id,
          vars,
          conditions: notificationConditions
        }),
        {
          singletonKey: `notification.beforeTrialEnds.${user.id}.${TRIAL_ALLOWANCE_EXPIRATION_DAYS - 1}`,
          startAfter: subDays(trialEndsAt, 1).toISOString()
        }
      ),
      this.jobQueueManager.enqueue(
        new NotificationJob({
          template: "trialEnded",
          userId: user.id,
          vars: {
            paymentLink: this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK")
          },
          conditions: notificationConditions
        }),
        {
          singletonKey: `notification.trialEnded.${user.id}`,
          startAfter: trialEndsAt.toISOString()
        }
      ),
      this.jobQueueManager.enqueue(
        new NotificationJob({
          template: "afterTrialEnds",
          userId: user.id,
          vars: {
            paymentLink: this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK")
          },
          conditions: notificationConditions
        }),
        {
          singletonKey: `notification.afterTrialEnds.${user.id}.${TRIAL_ALLOWANCE_EXPIRATION_DAYS + 7}`,
          startAfter: addDays(trialEndsAt, 7).toISOString()
        }
      )
    ]);
  }
}
