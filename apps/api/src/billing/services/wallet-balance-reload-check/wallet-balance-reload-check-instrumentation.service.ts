import { LoggerService } from "@akashnetwork/logging";
import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core";

@singleton()
export class WalletBalanceReloadCheckInstrumentationService {
  private readonly meter: Meter;
  private readonly jobExecutions: Counter;
  private readonly jobDuration: Histogram;
  private readonly reloadsTriggered: Counter;
  private readonly reloadsSkipped: Counter;
  private readonly reloadFailures: Counter;
  private readonly validationErrors: Counter;
  private readonly schedulingErrors: Counter;
  private readonly reloadAmounts: Histogram;
  private readonly balanceCoverageRatio: Histogram;
  private readonly projectedCost: Histogram;

  private readonly logger = LoggerService.forContext("WalletBalanceReloadCheckHandler");

  constructor(private readonly metricsService: MetricsService) {
    this.meter = this.metricsService.getMeter("wallet-balance-reload-check", "1.0.0");

    this.jobExecutions = this.metricsService.createCounter(this.meter, "wallet_balance_reload_check_job_executions_total", {
      description: "Total number of wallet balance reload check job executions"
    });

    this.jobDuration = this.metricsService.createHistogram(this.meter, "wallet_balance_reload_check_job_duration_ms", {
      description: "Duration of wallet balance reload check job execution in milliseconds",
      unit: "ms"
    });

    this.reloadsTriggered = this.metricsService.createCounter(this.meter, "wallet_balance_reload_check_reloads_triggered_total", {
      description: "Total number of wallet balance reloads triggered"
    });

    this.reloadsSkipped = this.metricsService.createCounter(this.meter, "wallet_balance_reload_check_reloads_skipped_total", {
      description: "Total number of wallet balance reloads skipped"
    });

    this.reloadFailures = this.metricsService.createCounter(this.meter, "wallet_balance_reload_check_reload_failures_total", {
      description: "Total number of wallet balance reload failures"
    });

    this.validationErrors = this.metricsService.createCounter(this.meter, "wallet_balance_reload_check_validation_errors_total", {
      description: "Total number of validation errors by error type"
    });

    this.schedulingErrors = this.metricsService.createCounter(this.meter, "wallet_balance_reload_check_scheduling_errors_total", {
      description: "Total number of errors when scheduling next check"
    });

    this.reloadAmounts = this.metricsService.createHistogram(this.meter, "wallet_balance_reload_check_reload_amount_usd", {
      description: "Amount of wallet balance reloads in USD",
      unit: "USD"
    });

    this.balanceCoverageRatio = this.metricsService.createHistogram(this.meter, "wallet_balance_reload_check_balance_coverage_ratio", {
      description: "Ratio of current balance to projected cost (balance / costUntilTargetDate)"
    });

    this.projectedCost = this.metricsService.createHistogram(this.meter, "wallet_balance_reload_check_projected_cost_usd", {
      description: "Projected deployment cost until target date in USD",
      unit: "USD"
    });
  }

  recordJobExecution(durationMs: number, success: boolean, userId: string): void {
    this.jobExecutions.add(1, {
      status: success ? "success" : "failure"
    });
    this.jobDuration.record(durationMs, {
      status: success ? "success" : "failure"
    });
    this.logger.info({
      event: "WALLET_BALANCE_RELOAD_CHECK_JOB_COMPLETED",
      durationMs,
      status: success ? "success" : "failure",
      userId
    });
  }

  recordReloadTriggered(amount: number, balance: number, threshold: number, costUntilTargetDate: number, logContext: Record<string, unknown>): void {
    this.reloadsTriggered.add(1);
    this.reloadAmounts.record(amount);
    // Only record balance coverage ratio if cost is greater than 0 to avoid division by zero
    if (costUntilTargetDate > 0) {
      this.balanceCoverageRatio.record(balance / costUntilTargetDate);
    }
    this.projectedCost.record(costUntilTargetDate);
    this.logger.info({
      ...logContext,
      amount,
      event: "WALLET_BALANCE_RELOADED"
    });
  }

  recordReloadSkipped(
    balance: number,
    threshold: number,
    costUntilTargetDate: number,
    reason: "zero_cost" | "sufficient_balance",
    logContext: Record<string, unknown>
  ): void {
    this.reloadsSkipped.add(1, {
      reason
    });
    // Only record balance coverage ratio if cost is greater than 0 to avoid division by zero
    // For zero_cost reason, costUntilTargetDate will be 0, so we skip recording the ratio
    if (costUntilTargetDate > 0) {
      this.balanceCoverageRatio.record(balance / costUntilTargetDate);
    }
    this.projectedCost.record(costUntilTargetDate);
    this.logger.info({
      ...logContext,
      event: "WALLET_BALANCE_RELOAD_SKIPPED"
    });
  }

  recordReloadFailed(amount: number, error: unknown, logContext: Record<string, unknown>): void {
    this.reloadFailures.add(1, {
      error_type: error instanceof Error ? error.constructor.name : "Unknown"
    });
    this.reloadAmounts.record(amount);
    this.logger.error({
      ...logContext,
      event: "WALLET_BALANCE_RELOAD_FAILED",
      error: error
    });
  }

  recordValidationError(errorType: string, error: { event: string; message: string }, userId: string): void {
    this.validationErrors.add(1, {
      error_type: errorType
    });
    this.logger.error({
      ...error,
      userId: userId
    });
  }

  recordSchedulingError(walletAddress: string, error: unknown): void {
    this.schedulingErrors.add(1, {
      error_type: error instanceof Error ? error.constructor.name : "Unknown"
    });
    this.logger.error({
      event: "ERROR_SCHEDULING_NEXT_CHECK",
      walletAddress,
      error: error
    });
  }
}
