import { addSeconds } from "date-fns";
import { singleton } from "tsyringe";

import { X402ReconcileSettled } from "@src/billing/events/x402-reconcile-settled";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { JOB_NAME, JobQueueService } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";

const RECONCILE_QUEUE = X402ReconcileSettled[JOB_NAME];

@singleton()
export class X402ReconcileJobService {
  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly jobQueueService: JobQueueService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(X402ReconcileJobService.name);
  }

  private get isEnabled(): boolean {
    return this.config.X402_ENABLED === "true" && !!this.config.X402_PAY_TO_ADDRESS;
  }

  /**
   * Seeds the recurring reconcile loop on app start. No-op when x402 is disabled so we never run a
   * job that has nothing to reconcile.
   */
  async scheduleInitial(): Promise<void> {
    if (!this.isEnabled) {
      this.logger.info({ event: "X402_RECONCILE_SCHEDULE_SKIPPED", reason: "x402_disabled" });
      return;
    }

    await this.schedule({ startAfterSeconds: this.config.X402_RECONCILE_INTERVAL_SECONDS });
  }

  /**
   * Enqueues the next reconcile run. Any not-yet-started duplicate is cancelled first so restarts and
   * self-rescheduling from the handler never pile up more than one pending job.
   */
  async schedule(options?: { startAfterSeconds?: number }): Promise<string | null> {
    const singletonKey = RECONCILE_QUEUE;
    await this.jobQueueService.cancelCreatedBy({ name: RECONCILE_QUEUE, singletonKey });

    const startAfterSeconds = options?.startAfterSeconds ?? this.config.X402_RECONCILE_INTERVAL_SECONDS;

    return this.jobQueueService.enqueue(new X402ReconcileSettled(), {
      singletonKey,
      startAfter: addSeconds(new Date(), startAfterSeconds).toISOString()
    });
  }
}
