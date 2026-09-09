import { subMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { EnforceTrialAbuse, enforceTrialAbuseKeyFor } from "@src/workload-abuse/services/enforce-trial-abuse/enforce-trial-abuse.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

/** The queue's own retries are over within about twenty minutes, so a wipe still not enforced an hour after its last state change is stuck. */
const STALLED_ENFORCEMENT_AFTER_MIN = 60;

/** Backstops the queue: a confirmed detection whose wipe failed or died gets its job queued again while the wallet is still on trial and unlocked. */
@singleton()
export class TrialAbuseEnforcementJobService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly detectionRepository: WorkloadAbuseDetectionRepository,
    private readonly config: WorkloadAbuseConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TrialAbuseEnforcementJobService.name });
  }

  async reconcile({ dryRun }: DryRunOptions): Promise<void> {
    if (this.config.get("WORKLOAD_ABUSE_ENFORCEMENT_MODE") !== "enforce") {
      this.logger.info({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECONCILE_SKIPPED", reason: "DETECT_MODE" });
      return;
    }

    const stalled = await this.detectionRepository.findStalledEnforcements({ updatedBefore: subMinutes(new Date(), STALLED_ENFORCEMENT_AFTER_MIN) });
    this.logger.info({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECONCILE_START", count: stalled.length, dryRun });

    if (dryRun) return;

    const pendingKeys = await this.jobQueueService.findPendingSingletonKeys(EnforceTrialAbuse[JOB_NAME]);
    let requeued = 0;
    let alreadyQueued = 0;
    let failed = 0;

    for (const { walletId, detectionId } of stalled) {
      const singletonKey = enforceTrialAbuseKeyFor(walletId);

      if (pendingKeys.has(singletonKey)) {
        alreadyQueued++;
        continue;
      }

      try {
        const jobId = await this.jobQueueService.enqueue(new EnforceTrialAbuse({ walletId, detectionId }), { singletonKey });
        if (jobId) requeued++;
        else alreadyQueued++;
      } catch (error) {
        this.logger.error({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECONCILE_FAILED", walletId, detectionId, error });
        failed++;
      }
    }

    this.logger.info({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECONCILE_END", found: stalled.length, requeued, alreadyQueued, failed });
  }
}
