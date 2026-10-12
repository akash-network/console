import { isHttpError } from "http-errors";
import { singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import type { JobHandler, JobMeta, JobPayload, JobPermissions } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { createdActivityOf, failedCreateActivityOf } from "@src/deployment/utils/create-activity/create-activity";
import { CreateDeployment } from "./create-deployment.job";

@singleton()
export class CreateDeploymentHandler implements JobHandler<CreateDeployment> {
  public readonly accepts = CreateDeployment;

  /** One create per deployment across queued, retrying and running, so no two attempts ever send it at once. */
  public readonly policy = "exclusive";

  constructor(
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly activityService: ActivityService
  ) {}

  requiresPermission({ userId }: JobPayload<CreateDeployment>): JobPermissions {
    return [{ action: "sign", subject: "UserWallet", conditions: { userId } }];
  }

  async handle({ userId, dseq, message, activityId }: JobPayload<CreateDeployment>, job?: JobMeta): Promise<void> {
    if (!(await this.activityService.isPending(activityId))) return;

    await this.#create({ userId, dseq, message, activityId }, job);
    await this.activityService.settle(activityId, createdActivityOf({ userId, dseq }));
  }

  /** A refusal is final only on a first attempt: on a retry it may come from a lagging read of a create an earlier attempt landed, so it is retried like any other failure. */
  async #create({ activityId, ...accepted }: CreateDeployment["data"], job?: JobMeta): Promise<void> {
    try {
      await this.deploymentWriterService.createOnChain(accepted, { retry: isRetry(job) });
    } catch (error) {
      if (isLastAttempt(job) || (isRefusal(error) && !isRetry(job))) {
        await this.activityService.settle(activityId, failedCreateActivityOf(accepted, error));
      }
      throw error;
    }
  }
}

function isRetry(job?: JobMeta): boolean {
  return !!job && job.retryCount > 0;
}

function isLastAttempt(job?: JobMeta): boolean {
  return !job || job.retryCount >= job.retryLimit;
}

/** Bounded below 500, because an undecided outcome is exposed to the caller too and must never read as a refusal. */
function isRefusal(error: unknown): boolean {
  return isHttpError(error) && error.expose && error.status < 500;
}
