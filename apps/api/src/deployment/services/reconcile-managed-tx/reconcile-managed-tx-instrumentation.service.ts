import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { Counter, Meter } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core";

export type ReconciliationResolution = "landed" | "reverted" | "not_seen";

const RESOLUTION_LOG_LEVEL: Record<ReconciliationResolution, "info" | "warn"> = {
  landed: "warn",
  reverted: "info",
  not_seen: "warn"
};

@singleton()
export class ReconcileManagedTxInstrumentationService {
  private readonly meter: Meter;
  private readonly resolutions: Counter;

  private readonly logger = createOtelLogger({ context: "ReconcileManagedTxHandler" });

  constructor(private readonly metricsService: MetricsService) {
    this.meter = this.metricsService.getMeter("reconcile-managed-tx", "1.0.0");

    this.resolutions = this.metricsService.createCounter(this.meter, "managed_tx_reconciliations_total", {
      description: "Total number of managed transactions whose undecided outcome was resolved against the chain, by resolution"
    });
  }

  recordResolution(resolution: ReconciliationResolution, logContext: Record<string, unknown>): void {
    this.resolutions.add(1, { resolution });
    this.emitLog(RESOLUTION_LOG_LEVEL[resolution], { ...logContext, event: "MANAGED_TX_RECONCILED", resolution });
  }

  /** Telemetry must not fail the job: a throw here would retry a reconciliation that has already released its claims. */
  private emitLog(level: "info" | "warn", payload: Record<string, unknown>): void {
    try {
      this.logger[level](payload);
    } catch {
      return;
    }
  }
}
