import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core";
import type { DrainingDeployment } from "@src/deployment/types/draining-deployment";
import type { DeploymentTopUpInstrumentation, FundingMessageItem, OwnerInsufficientBalanceItem } from "./deployment-top-up-instrumentation";

export type FundDrainingFailureReason = "master_wallet_insufficient_funds" | "deposit_tx_failed" | "unknown";

export type FundDrainingSkipReason = "nothing_to_fund" | "non_positive_amount" | "runtime_limit_reached" | "below_useful_runway";

export function classifyFailure(error: unknown): FundDrainingFailureReason {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  if (/insufficient funds/i.test(error.message)) {
    return "master_wallet_insufficient_funds";
  }

  return "deposit_tx_failed";
}

/**
 * Instruments the event-driven immediate funding path (funding a wallet's draining deployments the moment
 * credits land). Unlike the cron's summarizer-backed instrumentation it is stateless and holds no per-run
 * state, so the always-on background worker can run several fundings concurrently without co-mingling. It
 * reports under its own `fund_draining_deployments_*` meter so immediate funding stays distinguishable from
 * the hourly cron's `auto_top_up_*` series.
 */
@singleton()
export class FundDrainingDeploymentsInstrumentationService implements DeploymentTopUpInstrumentation {
  private readonly meter: Meter;
  private readonly jobCompletions: Counter;
  private readonly jobDuration: Histogram;
  private readonly deposits: Counter;
  private readonly deploymentsScanned: Counter;
  private readonly depositAmount: Histogram;
  private readonly skips: Counter;
  private readonly messagePreparationErrors: Counter;
  private readonly insufficientBalanceWithAutoReload: Counter;
  private readonly chainTxErrors: Counter;
  private readonly masterWalletInsufficientFunds: Counter;
  private readonly deploymentsMarkedClosed: Counter;
  private readonly settingsWithoutChainState: Counter;
  private readonly claimReleaseErrors: Counter;
  private readonly headroomConcessions: Counter;

  private readonly logger = createOtelLogger({ context: "FundDrainingDeploymentsService" });

  constructor(private readonly metricsService: MetricsService) {
    this.meter = this.metricsService.getMeter("fund-draining-deployments", "1.0.0");

    this.jobCompletions = this.metricsService.createCounter(this.meter, "fund_draining_deployments_job_completions_total", {
      description: "Total number of immediate draining-deployment funding job completions by status"
    });

    this.jobDuration = this.metricsService.createHistogram(this.meter, "fund_draining_deployments_job_duration_ms", {
      description: "Duration of immediate draining-deployment funding job execution in milliseconds",
      unit: "ms"
    });

    this.deposits = this.metricsService.createCounter(this.meter, "fund_draining_deployments_deposits_total", {
      description: "Total number of successful immediate draining-deployment deposit transactions"
    });

    this.deploymentsScanned = this.metricsService.createCounter(this.meter, "fund_draining_deployments_scanned_total", {
      description: "Total number of draining deployments the immediate funding path evaluated for funding"
    });

    this.depositAmount = this.metricsService.createHistogram(this.meter, "fund_draining_deployments_deposit_amount", {
      description: "Immediate draining-deployment deposit amounts per deployment",
      unit: "uakt"
    });

    this.skips = this.metricsService.createCounter(this.meter, "fund_draining_deployments_skips_total", {
      description: "Total number of immediate funding deployments skipped without depositing, by reason"
    });

    this.messagePreparationErrors = this.metricsService.createCounter(this.meter, "fund_draining_deployments_message_preparation_errors_total", {
      description: "Total number of failed immediate funding message preparation attempts, by error type"
    });

    this.insufficientBalanceWithAutoReload = this.metricsService.createCounter(
      this.meter,
      "fund_draining_deployments_insufficient_balance_with_auto_reload_total",
      {
        description: "Total number of immediate funding insufficient balance errors where wallet auto-reload is enabled"
      }
    );

    this.chainTxErrors = this.metricsService.createCounter(this.meter, "fund_draining_deployments_chain_tx_errors_total", {
      description: "Total number of failed immediate funding deposit attempts"
    });

    this.masterWalletInsufficientFunds = this.metricsService.createCounter(this.meter, "fund_draining_deployments_master_wallet_insufficient_funds_total", {
      description: "Total number of immediate funding deposits aborted because the master wallet had insufficient funds"
    });

    this.settingsWithoutChainState = this.metricsService.createCounter(this.meter, "fund_draining_settings_without_chain_state_total", {
      description: "Deployment records the pass could not resolve to any chain state, so it neither funded nor closed them"
    });
    this.deploymentsMarkedClosed = this.metricsService.createCounter(this.meter, "fund_draining_deployments_deployments_marked_closed_total", {
      description: "Total number of deployments marked as closed while resolving immediate funding candidates"
    });

    this.claimReleaseErrors = this.metricsService.createCounter(this.meter, "fund_draining_deployments_claim_release_errors_total", {
      description: "Total number of failed attempts to release an immediate funding claim after a deposit did not land"
    });

    this.headroomConcessions = this.metricsService.createCounter(this.meter, "fund_draining_deployments_headroom_concessions_total", {
      description: "Total number of immediate funding deposits sized from the whole balance because keeping the headroom would have skipped them"
    });
  }

  recordJobSucceeded(durationMs: number): void {
    this.jobCompletions.add(1, { status: "success" });
    this.jobDuration.record(durationMs, { status: "success" });
    this.emitLog("info", { event: "FUND_DRAINING_JOB_COMPLETED", durationMs, status: "success" });
  }

  recordJobFailed(durationMs: number, error: unknown): void {
    const reason = classifyFailure(error);
    const retriable = reason === "master_wallet_insufficient_funds";

    this.jobCompletions.add(1, { status: "failure", reason, retriable });
    this.jobDuration.record(durationMs, { status: "failure" });
    this.emitLog("error", { event: "FUND_DRAINING_JOB_FAILED", durationMs, reason, retriable, error });
  }

  recordDeposit({ owner, items }: { owner: string; items: FundingMessageItem[] }): void {
    this.deposits.add(items.length);
    items.forEach(({ input }) => this.depositAmount.record(input.amount, { denom: input.denom }));
    this.emitLog("info", {
      event: "FUND_DRAINING_DEPOSITED",
      owner,
      deposits: this.serializeDeposits(items)
    });
  }

  recordSkipped({ owner, deploymentCount }: { owner: string; deploymentCount: number }): void {
    this.skips.add(1, { reason: "nothing_to_fund" satisfies FundDrainingSkipReason });
    this.emitLog("info", { event: "FUND_DRAINING_SKIPPED", owner, deploymentCount });
  }

  recordInvalidDepositAmount(details: { desiredAmount: number; dseq: string; address: string; blockRate: number }): void {
    this.skips.add(1, { reason: "non_positive_amount" satisfies FundDrainingSkipReason });
    this.emitLog("warn", { event: "FUND_DRAINING_AMOUNT_NON_POSITIVE", ...details });
  }

  recordRuntimeLimitReached(details: { dseq: string; address: string; runtimeEndsAt: Date }): void {
    this.skips.add(1, { reason: "runtime_limit_reached" satisfies FundDrainingSkipReason });
    this.emitLog("info", { event: "FUND_DRAINING_RUNTIME_LIMIT_REACHED", ...details });
  }

  recordDepositBelowUsefulRunway(details: { dseq: string; address: string; desiredAmount: number; affordableAmount: number; runwayMinutes: number }): void {
    this.skips.add(1, { reason: "below_useful_runway" satisfies FundDrainingSkipReason });
    this.emitLog("warn", { event: "FUND_DRAINING_DEPOSIT_BELOW_USEFUL_RUNWAY", ...details });
  }

  recordHeadroomConceded(details: {
    dseq: string;
    address: string;
    desiredAmount: number;
    flooredAmount: number;
    affordableAmount: number;
    runwayMinutes: number;
  }): void {
    this.headroomConcessions.add(1);
    this.emitLog("warn", { event: "FUND_DRAINING_HEADROOM_CONCEDED", ...details });
  }

  recordMessagePreparationError({ deployment, error }: { deployment: DrainingDeployment; error: unknown }): void {
    const message = error instanceof Error ? error.message : String(error);
    const isInsufficientBalance = message.startsWith("Insufficient balance");
    const errorType = isInsufficientBalance ? "insufficient_balance" : "unknown";

    this.messagePreparationErrors.add(1, { error_type: errorType });

    if (isInsufficientBalance && deployment.isWalletAutoTopUpEnabled) {
      this.insufficientBalanceWithAutoReload.add(1);
    }

    this.emitLog(isInsufficientBalance ? "warn" : "error", {
      event: "FUND_DRAINING_MESSAGE_PREPARATION_ERROR",
      errorType,
      dseq: deployment.dseq,
      address: deployment.address,
      error
    });
  }

  recordOwnerInsufficientBalance({ owner, spendable, deployments }: { owner: string; spendable: number; deployments: OwnerInsufficientBalanceItem[] }): void {
    this.messagePreparationErrors.add(deployments.length, { error_type: "insufficient_balance" });

    const withAutoReloadCount = deployments.filter(({ deployment }) => deployment.isWalletAutoTopUpEnabled).length;

    if (withAutoReloadCount > 0) {
      this.insufficientBalanceWithAutoReload.add(withAutoReloadCount);
    }

    this.emitLog("warn", {
      event: "FUND_DRAINING_OWNER_INSUFFICIENT_BALANCE",
      owner,
      spendable,
      deploymentCount: deployments.length,
      deployments: deployments.map(({ deployment, desiredAmount }) => ({ dseq: deployment.dseq, desiredAmount }))
    });
  }

  recordChainTxError({ owner, items, error }: { owner: string; items: FundingMessageItem[]; error: unknown }): void {
    this.chainTxErrors.add(1);
    this.emitLog("error", {
      event: "FUND_DRAINING_CHAIN_TX_ERROR",
      owner,
      deposits: this.serializeDeposits(items),
      error
    });
  }

  recordMasterWalletInsufficientFundsError({ owner, items, error }: { owner: string; items: FundingMessageItem[]; error: unknown }): void {
    this.masterWalletInsufficientFunds.add(1);
    this.emitLog("error", {
      event: "FUND_DRAINING_MASTER_WALLET_INSUFFICIENT_FUNDS",
      owner,
      deposits: this.serializeDeposits(items),
      error
    });
  }

  recordClaimReleaseError({ owner, deploymentIds, error }: { owner: string; deploymentIds: string[]; error: unknown }): void {
    this.claimReleaseErrors.add(1);
    this.emitLog("error", {
      event: "FUND_DRAINING_CLAIM_RELEASE_ERROR",
      owner,
      deploymentIds,
      error
    });
  }

  recordDeploymentsMarkedClosed(count: number): void {
    this.deploymentsMarkedClosed.add(count);
  }

  /** Logged at debug because a churning owner produces one per pass, while the counter is what says whether the number is falling. */
  recordSettingWithoutChainState({ dseq, address }: { dseq: string; address: string }): void {
    this.settingsWithoutChainState.add(1);

    this.emitLog("debug", { event: "FUND_DRAINING_SETTING_WITHOUT_CHAIN_STATE", dseq, address });
  }

  recordCreditsLowScheduleError({ walletId, error }: { walletId: number; error: unknown }): void {
    this.emitLog("error", { event: "FUND_DRAINING_CREDITS_LOW_SCHEDULE_ERROR", walletId, error });
  }

  recordDeploymentClosedOnChain({
    owner,
    deployment,
    messageIndex,
    error
  }: {
    owner: string;
    deployment: DrainingDeployment;
    messageIndex?: number;
    error: unknown;
  }): void {
    this.recordDeploymentsMarkedClosed(1);

    this.emitLog("warn", {
      event: "FUND_DRAINING_DEPLOYMENT_CLOSED_ON_CHAIN",
      owner,
      dseq: deployment.dseq,
      address: deployment.address,
      messageIndex,
      error
    });
  }

  /** The count stays uncredited so telemetry never reports a row as closed that the database still has open. */
  recordDeploymentCloseMarkFailed({ owner, deployment, error }: { owner: string; deployment: DrainingDeployment; error: unknown }): void {
    this.emitLog("warn", {
      event: "FUND_DRAINING_DEPLOYMENT_CLOSE_MARK_FAILED",
      owner,
      dseq: deployment.dseq,
      address: deployment.address,
      error
    });
  }

  recordClosedDeploymentRetryLimit({ owner, remainingCount }: { owner: string; remainingCount: number }): void {
    this.emitLog("warn", {
      event: "FUND_DRAINING_CLOSED_DEPLOYMENT_RETRY_LIMIT",
      owner,
      remainingCount
    });
  }

  /**
   * The cron also records blocks-until-predicted-close against a run-scoped start height; the stateless
   * event-driven path has no per-run start height, so only the scanned count is meaningful here.
   */
  recordDeploymentPreparation(_ownerAddress: string, _predictedClosedHeight: number): void {
    this.deploymentsScanned.add(1);
  }

  private serializeDeposits(items: FundingMessageItem[]): { dseq: number | string; amount: number; denom: string }[] {
    return items.map(({ input }) => ({ dseq: input.dseq, amount: input.amount, denom: input.denom }));
  }

  /**
   * Telemetry must never break the funding job. It runs on pg-boss, so a synchronous logger failure
   * escaping a record* call would mark an already-completed deposit as failed and trigger a retry.
   * Metrics are emitted before logging because the OTel spec guarantees instrument writes never throw.
   */
  private emitLog(level: "debug" | "info" | "warn" | "error", payload: Record<string, unknown>): void {
    try {
      this.logger[level](payload);
    } catch {
      return;
    }
  }
}
