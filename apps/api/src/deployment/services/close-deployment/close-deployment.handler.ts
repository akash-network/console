import { singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { JobHandler, JobMeta, JobPayload, JobPermissions } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { closedActivityOf, failedCloseActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { CloseDeployment } from "./close-deployment.job";

@singleton()
export class CloseDeploymentHandler implements JobHandler<CloseDeployment> {
  public readonly accepts = CloseDeployment;

  /** One close per deployment across queued, retrying and running, so a second request joins the first instead of racing it. */
  public readonly policy = "exclusive";

  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly activityService: ActivityService
  ) {}

  requiresPermission({ userId, walletId }: JobPayload<CloseDeployment>): JobPermissions {
    return [{ action: "sign", subject: "UserWallet", conditions: walletId === undefined ? { userId } : { id: walletId } }];
  }

  /** A close is safe to repeat, so every failure is retried and only the last attempt settles the activity as failed. */
  async handle({ userId, dseq, activityId, batchId, walletId }: JobPayload<CloseDeployment>, job?: JobMeta): Promise<void> {
    if (!(await this.activityService.isPending(activityId))) return;

    await this.#close({ userId, dseq, activityId, batchId, walletId }, job);
    await this.activityService.settle(activityId, closedActivityOf({ userId, dseq, batchId }));
  }

  async #close({ userId, dseq, activityId, batchId, walletId }: CloseDeployment["data"], job?: JobMeta): Promise<void> {
    try {
      const wallet = walletId === undefined ? await this.walletReaderService.getWalletByUserId(userId) : await this.walletReaderService.getWalletById(walletId);
      await this.deploymentWriterService.close(wallet, dseq);
    } catch (error) {
      if (isLastAttempt(job)) await this.activityService.settle(activityId, failedCloseActivityOf({ userId, dseq, batchId }, error));
      throw error;
    }
  }
}

function isLastAttempt(job?: JobMeta): boolean {
  return !job || job.retryCount >= job.retryLimit;
}
