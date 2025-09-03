import { addHours } from "date-fns";
import { singleton } from "tsyringe";

import { TrialDeploymentLeaseCreated } from "@src/billing/events/trial-deployment-lease-created";
import { UserWalletRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { DOMAIN_EVENT_NAME, EventPayload, JobHandler, JobQueueService, LoggerService } from "@src/core";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { CloseTrialDeployment } from "../close-trial-deployment/close-trial-deployment.handler";

@singleton()
export class TrialDeploymentLeaseCreatedHandler implements JobHandler<TrialDeploymentLeaseCreated> {
  public readonly accepts = TrialDeploymentLeaseCreated;

  public readonly concurrency = 5;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly logger: LoggerService,
    private readonly jobQueueService: JobQueueService,
    private readonly billingConfig: BillingConfigService
  ) {}

  async handle(payload: EventPayload<TrialDeploymentLeaseCreated>): Promise<void> {
    const wallet = await this.userWalletRepository.findById(payload.walletId);
    if (!wallet) {
      this.logger.warn({
        event: "SKIP_TRIAL_DEPLOYMENT_CLOSING_TRIAL",
        domainEvent: TrialDeploymentLeaseCreated[DOMAIN_EVENT_NAME],
        walletId: payload.walletId,
        reason: "Cannot find wallet by id"
      });
      return;
    }

    if (!wallet.isTrialing) {
      this.logger.debug({
        event: "SKIP_TRIAL_DEPLOYMENT_CLOSING_TRIAL",
        domainEvent: TrialDeploymentLeaseCreated[DOMAIN_EVENT_NAME],
        userId: wallet.userId,
        walletId: payload.walletId,
        dseq: payload.dseq,
        reason: "User wallet is not in trial anymore"
      });
      return;
    }

    if (!wallet.address) {
      this.logger.warn({
        event: "SKIP_TRIAL_DEPLOYMENT_CLOSING_TRIAL",
        reason: "Wallet address is missing",
        domainEvent: TrialDeploymentLeaseCreated[DOMAIN_EVENT_NAME],
        dseq: payload.dseq,
        walletId: payload.walletId
      });
      return;
    }

    const deploymentCreatedAt = new Date(payload.createdAt);
    const trialDeploymentLifetime = this.billingConfig.get("TRIAL_DEPLOYMENT_CLEANUP_HOURS");
    await this.jobQueueService.enqueue(
      new NotificationJob({
        template: "beforeCloseTrialDeployment",
        userId: wallet.userId!,
        conditions: { trial: true },
        vars: {
          deploymentClosedAt: addHours(deploymentCreatedAt, trialDeploymentLifetime).toISOString(),
          dseq: payload.dseq,
          owner: wallet.address!
        }
      }),
      {
        startAfter: addHours(deploymentCreatedAt, trialDeploymentLifetime - 1).toISOString(),
        singletonKey: `notification.beforeCloseTrialDeployment.${payload.dseq}.${wallet.id}`
      }
    );
    this.jobQueueService.enqueue(
      new CloseTrialDeployment({
        walletId: wallet.id,
        dseq: payload.dseq
      }),
      {
        singletonKey: `closeTrialDeployment.${payload.dseq}.${wallet.id}`,
        startAfter: addHours(deploymentCreatedAt, trialDeploymentLifetime).toISOString()
      }
    );
  }
}
