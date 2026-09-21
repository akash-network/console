import { inject, singleton } from "tsyringe";

import { ManagedDeploymentLeaseCreated } from "@src/billing/events/managed-deployment-lease-created";
import { type CreateLogger, DOMAIN_EVENT_NAME, EventPayload, JobHandler, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { LeaseGpuDetectionJobService } from "@src/deployment/services/lease-gpu-detection-job/lease-gpu-detection-job.service";

@singleton()
export class ManagedDeploymentLeaseCreatedHandler implements JobHandler<ManagedDeploymentLeaseCreated> {
  public readonly accepts = ManagedDeploymentLeaseCreated;

  public readonly concurrency = 2;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuDetectionJobService: LeaseGpuDetectionJobService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ManagedDeploymentLeaseCreatedHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Reading a lease's gpus is an extra the deployment does not depend on, so a failure to schedule it is logged rather than retried. */
  async handle(payload: EventPayload<ManagedDeploymentLeaseCreated>): Promise<void> {
    try {
      await this.gpuDetectionJobService.scheduleInitial({
        walletId: payload.walletId,
        dseq: payload.dseq,
        leaseCreatedAt: new Date(payload.createdAt)
      });
    } catch (error) {
      this.logger.error({
        event: "LEASE_GPU_DETECTION_SCHEDULE_FAILED",
        domainEvent: ManagedDeploymentLeaseCreated[DOMAIN_EVENT_NAME],
        walletId: payload.walletId,
        dseq: payload.dseq,
        error
      });
    }
  }
}
