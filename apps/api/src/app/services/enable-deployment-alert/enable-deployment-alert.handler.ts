import { singleton } from "tsyringe";

import { EnableDeploymentAlertCommand } from "@src/billing/commands/enable-deployment-alert.command";
import type { JobHandler, JobPayload } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";
import { NotificationService } from "@src/notifications/services/notification/notification.service";

@singleton()
export class EnableDeploymentAlertHandler implements JobHandler<EnableDeploymentAlertCommand> {
  public readonly accepts = EnableDeploymentAlertCommand;

  public readonly concurrency = 2;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: JobPayload<EnableDeploymentAlertCommand>): Promise<void> {
    this.logger.debug({ event: "ENABLE_DEPLOYMENT_ALERT", userId: payload.userId, dseq: payload.dseq });

    await this.notificationService.autoEnableDeploymentAlert({
      userId: payload.userId,
      walletAddress: payload.walletAddress,
      dseq: payload.dseq
    });
  }
}
