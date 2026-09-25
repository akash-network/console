import { subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

export class RecordLeaseGpuOffers implements Job {
  static readonly [JOB_NAME] = "RecordLeaseGpuOffers";
  readonly name = RecordLeaseGpuOffers[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
      dseq: string;
    }
  ) {}
}

export type RecordLeaseGpuOffersTarget = RecordLeaseGpuOffers["data"];

type ReconcileCounts = { scheduled: number; alreadyScheduled: number; recentlyTried: number; failed: number };

export function recordLeaseGpuOffersKeyFor({ walletId, dseq }: RecordLeaseGpuOffersTarget): string {
  return `recordLeaseGpuOffers.${walletId}.${dseq}`;
}

/** Owns when a deployment's bid offers are recorded: as soon as a lease lands, and again from the sweep for a gpu deployment that has none. */
@singleton()
export class LeaseGpuOfferJobService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly leaseRepository: LeaseRepository,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: LeaseGpuOfferJobService.name });
  }

  async schedule(target: RecordLeaseGpuOffersTarget): Promise<string | null> {
    const jobId = await this.jobQueueService.enqueue(new RecordLeaseGpuOffers(target), { singletonKey: recordLeaseGpuOffersKeyFor(target) });

    this.logger.info({ event: "LEASE_GPU_OFFERS_SCHEDULED", walletId: target.walletId, dseq: target.dseq, jobId });

    return jobId;
  }

  /** Only enqueues and never reads the chain, so the queue's concurrency rather than this sweep paces the reading. */
  async reconcile({ dryRun }: DryRunOptions = { dryRun: false }): Promise<ReconcileCounts> {
    const counts: ReconcileCounts = { scheduled: 0, alreadyScheduled: 0, recentlyTried: 0, failed: 0 };
    const candidates = (
      await this.deploymentSettingRepository.findLiveManagedDeployments({ maxAgeHours: this.config.get("LEASE_GPU_DETECTION_RECONCILE_MAX_AGE_HOURS") })
    ).filter(candidate => !candidate.hasOfferedGpus);
    const owners = [...new Set(candidates.map(candidate => candidate.address))];
    const onGpu = new Set((await this.leaseRepository.findLiveGpuLeaseDeployments(owners)).map(lease => `${lease.owner}.${lease.dseq}`));
    const pendingKeys = await this.jobQueueService.findPendingSingletonKeys(RecordLeaseGpuOffers[JOB_NAME]);
    const recentlyTriedKeys = await this.jobQueueService.findRecentlyFinishedSingletonKeys({
      name: RecordLeaseGpuOffers[JOB_NAME],
      since: subHours(new Date(), this.config.get("LEASE_GPU_DETECTION_RECONCILE_BACKOFF_HOURS"))
    });

    for (const candidate of candidates) {
      if (!onGpu.has(`${candidate.address}.${candidate.dseq}`)) continue;

      const key = recordLeaseGpuOffersKeyFor(candidate);
      if (pendingKeys.has(key)) {
        counts.alreadyScheduled++;
        continue;
      }
      if (recentlyTriedKeys.has(key)) {
        counts.recentlyTried++;
        continue;
      }

      try {
        if (!dryRun) await this.schedule({ walletId: candidate.walletId, dseq: candidate.dseq });
        counts.scheduled++;
      } catch (error) {
        this.logger.error({ event: "LEASE_GPU_OFFERS_RECONCILE_FAILED", walletId: candidate.walletId, dseq: candidate.dseq, error });
        counts.failed++;
      }
    }

    this.logger.info({ event: "LEASE_GPU_OFFERS_RECONCILED", dryRun, candidates: candidates.length, ...counts });

    return counts;
  }
}
