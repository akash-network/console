import type { HttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { errorCodeOf } from "@src/activity/lib/activity-error/activity-error";
import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type CreateLogger, type JobHandler, type JobMeta, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { type AcceptedDeploymentCreate, DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { isAccessRevoked, MemberDeploymentAccessService } from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { UserGpuBidCheckService } from "@src/deployment/services/user-gpu-bid-check/user-gpu-bid-check.service";
import { createdActivityOf, failedCreateActivityOf, isCreateRefusal } from "@src/deployment/utils/create-activity/create-activity";
import { CreateDeployment } from "./create-deployment.job";

@singleton()
export class CreateDeploymentHandler implements JobHandler<CreateDeployment> {
  public readonly accepts = CreateDeployment;

  /** One create per deployment across queued, retrying and running, so no two attempts ever send it at once. */
  public readonly policy = "exclusive";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly activityService: ActivityService,
    private readonly memberDeploymentAccessService: MemberDeploymentAccessService,
    private readonly userGpuBidCheckService: UserGpuBidCheckService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: CreateDeploymentHandler.name });
  }

  requiresPermission({ walletId }: JobPayload<CreateDeployment>): JobPermissions {
    return [{ action: "sign", subject: "UserWallet", conditions: { id: walletId } }];
  }

  /** A refusal that settles the activity ends the job, since a retry would find nothing pending to create. */
  async handle({ userId, walletId, dseq, message, activityId, recordGpuBids }: JobPayload<CreateDeployment>, job?: JobMeta): Promise<void> {
    if (!(await this.activityService.isPending(activityId))) return;

    const accepted = { userId, walletId, dseq, message };

    try {
      await this.deploymentWriterService.createOnChain(accepted, {
        retry: isRetry(job),
        assertMayStillSign: () => this.memberDeploymentAccessService.assertMayStillSign({ userId, walletId, dseq })
      });
    } catch (error) {
      if (isFinalRefusal(error, job)) return await this.#settleRefused(activityId, accepted, error);
      if (isLastAttempt(job)) await this.activityService.settle(activityId, failedCreateActivityOf(accepted, error));
      throw error;
    }

    await this.activityService.settle(activityId, createdActivityOf(accepted));
    if (recordGpuBids) await this.userGpuBidCheckService.scheduleFor(accepted);
  }

  async #settleRefused(activityId: string, accepted: AcceptedDeploymentCreate, refusal: HttpError): Promise<void> {
    this.logger.info({
      event: "BACKGROUND_DEPLOYMENT_CREATE_REFUSED",
      activityId,
      walletId: accepted.walletId,
      dseq: accepted.dseq,
      status: refusal.status,
      errorCode: errorCodeOf(refusal)
    });
    await this.activityService.settle(activityId, failedCreateActivityOf(accepted, refusal));
  }
}

/** Access the member lost is final on any attempt, since no retry gives it back; any other refusal only on a first attempt, since on a retry it may come from a lagging read of a create an earlier attempt landed. */
function isFinalRefusal(error: unknown, job?: JobMeta): error is HttpError {
  return isCreateRefusal(error) && (isAccessRevoked(error) || !isRetry(job));
}

function isRetry(job?: JobMeta): boolean {
  return !!job && job.retryCount > 0;
}

function isLastAttempt(job?: JobMeta): boolean {
  return !job || job.retryCount >= job.retryLimit;
}
