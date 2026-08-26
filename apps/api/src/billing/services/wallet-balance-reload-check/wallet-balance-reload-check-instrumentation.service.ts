import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import type { WalletSettingOutput } from "@src/billing/repositories";
import { MetricsService } from "@src/core";

type ReloadMetricInput = {
  mode: WalletSettingOutput["autoReloadMode"];
  coverageRatio?: number;
  projectedCost?: number;
  logContext: Record<string, unknown>;
};

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
  private readonly balanceCoverageRatio: Histogram;
  private readonly projectedCost: Histogram;

  private readonly logger = createOtelLogger({ context: "WalletBalanceReloadCheckHandler" });

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

    this.balanceCoverageRatio = this.metricsService.createHistogram(this.meter, "wallet_balance_reload_check_balance_coverage_ratio", {
      description:
        "Ratio of current balance to the reload trigger point (balance / threshold in threshold mode, balance / costUntilTargetDate in prediction mode)"
    });

    this.projectedCost = this.metricsService.createHistogram(this.meter, "wallet_balance_reload_check_projected_cost_usd", {
      description: "Projected deployment cost until target date in USD (prediction mode only)",
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

  recordReloadTriggered(input: ReloadMetricInput & { amount: number }): void {
    this.reloadsTriggered.add(1, {
      mode: input.mode
    });
    this.#recordCoverage(input);
    this.logger.info({
      ...input.logContext,
      mode: input.mode,
      amount: input.amount,
      event: "WALLET_BALANCE_RELOADED"
    });
  }

  recordReloadSkipped(input: ReloadMetricInput & { reason: "zero_cost" | "sufficient_balance" | "no_active_deployments" | "charge_rate_limited" }): void {
    this.reloadsSkipped.add(1, {
      mode: input.mode,
      reason: input.reason
    });
    this.#recordCoverage(input);
    this.logger.info({
      ...input.logContext,
      mode: input.mode,
      event: "WALLET_BALANCE_RELOAD_SKIPPED"
    });
  }

  #recordCoverage(input: ReloadMetricInput): void {
    if (input.coverageRatio !== undefined) {
      this.balanceCoverageRatio.record(input.coverageRatio, { mode: input.mode });
    }
    if (input.projectedCost !== undefined) {
      this.projectedCost.record(input.projectedCost, { mode: input.mode });
    }
  }

  recordReloadFailed(input: Pick<ReloadMetricInput, "mode" | "logContext"> & { error: unknown }): void {
    this.reloadFailures.add(1, {
      mode: input.mode,
      error_type: input.error instanceof Error ? input.error.constructor.name : "Unknown"
    });
    this.logger.error({
      ...input.logContext,
      mode: input.mode,
      event: "WALLET_BALANCE_RELOAD_FAILED",
      error: input.error
    });
  }

  recordChargeClaimReleaseError(walletSettingId: string, error: unknown): void {
    this.logger.error({
      event: "ERROR_RELEASING_CHARGE_CLAIM",
      walletSettingId,
      error
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
