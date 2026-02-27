import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core";

@singleton()
export class TopUpManagedDeploymentsInstrumentationService {
  private readonly meter: Meter;
  private readonly jobExecutions: Counter;
  private readonly jobDuration: Histogram;
  private readonly depositsTotal: Counter;
  private readonly depositErrors: Counter;
  private readonly deploymentsMarkedClosed: Counter;
  private readonly depositAmount: Histogram;
  private readonly predictedCloseBlocks: Histogram;
  private readonly settingToggles: Counter;

  constructor(private readonly metricsService: MetricsService) {
    this.meter = this.metricsService.getMeter("auto-top-up", "1.0.0");

    this.jobExecutions = this.metricsService.createCounter(this.meter, "auto_top_up_job_executions_total", {
      description: "Total number of auto top-up job executions"
    });

    this.jobDuration = this.metricsService.createHistogram(this.meter, "auto_top_up_job_duration_ms", {
      description: "Duration of auto top-up job execution in milliseconds",
      unit: "ms"
    });

    this.depositsTotal = this.metricsService.createCounter(this.meter, "auto_top_up_deposits_total", {
      description: "Total number of successful deposit transactions"
    });

    this.depositErrors = this.metricsService.createCounter(this.meter, "auto_top_up_deposit_errors_total", {
      description: "Total number of failed deposit attempts"
    });

    this.deploymentsMarkedClosed = this.metricsService.createCounter(this.meter, "auto_top_up_deployments_marked_closed_total", {
      description: "Total number of deployments marked as closed by the auto top-up job"
    });

    this.depositAmount = this.metricsService.createHistogram(this.meter, "auto_top_up_deposit_amount", {
      description: "Deposit amounts per transaction",
      unit: "uakt"
    });

    this.predictedCloseBlocks = this.metricsService.createHistogram(this.meter, "auto_top_up_predicted_close_blocks", {
      description: "Number of blocks until predicted closure at detection time"
    });

    this.settingToggles = this.metricsService.createCounter(this.meter, "auto_top_up_setting_toggles_total", {
      description: "Total number of auto top-up setting enable/disable toggles"
    });
  }

  recordJobExecution(durationMs: number, status: "success" | "failure"): void {
    this.jobExecutions.add(1, { status });
    this.jobDuration.record(durationMs, { status });
  }

  recordDeposit(amount: number): void {
    this.depositsTotal.add(1);
    this.depositAmount.record(amount);
  }

  recordDepositError(errorType: string): void {
    this.depositErrors.add(1, { error_type: errorType });
  }

  recordDeploymentsMarkedClosed(count: number): void {
    this.deploymentsMarkedClosed.add(count);
  }

  recordPredictedCloseBlocks(currentHeight: number, predictedClosedHeight: number): void {
    const blocksUntilClose = predictedClosedHeight - currentHeight;
    if (blocksUntilClose > 0) {
      this.predictedCloseBlocks.record(blocksUntilClose);
    }
  }

  recordSettingToggle(enabled: boolean): void {
    this.settingToggles.add(1, { enabled: String(enabled) });
  }
}
