import { singleton } from "tsyringe";

import { ManagedDeploymentLeaseCreated } from "@src/billing/events/managed-deployment-lease-created";
import type { EventPayload, JobHandler } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";
import { NotificationService } from "@src/notifications/services/notification/notification.service";

@singleton()
export class ManagedDeploymentLeaseCreatedHandler implements JobHandler<ManagedDeploymentLeaseCreated> {
  public readonly accepts = ManagedDeploymentLeaseCreated;

  public readonly concurrency = 5;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: EventPayload<ManagedDeploymentLeaseCreated>): Promise<void> {
    this.logger.debug({ event: "MANAGED_DEPLOYMENT_LEASE_CREATED", userId: payload.userId, dseq: payload.dseq });

    await this.notificationService.autoEnableDeploymentAlert({
      userId: payload.userId,
      walletAddress: payload.walletAddress,
      dseq: payload.dseq
    });
  }
}
