import { inject, singleton } from "tsyringe";

import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { CloseExpiredDeploymentCommand } from "@src/deployment/commands/close-expired-deployment.command";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";

export type CloseExpiredDeploymentTarget = {
  deploymentSettingId: string;
  userId: string;
  dseq: string;
};

/**
 * Owns the one pending close job a runtime-limited deployment carries: scheduled at its deadline when
 * the countdown is anchored, moved when the deadline moves, cancelled when the limit is dropped.
 *
 * Every schedule cancels the deployment's pending job first, because the `singleton` policy only keeps
 * one job per key from running at once and does not stop a second one from being queued. Cancel then
 * enqueue is what leaves exactly one, and it is safe to repeat: the handler re-reads the row anyway, so
 * a duplicate that slips through closes nothing twice.
 */
@singleton()
export class DeploymentCloseJobService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly jobQueueService: JobQueueService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DeploymentCloseJobService.name });
  }

  static singletonKey(deploymentSettingId: string): string {
    return `${CloseExpiredDeploymentCommand[JOB_NAME]}.${deploymentSettingId}`;
  }

  /**
   * `startAfter` is clamped to the present because pg-boss derives a job's `keep_until` from it: a
   * deadline more than the queue's retention window in the past would produce a job that maintenance
   * archives before any worker reaches it. Clamping makes an overdue deadline run now, which is what
   * an overdue deadline means.
   */
  async schedule(target: CloseExpiredDeploymentTarget, options: { startAfter: Date; withCleanup?: boolean }): Promise<string> {
    if (options.withCleanup) {
      await this.cancel(target.deploymentSettingId);
    }

    const startAfter = new Date(Math.max(options.startAfter.getTime(), Date.now()));

    const createdJobId = await this.jobQueueService.enqueue(new CloseExpiredDeploymentCommand(target), {
      singletonKey: DeploymentCloseJobService.singletonKey(target.deploymentSettingId),
      startAfter: startAfter.toISOString()
    });

    if (!createdJobId) {
      this.logger.error({ event: "CLOSE_JOB_CREATION_FAILED", deploymentSettingId: target.deploymentSettingId, dseq: target.dseq });
      throw new Error(`Failed to schedule expired deployment close for deployment setting ${target.deploymentSettingId}`);
    }

    return createdJobId;
  }

  async cancel(deploymentSettingId: string): Promise<void> {
    await this.jobQueueService.cancelCreatedBy({
      name: CloseExpiredDeploymentCommand[JOB_NAME],
      singletonKey: DeploymentCloseJobService.singletonKey(deploymentSettingId)
    });
  }

  /**
   * Backstops the event-driven scheduling: any deployment already past its deadline gets a close job
   * regardless of why it has none, whether that is an enqueue that failed, a job that ran out of
   * retries, or a row nothing ever anchored a job for. Runs alongside the hourly funding sweep, so a
   * deployment the events missed still closes within the hour.
   */
  async reconcileExpired({ dryRun }: DryRunOptions): Promise<void> {
    const expired = await this.deploymentSettingRepository.findExpiredRuntimeDeployments();

    this.logger.info({ event: "EXPIRED_DEPLOYMENTS_RECONCILE_START", count: expired.length, dryRun });

    if (dryRun) {
      return;
    }

    let scheduled = 0;
    let failed = 0;

    for (const deployment of expired) {
      try {
        await this.schedule(
          { deploymentSettingId: deployment.id, userId: deployment.userId, dseq: deployment.dseq },
          { startAfter: deployment.runtimeEndsAt, withCleanup: true }
        );
        scheduled++;
      } catch (error) {
        this.logger.error({ event: "EXPIRED_DEPLOYMENT_RECONCILE_FAILED", deploymentSettingId: deployment.id, dseq: deployment.dseq, error });
        failed++;
      }
    }

    this.logger.info({ event: "EXPIRED_DEPLOYMENTS_RECONCILE_END", found: expired.length, scheduled, failed });
  }
}
