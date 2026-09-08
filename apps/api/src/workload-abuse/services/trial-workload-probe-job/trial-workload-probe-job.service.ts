import { addMinutes, subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

export class ProbeTrialDeployment implements Job {
  static readonly [JOB_NAME] = "ProbeTrialDeployment";
  readonly name = ProbeTrialDeployment[JOB_NAME];
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

export type ProbeTrialDeploymentTarget = { walletId: number; dseq: string };

export function probeTrialDeploymentKeyFor({ walletId, dseq }: ProbeTrialDeploymentTarget): string {
  return `probeTrialDeployment.${walletId}.${dseq}`;
}

/**
 * Owns the probe schedule of a trial deployment: the first probes sit at fixed offsets from the lease, the rest repeat
 * at a jittered interval so the workload cannot learn when the next look comes.
 */
@singleton()
export class TrialWorkloadProbeJobService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly detectionRepository: WorkloadAbuseDetectionRepository,
    private readonly config: WorkloadAbuseConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TrialWorkloadProbeJobService.name });
  }

  async scheduleInitial(target: ProbeTrialDeploymentTarget & { leaseCreatedAt: Date }): Promise<string | null> {
    if (!this.config.get("WORKLOAD_ABUSE_PROBE_ENABLED")) return null;

    return this.#schedule({ ...target, attempt: 1, leaseCreatedAt: target.leaseCreatedAt.toISOString() });
  }

  async scheduleNext(previous: ProbeTrialDeployment["data"]): Promise<string | null> {
    return this.#schedule({ ...previous, attempt: previous.attempt + 1 });
  }

  async cancelForDeployment(target: ProbeTrialDeploymentTarget): Promise<void> {
    await this.jobQueueService.cancelCreatedBy({ name: ProbeTrialDeployment[JOB_NAME], singletonKey: probeTrialDeploymentKeyFor(target) });
  }

  async cancelForWallet(walletId: number): Promise<number> {
    const prefix = `probeTrialDeployment.${walletId}.`;
    const pendingKeys = [...(await this.jobQueueService.findPendingSingletonKeys(ProbeTrialDeployment[JOB_NAME]))].filter(key => key.startsWith(prefix));

    for (const singletonKey of pendingKeys) {
      await this.jobQueueService.cancelCreatedBy({ name: ProbeTrialDeployment[JOB_NAME], singletonKey });
    }

    return pendingKeys.length;
  }

  /** Backstops the lease-created hook: a live trial deployment with no pending probe gets one, whatever the reason it has none. */
  async reconcile({ dryRun }: DryRunOptions): Promise<void> {
    if (!this.config.get("WORKLOAD_ABUSE_PROBE_ENABLED")) {
      this.logger.info({ event: "TRIAL_WORKLOAD_PROBE_RECONCILE_DISABLED" });
      return;
    }

    const maxAgeHours = this.config.get("WORKLOAD_ABUSE_RECONCILE_MAX_AGE_HOURS");
    const deployments = await this.deploymentSettingRepository.findLiveTrialDeployments({ maxAgeHours });
    this.logger.info({ event: "TRIAL_WORKLOAD_PROBE_RECONCILE_START", count: deployments.length, dryRun });

    if (dryRun) return;

    const pendingKeys = await this.jobQueueService.findPendingSingletonKeys(ProbeTrialDeployment[JOB_NAME]);
    const detectedTargets = await this.detectionRepository.findRecentHardTargets({ since: subHours(new Date(), maxAgeHours) });
    const detectedKeys = new Set(detectedTargets.map(probeTrialDeploymentKeyFor));
    let scheduled = 0;
    let alreadyScheduled = 0;
    let alreadyDetected = 0;
    let failed = 0;

    for (const deployment of deployments) {
      const key = probeTrialDeploymentKeyFor(deployment);

      if (pendingKeys.has(key)) {
        alreadyScheduled++;
        continue;
      }

      if (detectedKeys.has(key)) {
        alreadyDetected++;
        continue;
      }

      try {
        const jobId = await this.#schedule(
          { walletId: deployment.walletId, dseq: deployment.dseq, attempt: 1, leaseCreatedAt: deployment.createdAt.toISOString() },
          new Date()
        );
        if (jobId) scheduled++;
        else alreadyScheduled++;
      } catch (error) {
        this.logger.error({ event: "TRIAL_WORKLOAD_PROBE_RECONCILE_FAILED", dseq: deployment.dseq, walletId: deployment.walletId, error });
        failed++;
      }
    }

    this.logger.info({ event: "TRIAL_WORKLOAD_PROBE_RECONCILE_END", found: deployments.length, scheduled, alreadyScheduled, alreadyDetected, failed });
  }

  /** `startAfter` never sits in the past, because pg-boss derives a job's retention from it and would archive an overdue job before a worker sees it. */
  startAfterFor(data: Pick<ProbeTrialDeployment["data"], "attempt" | "leaseCreatedAt">, now = new Date()): Date {
    const initialDelays = this.config.get("WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN");

    if (data.attempt <= initialDelays.length) {
      const scheduledAt = addMinutes(new Date(data.leaseCreatedAt), initialDelays[data.attempt - 1]);
      return new Date(Math.max(scheduledAt.getTime(), now.getTime()));
    }

    const jitter = this.config.get("WORKLOAD_ABUSE_PROBE_JITTER_MIN");
    const offset = (Math.random() * 2 - 1) * jitter;

    return addMinutes(now, this.config.get("WORKLOAD_ABUSE_PROBE_INTERVAL_MIN") + offset);
  }

  async #schedule(data: ProbeTrialDeployment["data"], startAfter = this.startAfterFor(data)): Promise<string | null> {
    return this.jobQueueService.enqueue(new ProbeTrialDeployment(data), {
      singletonKey: probeTrialDeploymentKeyFor(data),
      startAfter: startAfter.toISOString()
    });
  }
}
