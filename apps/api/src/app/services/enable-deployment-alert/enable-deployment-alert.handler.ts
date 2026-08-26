import { inject, singleton } from "tsyringe";

import { EnableDeploymentAlertCommand } from "@src/billing/commands/enable-deployment-alert.command";
import type { JobHandler, JobPayload } from "@src/core";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { NotificationService } from "@src/notifications/services/notification/notification.service";

@singleton()
export class EnableDeploymentAlertHandler implements JobHandler<EnableDeploymentAlertCommand> {
  public readonly accepts = EnableDeploymentAlertCommand;

  public readonly concurrency = 2;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly notificationService: NotificationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: EnableDeploymentAlertHandler.name });
  }

  async handle(payload: JobPayload<EnableDeploymentAlertCommand>): Promise<void> {
    this.logger.debug({ event: "ENABLE_DEPLOYMENT_ALERT", userId: payload.userId, dseq: payload.dseq });

    await this.notificationService.autoEnableDeploymentAlert({
      userId: payload.userId,
      walletAddress: payload.walletAddress,
      dseq: payload.dseq
    });
  }
}
