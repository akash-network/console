import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core";

export type FundingFailureReason = "lease_not_visible" | "deposit_tx_failed" | "unknown";

export type FundingSkipReason =
  | "deployment_closed"
  | "sufficient_runway"
  | "insufficient_balance"
  | "no_fee_allowance"
  | "wallet_not_found"
  | "runtime_limit_reached"
  | "recently_funded";

const SKIP_LOG_LEVEL: Record<FundingSkipReason, "info" | "warn" | "error"> = {
  sufficient_runway: "info",
  deployment_closed: "info",
  insufficient_balance: "warn",
  no_fee_allowance: "warn",
  wallet_not_found: "error",
  runtime_limit_reached: "info",
  recently_funded: "info"
};

export function classifyFailure(error: unknown): FundingFailureReason {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  if (/not visible on chain yet/i.test(error.message)) {
    return "lease_not_visible";
  }

  return "deposit_tx_failed";
}

@singleton()
export class InitialDeploymentFundingInstrumentationService {
  private readonly meter: Meter;
  private readonly jobCompletions: Counter;
  private readonly jobDuration: Histogram;
  private readonly deposits: Counter;
  private readonly depositAmount: Histogram;
  private readonly skips: Counter;
  private readonly undecidedTxOutcomes: Counter;

  private readonly logger = createOtelLogger({ context: "InitialDeploymentFundingService" });

  constructor(private readonly metricsService: MetricsService) {
    this.meter = this.metricsService.getMeter("initial-deployment-funding", "1.0.0");

    this.jobCompletions = this.metricsService.createCounter(this.meter, "initial_deployment_funding_job_completions_total", {
      description: "Total number of initial deployment funding job completions by status"
    });

    this.jobDuration = this.metricsService.createHistogram(this.meter, "initial_deployment_funding_job_duration_ms", {
      description: "Duration of initial deployment funding job execution in milliseconds",
      unit: "ms"
    });

    this.deposits = this.metricsService.createCounter(this.meter, "initial_deployment_funding_deposits_total", {
      description: "Total number of initial deployment funding deposits made on-chain"
    });

    this.depositAmount = this.metricsService.createHistogram(this.meter, "initial_deployment_funding_deposit_amount", {
      description: "Amount deposited on-chain by the initial deployment funding job, in raw base units"
    });

    this.skips = this.metricsService.createCounter(this.meter, "initial_deployment_funding_skips_total", {
      description: "Total number of initial deployment funding runs that skipped depositing, by reason"
    });

    this.undecidedTxOutcomes = this.metricsService.createCounter(this.meter, "initial_deployment_funding_undecided_tx_outcomes_total", {
      description: "Total number of initial funding deposits whose transaction may still land, so their funding claim was held rather than released"
    });
  }

  recordJobSucceeded(durationMs: number): void {
    this.jobCompletions.add(1, { status: "success" });
    this.jobDuration.record(durationMs, { status: "success" });
    this.emitLog("info", { event: "INITIAL_FUNDING_JOB_COMPLETED", durationMs, status: "success" });
  }

  recordJobFailed(durationMs: number, error: unknown): void {
    const reason = classifyFailure(error);
    const retriable = reason === "lease_not_visible";

    this.jobCompletions.add(1, { status: "failure", reason, retriable });
    this.jobDuration.record(durationMs, { status: "failure" });
    this.emitLog("error", { event: "INITIAL_FUNDING_JOB_FAILED", durationMs, reason, retriable, error });
  }

  recordDeposit(amount: number, denom: string, logContext: Record<string, unknown>): void {
    this.deposits.add(1);
    this.depositAmount.record(amount, { denom });
    this.emitLog("info", { ...logContext, event: "INITIAL_FUNDING_DEPOSITED", amount, denom });
  }

  recordUndecidedTxOutcome(logContext: Record<string, unknown>): void {
    this.undecidedTxOutcomes.add(1);
    this.emitLog("error", { ...logContext, event: "INITIAL_FUNDING_UNDECIDED_TX_OUTCOME" });
  }

  recordSkipped(reason: FundingSkipReason, logContext: Record<string, unknown>): void {
    this.skips.add(1, { reason });
    this.emitLog(SKIP_LOG_LEVEL[reason], { ...logContext, event: "INITIAL_FUNDING_SKIPPED", reason });
  }

  /**
   * Telemetry must never break the funding job. This runs on pg-boss, so a
   * synchronous logger failure escaping a record* call would mark an
   * already-completed deposit as failed and trigger a retry. Metrics are
   * emitted before logging because the OTel spec guarantees they never throw.
   */
  private emitLog(level: "info" | "warn" | "error", payload: Record<string, unknown>): void {
    try {
      this.logger[level](payload);
    } catch {
      return;
    }
  }
}
