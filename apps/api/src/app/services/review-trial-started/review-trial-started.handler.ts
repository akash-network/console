import { singleton } from "tsyringe";

import { ReviewTrialStarted } from "@src/billing/events/review-trial-started";
import { EventPayload, JobHandler, LoggerService } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { reviewTrialStartedNotification } from "@src/notifications/services/notification-templates/review-trial-started-notification";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class ReviewTrialStartedHandler implements JobHandler<ReviewTrialStarted> {
  public readonly accepts = ReviewTrialStarted;

  public readonly concurrency = 10;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: EventPayload<ReviewTrialStarted>): Promise<void> {
    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      this.logger.warn({
        event: "REVIEW_TRIAL_STARTED_USER_NOT_FOUND",
        userId: payload.userId
      });
      return;
    }

    if (user.email) {
      this.logger.info({ event: "REVIEW_TRIAL_STARTED_NOTIFICATION_SENDING", userId: user.id });
      await this.notificationService.createNotification(reviewTrialStartedNotification(user));
      this.logger.info({ event: "REVIEW_TRIAL_STARTED_NOTIFICATION_SENT", userId: user.id });
    }
  }
}
