import { singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { AuthService } from "@src/auth/services/auth.service";
import type { JobHandler, JobMeta, JobPayload, JobPermissions } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { isAccessRevoked, MemberDeploymentAccessService } from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { failedUpdateActivityOf, updatedActivityOf } from "@src/deployment/utils/update-activity/update-activity";
import { isManifestInvalid } from "@src/provider/services/provider/provider.service";
import { ApplyDeploymentUpdate } from "./apply-deployment-update.job";

type UpdateKey = { userId: string; dseq: string; manifestVersion: string };

@singleton()
export class ApplyDeploymentUpdateHandler implements JobHandler<ApplyDeploymentUpdate> {
  public readonly accepts = ApplyDeploymentUpdate;

  /** One running apply per deployment and any number queued behind it, so a version saved while an older one is being applied lands after it rather than racing it. */
  public readonly policy = "singleton";

  constructor(
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly activityService: ActivityService,
    private readonly authService: AuthService,
    private readonly memberDeploymentAccessService: MemberDeploymentAccessService
  ) {}

  /** An organization's deployment may be filed under another member, so its row is reached through the organization rather than the member who saved the update. */
  requiresPermission({ userId, walletId, organizationId }: JobPayload<ApplyDeploymentUpdate>): JobPermissions {
    return [
      { action: "sign", subject: "UserWallet", conditions: { id: walletId } },
      { action: "read", subject: "DeploymentSetting", conditions: organizationId === undefined ? { userId } : { organizationId } }
    ];
  }

  async handle({ userId, dseq, manifestVersion, walletId, activityId }: JobPayload<ApplyDeploymentUpdate>, job?: JobMeta): Promise<void> {
    if (!(await this.activityService.isPending(activityId))) return;

    const update = { userId, dseq, manifestVersion };

    try {
      await this.deploymentWriterService.applySavedPatch({ ...update, walletId }, this.authService.ability, {
        assertMayStillSign: () => this.memberDeploymentAccessService.assertMayStillSign({ userId, walletId, dseq })
      });
    } catch (error) {
      return await this.#settleFailure(activityId, update, error, job);
    }

    await this.activityService.settle(activityId, updatedActivityOf(update));
  }

  /** An apply is safe to repeat and skips a version a newer save replaced, so a failure is retried and settles the activity only on the last attempt, except for access the member lost or a manifest the provider found invalid, which no retry changes. */
  async #settleFailure(activityId: string, update: UpdateKey, error: unknown, job?: JobMeta): Promise<void> {
    if (isAccessRevoked(error) || isManifestInvalid(error)) return await this.activityService.settle(activityId, failedUpdateActivityOf(update, error));
    if (isLastAttempt(job)) await this.activityService.settle(activityId, failedUpdateActivityOf(update, error));

    throw error;
  }
}

function isLastAttempt(job?: JobMeta): boolean {
  return !job || job.retryCount >= job.retryLimit;
}
