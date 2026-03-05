import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { Job, JOB_NAME, JobHandler, JobPayload, JobQueueService, LoggerService } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";

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

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly logger: LoggerService,
    private readonly jobQueueService: JobQueueService,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly deploymentService: DeploymentHttpService,
    private readonly billingConfig: BillingConfigService
  ) {}

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

    await this.deploymentWriterService.close({ ...wallet, address }, payload.dseq);

    await this.jobQueueService.enqueue(
      new NotificationJob({
        template: "trialDeploymentClosed",
        userId: wallet.userId!,
        vars: {
          dseq: payload.dseq,
          owner: wallet.address!,
          deploymentLifetimeInHours: this.billingConfig.get("TRIAL_DEPLOYMENT_CLEANUP_HOURS")
        }
      }),
      {
        singletonKey: `notification.trialDeploymentClosed.${payload.dseq}.${wallet.id}`
      }
    );
  }
}
