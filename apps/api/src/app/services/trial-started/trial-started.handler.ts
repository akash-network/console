import { addDays, subDays } from "date-fns";
import { singleton } from "tsyringe";

import { TrialStarted } from "@src/billing/events/trial-started";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { EventPayload, JobHandler, JobQueueService, LoggerService } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { startTrialNotification } from "@src/notifications/services/notification-templates/start-trial-notification";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class TrialStartedHandler implements JobHandler<TrialStarted> {
  public readonly accepts = TrialStarted;

  public readonly concurrency = 10;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly jobQueueManager: JobQueueService,
    private readonly userRepository: UserRepository,
    private readonly logger: LoggerService,
    private readonly coreConfig: BillingConfigService
  ) {}

  async handle(payload: EventPayload<TrialStarted>): Promise<void> {
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
    const trialEndsAt = addDays(user.createdAt!, TRIAL_ALLOWANCE_EXPIRATION_DAYS);
    const vars = { trialEndsAt: trialEndsAt.toISOString() };
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
