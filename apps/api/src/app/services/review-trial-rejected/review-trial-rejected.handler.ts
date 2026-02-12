import { singleton } from "tsyringe";

import { ReviewTrialRejected } from "@src/billing/events/review-trial-rejected";
import { EventPayload, JobHandler, LoggerService } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { reviewTrialRejectedNotification } from "@src/notifications/services/notification-templates/review-trial-rejected-notification";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class ReviewTrialRejectedHandler implements JobHandler<ReviewTrialRejected> {
  public readonly accepts = ReviewTrialRejected;

  public readonly concurrency = 10;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: EventPayload<ReviewTrialRejected>): Promise<void> {
    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      this.logger.warn({
        event: "REVIEW_TRIAL_REJECTED_USER_NOT_FOUND",
        userId: payload.userId
      });
      return;
    }

    if (user.email) {
      this.logger.info({ event: "REVIEW_TRIAL_REJECTED_NOTIFICATION_SENDING", userId: user.id });
      await this.notificationService.createNotification(reviewTrialRejectedNotification(user));
      this.logger.info({ event: "REVIEW_TRIAL_REJECTED_NOTIFICATION_SENT", userId: user.id });
    }
  }
}
