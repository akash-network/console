import { addMinutes, subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { LeaseGpuRepository } from "@src/deployment/repositories/lease-gpu/lease-gpu.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

export class DetectLeaseGpus implements Job {
  static readonly [JOB_NAME] = "DetectLeaseGpus";
  readonly name = DetectLeaseGpus[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
      dseq: string;
      attempt: number;
      leaseCreatedAt: string;
    }
  ) {}
}

export type DetectLeaseGpusTarget = { walletId: number; dseq: string };

type ReconcileCounts = { scheduled: number; alreadyScheduled: number; alreadyRead: number; recentlyTried: number; failed: number };

/** A reschedule must land strictly after now whatever the delay ladder says, or pg-boss can archive it before a worker sees it. */
const MIN_RESCHEDULE_DELAY_MIN = 1;

export function detectLeaseGpusKeyFor({ walletId, dseq }: DetectLeaseGpusTarget): string {
  return `detectLeaseGpus.${walletId}.${dseq}`;
}

/** Owns when a deployment's gpus are read: a ladder from the lease, sized for an image that can take an hour to pull. */
@singleton()
export class LeaseGpuDetectionJobService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly leaseRepository: LeaseRepository,
    private readonly leaseGpuRepository: LeaseGpuRepository,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: LeaseGpuDetectionJobService.name });
  }

  async scheduleInitial(target: DetectLeaseGpusTarget & { leaseCreatedAt: Date }): Promise<string | null> {
    if (!this.#isEnabled()) return null;

    return this.#schedule({ ...target, attempt: 1, leaseCreatedAt: target.leaseCreatedAt.toISOString() });
  }

  async scheduleNext(previous: DetectLeaseGpus["data"]): Promise<string | null> {
    if (previous.attempt >= this.#attemptCount()) return null;

    return this.#schedule({ ...previous, attempt: previous.attempt + 1 });
  }

  /** An update can move the workload to another node, so the ladder starts again from the update rather than from the original lease. */
  async restartForUpdatedDeployment(target: DetectLeaseGpusTarget & { updatedAt: Date }): Promise<string | null> {
    if (!this.#isEnabled()) return null;

    await this.cancelForDeployment(target);

    return this.#schedule({ ...target, attempt: 1, leaseCreatedAt: target.updatedAt.toISOString() });
  }

  async cancelForDeployment(target: DetectLeaseGpusTarget): Promise<void> {
    await this.jobQueueService.cancelCreatedBy({ name: DetectLeaseGpus[JOB_NAME], singletonKey: detectLeaseGpusKeyFor(target) });
  }

  /** Only enqueues and never dials a provider, so the queue's concurrency rather than this sweep paces the reading. */
  async reconcile({ dryRun }: DryRunOptions = { dryRun: false }): Promise<ReconcileCounts> {
    const counts: ReconcileCounts = { scheduled: 0, alreadyScheduled: 0, alreadyRead: 0, recentlyTried: 0, failed: 0 };

    if (!this.#isEnabled()) {
      this.logger.info({ event: "LEASE_GPU_DETECTION_RECONCILE_DISABLED" });
      return counts;
    }

    const candidates = await this.deploymentSettingRepository.findLiveManagedDeployments({
      maxAgeHours: this.config.get("LEASE_GPU_DETECTION_RECONCILE_MAX_AGE_HOURS")
    });
    const owners = [...new Set(candidates.map(candidate => candidate.address))];
    const onGpu = new Set((await this.leaseRepository.findLiveGpuLeaseDeployments(owners)).map(lease => `${lease.owner}.${lease.dseq}`));
    const pendingKeys = await this.jobQueueService.findPendingSingletonKeys(DetectLeaseGpus[JOB_NAME]);
    const recentlyTriedKeys = await this.jobQueueService.findRecentlyFinishedSingletonKeys({
      name: DetectLeaseGpus[JOB_NAME],
      since: subHours(new Date(), this.config.get("LEASE_GPU_DETECTION_RECONCILE_BACKOFF_HOURS"))
    });

    for (const candidate of candidates) {
      if (!onGpu.has(`${candidate.address}.${candidate.dseq}`)) continue;

      const key = detectLeaseGpusKeyFor(candidate);
      if (pendingKeys.has(key)) {
        counts.alreadyScheduled++;
        continue;
      }
      if (recentlyTriedKeys.has(key)) {
        counts.recentlyTried++;
        continue;
      }

      try {
        await this.#reconcileCandidate(candidate, { dryRun, counts });
      } catch (error) {
        this.logger.error({ event: "LEASE_GPU_DETECTION_RECONCILE_FAILED", walletId: candidate.walletId, dseq: candidate.dseq, error });
        counts.failed++;
      }
    }

    if (!dryRun) await this.leaseGpuRepository.deleteForClosedDeployments();

    this.logger.info({ event: "LEASE_GPU_DETECTION_RECONCILED", dryRun, candidates: candidates.length, ...counts });

    return counts;
  }

  async #reconcileCandidate(candidate: DetectLeaseGpusTarget & { userId: string }, { dryRun, counts }: { dryRun: boolean; counts: ReconcileCounts }) {
    const read = await this.leaseGpuRepository.findForDeployments({ userId: candidate.userId, dseqs: [candidate.dseq] });
    if (read.length) {
      counts.alreadyRead++;
      return;
    }

    if (!dryRun) await this.#schedule({ walletId: candidate.walletId, dseq: candidate.dseq, attempt: 1, leaseCreatedAt: new Date().toISOString() });
    counts.scheduled++;
  }

  startAfterFor(data: DetectLeaseGpus["data"]): Date {
    const delays = this.config.get("LEASE_GPU_DETECTION_DELAYS_MIN");
    const delay = delays[Math.min(data.attempt, delays.length) - 1] ?? delays[delays.length - 1];
    const startAfter = addMinutes(new Date(data.leaseCreatedAt), delay);
    const floor = addMinutes(new Date(), MIN_RESCHEDULE_DELAY_MIN);

    return startAfter > floor ? startAfter : floor;
  }

  async #schedule(data: DetectLeaseGpus["data"]): Promise<string | null> {
    const jobId = await this.jobQueueService.enqueue(new DetectLeaseGpus(data), {
      singletonKey: detectLeaseGpusKeyFor(data),
      startAfter: this.startAfterFor(data)
    });

    this.logger.info({ event: "LEASE_GPU_DETECTION_SCHEDULED", walletId: data.walletId, dseq: data.dseq, attempt: data.attempt, jobId });

    return jobId;
  }

  #attemptCount(): number {
    return this.config.get("LEASE_GPU_DETECTION_DELAYS_MIN").length;
  }

  #isEnabled(): boolean {
    return this.config.get("LEASE_GPU_DETECTION_ENABLED") === "true";
  }
}
