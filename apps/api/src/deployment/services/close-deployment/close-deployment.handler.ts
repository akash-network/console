import { singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { JobHandler, JobMeta, JobPayload, JobPermissions } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { isAccessRevoked, MemberDeploymentAccessService } from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { closedActivityOf, type CloseKey, failedCloseActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { CloseDeployment } from "./close-deployment.job";

@singleton()
export class CloseDeploymentHandler implements JobHandler<CloseDeployment> {
  public readonly accepts = CloseDeployment;

  /** One close per deployment across queued, retrying and running, so a second request joins the first instead of racing it. */
  public readonly policy = "exclusive";

  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly activityService: ActivityService,
    private readonly memberDeploymentAccessService: MemberDeploymentAccessService
  ) {}

  requiresPermission({ userId, walletId }: JobPayload<CloseDeployment>): JobPermissions {
    return [{ action: "sign", subject: "UserWallet", conditions: walletId === undefined ? { userId } : { id: walletId } }];
  }

  /** A wallet that cannot be read leaves the activity to the reconcile check, since the wallet's address names the entry. */
  async handle({ userId, dseq, activityId, batchId, walletId }: JobPayload<CloseDeployment>, job?: JobMeta): Promise<void> {
    if (!(await this.activityService.isPending(activityId))) return;

    const wallet = walletId === undefined ? await this.walletReaderService.getWalletByUserId(userId) : await this.walletReaderService.getWalletById(walletId);
    const close = { userId, owner: wallet.address, dseq, batchId };

    try {
      await this.deploymentWriterService.close(wallet, dseq, {
        actingUserId: userId,
        assertMayStillSign: () => this.memberDeploymentAccessService.assertMayStillSign({ userId, walletId, dseq })
      });
    } catch (error) {
      return await this.#settleFailure(activityId, close, error, job);
    }

    await this.activityService.settle(activityId, closedActivityOf(close));
  }

  /** A close is safe to repeat, so a failure is retried and settles the activity only on the last attempt, except for access the member lost, which no retry gives back. */
  async #settleFailure(activityId: string, close: CloseKey, error: unknown, job?: JobMeta): Promise<void> {
    if (isAccessRevoked(error)) return await this.activityService.settle(activityId, failedCloseActivityOf(close, error));
    if (isLastAttempt(job)) await this.activityService.settle(activityId, failedCloseActivityOf(close, error));

    throw error;
  }
}

function isLastAttempt(job?: JobMeta): boolean {
  return !job || job.retryCount >= job.retryLimit;
}
