import { singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { AuthService } from "@src/auth/services/auth.service";
import type { JobHandler, JobMeta, JobPayload, JobPermissions } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { failedUpdateActivityOf, updatedActivityOf } from "@src/deployment/utils/update-activity/update-activity";
import { ApplyDeploymentUpdate } from "./apply-deployment-update.job";

@singleton()
export class ApplyDeploymentUpdateHandler implements JobHandler<ApplyDeploymentUpdate> {
  public readonly accepts = ApplyDeploymentUpdate;

  /** One running apply per deployment and any number queued behind it, so a version saved while an older one is being applied lands after it rather than racing it. */
  public readonly policy = "singleton";

  constructor(
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly activityService: ActivityService,
    private readonly authService: AuthService
  ) {}

  requiresPermission({ userId }: JobPayload<ApplyDeploymentUpdate>): JobPermissions {
    return [
      { action: "sign", subject: "UserWallet", conditions: { userId } },
      { action: "read", subject: "DeploymentSetting", conditions: { userId } }
    ];
  }

  /** An apply is safe to repeat and skips a version a newer save replaced, so every failure is retried and only the last attempt settles the activity as failed. */
  async handle({ version: _version, ...update }: JobPayload<ApplyDeploymentUpdate>, job?: JobMeta): Promise<void> {
    if (!(await this.activityService.isPending(update.activityId))) return;

    await this.#apply(update, job);
    await this.activityService.settle(update.activityId, updatedActivityOf(update));
  }

  async #apply(update: ApplyDeploymentUpdate["data"], job?: JobMeta): Promise<void> {
    try {
      await this.deploymentWriterService.applySavedPatch(update, this.authService.ability);
    } catch (error) {
      if (isLastAttempt(job)) await this.activityService.settle(update.activityId, failedUpdateActivityOf(update, error));
      throw error;
    }
  }
}

function isLastAttempt(job?: JobMeta): boolean {
  return !job || job.retryCount >= job.retryLimit;
}
