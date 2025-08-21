import { addDays } from "date-fns";
import { singleton } from "tsyringe";

import { TrialStarted } from "@src/billing/events/trial-started";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { LoggerService } from "@src/core/providers/logging.provider";
import { JobHandler, JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { startTrialNotification } from "@src/notifications/services/notification-templates/start-trial-notification";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class TrialStartedHandler implements JobHandler<TrialStarted> {
  public readonly accepts = TrialStarted;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly jobQueueManager: JobQueueService,
    private readonly userRepository: UserRepository,
    private readonly logger: LoggerService,
    private readonly coreConfig: BillingConfigService
  ) {}

  async handle(payload: TrialStarted["data"]): Promise<void> {
    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      this.logger.warn({
        event: "TRIAL_STARTED_USER_NOT_FOUND",
        userId: payload.userId
      });
      return;
    }

    if (user.email) {
      this.logger.info({ event: "START_TRIAL_NOTIFICATION_SENDING", userId: user.id });
      await this.notificationService.createNotification(startTrialNotification(user));
      this.logger.info({ event: "START_TRIAL_NOTIFICATION_SENT", userId: user.id });
    }

    const notificationConditions = { trial: true };
    const TRIAL_ALLOWANCE_EXPIRATION_DAYS = this.coreConfig.get("TRIAL_ALLOWANCE_EXPIRATION_DAYS");
    const trialEndsAt = addDays(user.createdAt!, TRIAL_ALLOWANCE_EXPIRATION_DAYS).toISOString();
    const vars = { trialEndsAt };
    await Promise.all([
      this.jobQueueManager.enqueue(
        new NotificationJob({
          template: "beforeTrialEnds",
          userId: user.id,
          vars,
          conditions: notificationConditions
        }),
        {
          singletonKey: `beforeTrialEnds.${user.id}.${TRIAL_ALLOWANCE_EXPIRATION_DAYS - 7}`,
          startAfter: addDays(new Date(), TRIAL_ALLOWANCE_EXPIRATION_DAYS - 7)
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
          singletonKey: `beforeTrialEnds.${user.id}.${TRIAL_ALLOWANCE_EXPIRATION_DAYS - 1}`,
          startAfter: addDays(new Date(), TRIAL_ALLOWANCE_EXPIRATION_DAYS - 1)
        }
      ),
      this.jobQueueManager.enqueue(
        new NotificationJob({
          template: "trialEnded",
          userId: user.id,
          conditions: notificationConditions
        }),
        {
          singletonKey: `trialEnded.${user.id}`,
          startAfter: addDays(new Date(), TRIAL_ALLOWANCE_EXPIRATION_DAYS)
        }
      ),
      this.jobQueueManager.enqueue(
        new NotificationJob({
          template: "afterTrialEnds",
          userId: user.id,
          conditions: notificationConditions
        }),
        {
          singletonKey: `afterTrialEnds.${user.id}`,
          startAfter: addDays(new Date(), TRIAL_ALLOWANCE_EXPIRATION_DAYS + 7)
        }
      )
    ]);
  }
}
