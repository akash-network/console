import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { minutesToMilliseconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { type CreateLogger, Job, JOB_NAME, JobHandler, JobPayload, type JobPermissions, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { systemClosedActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { RESOLVED_MARKER } from "@src/notifications/services/notification-data-resolver/notification-data-resolver.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";

/** How long a close the chain is not ready to settle waits before it is tried again. */
const RETRY_DELAY_MS = minutesToMilliseconds(15);

export function closeTrialDeploymentKeyFor({ dseq, walletId }: { dseq: string; walletId: number }): string {
  return `closeTrialDeployment.${dseq}.${walletId}`;
}

export class CloseTrialDeployment implements Job {
  static readonly [JOB_NAME] = "CloseTrialDeployment";
  readonly name = CloseTrialDeployment[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
      dseq: string;
    }
  ) {}
}

@singleton()
export class CloseTrialDeploymentHandler implements JobHandler<CloseTrialDeployment> {
  public readonly accepts = CloseTrialDeployment;

  public readonly concurrency = 2;

  /** With the per-deployment singletonKey, keeps a duplicate job from broadcasting alongside the job it duplicates while letting a running close queue its next attempt. */
  public readonly policy = "stately";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger,
    private readonly jobQueueService: JobQueueService,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly deploymentService: DeploymentHttpService,
    private readonly billingConfig: BillingConfigService,
    private readonly chainErrorService: ChainErrorService,
    private readonly activityService: ActivityService
  ) {
    this.logger = createLogger({ context: CloseTrialDeploymentHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<CloseTrialDeployment>): Promise<void> {
    const wallet = await this.userWalletRepository.findById(payload.walletId);
    if (!wallet) {
      this.logger.warn({
        event: "SKIP_CLOSE_TRIAL_DEPLOYMENT_JOB",
        reason: "Wallet not found",
        job: CloseTrialDeployment[JOB_NAME],
        walletId: payload.walletId,
        dseq: payload.dseq
      });
      return;
    }

    if (!wallet.isTrialing) {
      this.logger.debug({
        event: "SKIP_CLOSE_TRIAL_DEPLOYMENT_JOB",
        reason: "Wallet is not in trial",
        job: CloseTrialDeployment[JOB_NAME],
        walletId: payload.walletId,
        dseq: payload.dseq,
        userId: wallet.userId
      });
      return;
    }

    const { address } = wallet;

    if (!address) {
      this.logger.debug({
        event: "SKIP_CLOSE_TRIAL_DEPLOYMENT_JOB",
        reason: "Wallet is not initialized",
        job: CloseTrialDeployment[JOB_NAME],
        walletId: payload.walletId,
        dseq: payload.dseq,
        userId: wallet.userId
      });
      return;
    }

    const deployment = await this.deploymentService.findByOwnerAndDseq(address, payload.dseq);

    if (!deployment) {
      this.logger.error({
        event: "CLOSE_TRIAL_DEPLOYMENT_ERROR",
        reason: "Deployment not found",
        job: CloseTrialDeployment[JOB_NAME],
        walletId: payload.walletId,
        dseq: payload.dseq,
        userId: wallet.userId
      });
      throw new Error("Failed to fetch deployment details: deployment not found");
    }

    if ("code" in deployment) {
      this.logger.error({
        event: "CLOSE_TRIAL_DEPLOYMENT_ERROR",
        reason: deployment.message,
        details: deployment.details,
        job: CloseTrialDeployment[JOB_NAME],
        walletId: payload.walletId,
        dseq: payload.dseq,
        userId: wallet.userId
      });
      throw new Error(`Failed to fetch deployment details: ${deployment.message}`);
    }

    if (deployment.deployment.state !== "active") {
      this.logger.debug({
        event: "SKIP_CLOSE_TRIAL_DEPLOYMENT_JOB",
        reason: "Deployment is not active",
        job: CloseTrialDeployment[JOB_NAME],
        walletId: payload.walletId,
        dseq: payload.dseq,
        userId: wallet.userId,
        deploymentState: deployment.deployment.state
      });
      return;
    }

    let closedByThisJob: boolean;

    try {
      closedByThisJob = await this.deploymentWriterService.close({ ...wallet, address }, payload.dseq);
    } catch (error) {
      if (error instanceof Error && this.chainErrorService.isUnsettleableDeploymentError(error)) {
        this.logger.error({
          event: "CLOSE_TRIAL_DEPLOYMENT_UNSETTLEABLE",
          reason: "Deployment escrow cannot be settled yet; chain rejects close until it settles",
          job: CloseTrialDeployment[JOB_NAME],
          walletId: payload.walletId,
          dseq: payload.dseq,
          owner: address,
          userId: wallet.userId
        });
        await this.#retryLater(payload);
        return;
      }
      throw error;
    }

    if (closedByThisJob) {
      await this.activityService.record(systemClosedActivityOf({ userId: wallet.userId, dseq: payload.dseq, reason: "trial_ended" }));
    }

    await this.jobQueueService.enqueue(
      new NotificationJob({
        template: "trialDeploymentClosed",
        userId: wallet.userId!,
        vars: {
          dseq: payload.dseq,
          owner: wallet.address!,
          deploymentLifetimeInHours: this.billingConfig.get("TRIAL_DEPLOYMENT_CLEANUP_HOURS"),
          paymentLink: this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK"),
          firstPurchaseBonus: RESOLVED_MARKER
        }
      }),
      {
        singletonKey: `notification.trialDeploymentClosed.${payload.dseq}.${wallet.id}`
      }
    );
  }

  /** A fresh job rather than a throw, so an escrow the chain will not settle yet keeps being retried past the queue's retry budget. */
  async #retryLater({ walletId, dseq }: CloseTrialDeployment["data"]): Promise<void> {
    await this.jobQueueService.enqueue(new CloseTrialDeployment({ walletId, dseq }), {
      singletonKey: closeTrialDeploymentKeyFor({ dseq, walletId }),
      startAfter: new Date(Date.now() + RETRY_DELAY_MS).toISOString()
    });
  }
}
