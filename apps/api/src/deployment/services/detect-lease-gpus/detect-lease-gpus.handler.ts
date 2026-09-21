import { inject, singleton } from "tsyringe";

import { isWalletInitialized, UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { LeaseGpuRepository } from "@src/deployment/repositories/lease-gpu/lease-gpu.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { LeaseGpuDetectionService } from "@src/deployment/services/lease-gpu-detection/lease-gpu-detection.service";
import { DetectLeaseGpus, LeaseGpuDetectionJobService } from "@src/deployment/services/lease-gpu-detection-job/lease-gpu-detection-job.service";

/**
 * Reads what a deployment's gpu leases are running and records it. Re-reads the wallet and the chain on every run, so a
 * job that waited an hour decides on what is true when it runs rather than when it was queued.
 */
@singleton()
export class DetectLeaseGpusHandler implements JobHandler<DetectLeaseGpus> {
  public readonly accepts = DetectLeaseGpus;

  public readonly concurrency = 2;

  /** One job per state per deployment: the self re-enqueue is accepted while this run is active, and a concurrent sweep enqueue for the same key is dropped. */
  public readonly policy = "stately";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly detectionService: LeaseGpuDetectionService,
    private readonly jobService: LeaseGpuDetectionJobService,
    private readonly leaseGpuRepository: LeaseGpuRepository,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DetectLeaseGpusHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<DetectLeaseGpus>): Promise<void> {
    const { walletId, dseq, attempt } = payload;
    const context = { job: DetectLeaseGpus[JOB_NAME], walletId, dseq, attempt };

    if (this.config.get("LEASE_GPU_DETECTION_ENABLED") !== "true") return;

    const wallet = await this.userWalletRepository.findOneBy({ id: walletId });

    if (!wallet || !isWalletInitialized(wallet)) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_SKIPPED", reason: "wallet_uninitialized", ...context });
      return;
    }

    const report = await this.detectionService.detect({ wallet, dseq });

    if (report.rows.length) await this.leaseGpuRepository.upsertMany(report.rows);

    this.logger.info({
      event: "LEASE_GPU_DETECTION_RAN",
      ...context,
      status: report.status,
      rows: report.rows.length,
      complete: report.complete
    });

    if (report.complete) return;

    await this.jobService.scheduleNext(payload);
  }
}
