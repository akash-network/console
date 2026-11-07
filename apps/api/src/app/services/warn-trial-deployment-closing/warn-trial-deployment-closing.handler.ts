import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type CreateLogger, Job, JOB_NAME, JobHandler, JobPayload, type JobPermissions, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { RESOLVED_MARKER } from "@src/notifications/services/notification-data-resolver/notification-data-resolver.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";

export class WarnTrialDeploymentClosing implements Job {
  static readonly [JOB_NAME] = "WarnTrialDeploymentClosing";
  readonly name = WarnTrialDeploymentClosing[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
      dseq: string;
      closesAt: string;
    }
  ) {}
}

/** Checks the chain at warning time because the owner can close a trial deployment from anywhere, Console included, without anything calling the warning off. */
@singleton()
export class WarnTrialDeploymentClosingHandler implements JobHandler<WarnTrialDeploymentClosing> {
  public readonly accepts = WarnTrialDeploymentClosing;

  public readonly concurrency = 2;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger,
    private readonly jobQueueService: JobQueueService,
    private readonly deploymentService: DeploymentHttpService,
    private readonly billingConfig: BillingConfigService
  ) {
    this.logger = createLogger({ context: WarnTrialDeploymentClosingHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ walletId, dseq, closesAt }: JobPayload<WarnTrialDeploymentClosing>): Promise<void> {
    const wallet = await this.userWalletRepository.findById(walletId);
    if (!wallet?.isTrialing || !wallet.address) {
      this.logger.debug({ event: "SKIP_TRIAL_DEPLOYMENT_CLOSING_WARNING", reason: "Wallet is not trialing or has no address", walletId, dseq });
      return;
    }

    const deployment = await this.deploymentService.findByOwnerAndDseq(wallet.address, dseq);
    if (!deployment || "code" in deployment) {
      throw new Error(`Failed to fetch trial deployment ${dseq}: ${deployment?.message ?? "deployment not found"}`);
    }

    if (deployment.deployment.state !== "active") {
      this.logger.debug({
        event: "SKIP_TRIAL_DEPLOYMENT_CLOSING_WARNING",
        reason: "Deployment is not active",
        walletId,
        dseq,
        deploymentState: deployment.deployment.state
      });
      return;
    }

    await this.jobQueueService.enqueue(
      new NotificationJob({
        template: "beforeCloseTrialDeployment",
        userId: wallet.userId!,
        conditions: { trial: true },
        vars: {
          deploymentClosedAt: closesAt,
          dseq,
          owner: wallet.address,
          paymentLink: this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK"),
          firstPurchaseBonus: RESOLVED_MARKER
        }
      }),
      { singletonKey: `notification.beforeCloseTrialDeployment.${dseq}.${walletId}` }
    );
  }
}
