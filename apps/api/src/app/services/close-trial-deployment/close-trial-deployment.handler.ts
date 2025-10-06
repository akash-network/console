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

  public readonly concurrency = 10;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly logger: LoggerService,
    private readonly jobQueueService: JobQueueService,
    private readonly deploymentWriterService: DeploymentWriterService,
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
