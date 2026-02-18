import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { backOff } from "exponential-backoff";
import { singleton } from "tsyringe";

import { EnableDeploymentAlertCommand } from "@src/billing/commands/enable-deployment-alert.command";
import type { JobHandler, JobPayload } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";
import { NotificationService } from "@src/notifications/services/notification/notification.service";

@singleton()
export class EnableDeploymentAlertHandler implements JobHandler<EnableDeploymentAlertCommand> {
  public readonly accepts = EnableDeploymentAlertCommand;

  public readonly concurrency = 5;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: JobPayload<EnableDeploymentAlertCommand>): Promise<void> {
    this.logger.debug({ event: "ENABLE_DEPLOYMENT_ALERT", userId: payload.userId, dseq: payload.dseq });

    const escrowBalance = await this.getDeploymentEscrowBalance(payload.walletAddress, payload.dseq);
    if (escrowBalance === undefined) return;

    await this.notificationService.autoEnableDeploymentAlert({
      userId: payload.userId,
      walletAddress: payload.walletAddress,
      dseq: payload.dseq,
      escrowBalance
    });
  }

  private async getDeploymentEscrowBalance(walletAddress: string, dseq: string): Promise<number | undefined> {
    const deployment = await backOff(() => this.deploymentHttpService.findByOwnerAndDseq(walletAddress, dseq), {
      maxDelay: 5_000,
      startingDelay: 500,
      timeMultiple: 2,
      numOfAttempts: 5
    });

    if ("code" in deployment) {
      this.logger.warn({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "Deployment not found", dseq });
      return undefined;
    }

    return parseFloat(deployment.escrow_account.state.funds.reduce((sum, { amount }) => sum + parseFloat(amount), 0).toFixed(18));
  }
}
