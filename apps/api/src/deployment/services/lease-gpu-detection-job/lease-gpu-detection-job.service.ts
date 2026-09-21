import { addMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
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
