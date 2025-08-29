import { guard, MongoQuery } from "@ucast/mongo2js";
import { singleton } from "tsyringe";

import { LoggerService } from "@src/core/providers/logging.provider";
import { Job, JOB_NAME, JobHandler, JobPayload } from "@src/core/services/job-queue/job-queue.service";
import { UserOutput, UserRepository } from "@src/user/repositories";
import { CreateNotificationInput, NotificationService } from "../notification/notification.service";
import { afterTrialEndsNotification } from "../notification-templates/after-trial-ends-notification";
import { beforeCloseTrialDeploymentNotification } from "../notification-templates/before-close-trial-deployment";
import { beforeTrialEndsNotification } from "../notification-templates/before-trial-ends-notification";
import { startTrialNotification } from "../notification-templates/start-trial-notification";
import { trialDeploymentClosedNotification } from "../notification-templates/trial-deployment-closed";
import { trialEndedNotification } from "../notification-templates/trial-ended-notification";
import { trialFirstDeploymentLeaseCreatedNotification } from "../notification-templates/trial-first-deployment-lease-created-notification";

const notificationTemplates = {
  trialEnded: trialEndedNotification,
  beforeTrialEnds: beforeTrialEndsNotification,
  afterTrialEnds: afterTrialEndsNotification,
  startTrial: startTrialNotification,
  beforeCloseTrialDeployment: beforeCloseTrialDeploymentNotification,
  trialDeploymentClosed: trialDeploymentClosedNotification,
  trialFirstDeploymentLeaseCreated: trialFirstDeploymentLeaseCreatedNotification
};

type NotificationTemplates = typeof notificationTemplates;
type GenericNotificationTemplate = (user: UserOutput, vars?: Record<string, unknown>) => CreateNotificationInput;

export class NotificationJob<T extends keyof NotificationTemplates = keyof NotificationTemplates> implements Job {
  static readonly [JOB_NAME] = "notifications";
  readonly name = NotificationJob[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      template: T;
      userId: UserOutput["id"];
      conditions?: MongoQuery<UserOutput>;
    } & TemplateVarsParameter<NotificationTemplates[T]>
  ) {}
}

@singleton()
export class NotificationHandler implements JobHandler<NotificationJob> {
  public readonly accepts = NotificationJob;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService,
    private readonly userRepository: UserRepository
  ) {}

  async handle<T extends keyof NotificationTemplates>(payload: JobPayload<NotificationJob<T>>): Promise<void> {
    const notificationTemplate = notificationTemplates[payload.template] as GenericNotificationTemplate;
    if (!notificationTemplate) {
      this.logger.error({
        event: "UNKNOWN_NOTIFICATION_TYPE",
        type: payload.template
      });
      return;
    }

    const user = await this.userRepository.findById(payload.userId);
    if (!user || !user.email) {
      this.logger.warn({
        event: "NOTIFICATION_SEND_FAILED",
        userId: payload.userId,
        reason: "User or email not found"
      });
      return;
    }

    if (payload.conditions && !guard<UserOutput>(payload.conditions)(user)) {
      this.logger.warn({
        event: "USER_CONDITIONS_MISTMATCH",
        userId: user.id,
        conditions: payload.conditions
      });
      return;
    }

    await this.notificationService.createNotification(notificationTemplate(user, payload.vars));
  }
}

type TemplateVarsParameter<T extends NotificationTemplates[keyof NotificationTemplates]> = Parameters<T>["length"] extends 0 | 1
  ? { vars?: undefined }
  : { vars: Parameters<T>[1] };
