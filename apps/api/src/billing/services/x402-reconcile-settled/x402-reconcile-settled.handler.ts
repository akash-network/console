import { createOtelLogger } from "@akashnetwork/logging/otel";
import { singleton } from "tsyringe";

import { X402ReconcileSettled } from "@src/billing/events/x402-reconcile-settled";
import { X402Service } from "@src/billing/services/x402/x402.service";
import { X402ReconcileJobService } from "@src/billing/services/x402-reconcile-job/x402-reconcile-job.service";
import type { JobHandler, JobPayload } from "@src/core";

@singleton()
export class X402ReconcileSettledHandler implements JobHandler<X402ReconcileSettled> {
  public readonly accepts = X402ReconcileSettled;

  public readonly concurrency = 1;

  public readonly policy = "singleton";

  private readonly logger = createOtelLogger({ context: X402ReconcileSettledHandler.name });

  constructor(
    private readonly x402Service: X402Service,
    private readonly x402ReconcileJobService: X402ReconcileJobService
  ) {}

  async handle(_payload: JobPayload<X402ReconcileSettled>): Promise<void> {
    try {
      const result = await this.x402Service.reconcileStaleSettled();
      this.logger.info({ event: "X402_RECONCILE_JOB_DONE", ...result });
    } finally {
      // Self-reschedule so the loop keeps running even if a single pass throws.
      await this.x402ReconcileJobService.schedule();
    }
  }
}
