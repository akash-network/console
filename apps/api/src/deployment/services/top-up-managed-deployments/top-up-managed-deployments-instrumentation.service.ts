import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { inject, Lifecycle, scoped } from "tsyringe";

import { DepositDeploymentMsgOptions } from "@src/billing/services";
import { type CreateLogger, LOGGER_FACTORY, MetricsService } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { TopUpSummarizer } from "@src/deployment/lib/top-up-summarizer/top-up-summarizer";
import { DrainingDeployment } from "@src/deployment/types/draining-deployment";
import type { DeploymentTopUpInstrumentation, OwnerInsufficientBalanceItem } from "./deployment-top-up-instrumentation";

@scoped(Lifecycle.ResolutionScoped)
export class TopUpManagedDeploymentsInstrumentationService implements DeploymentTopUpInstrumentation {
  private readonly meter: Meter;
  private readonly jobExecutions: Counter;
  private readonly jobDuration: Histogram;
  private readonly depositsTotal: Counter;
  private readonly chainTxErrors: Counter;
  private readonly messagePreparationErrors: Counter;
  private readonly deploymentsMarkedClosed: Counter;
  private readonly settingsWithoutChainState: Counter;
  private readonly deploymentsScanned: Counter;
  private readonly depositAmount: Histogram;
  private readonly predictedCloseBlocks: Histogram;
  private readonly insufficientBalanceWithAutoReload: Counter;
  private readonly depositsBelowUsefulRunway: Counter;
  private readonly headroomConcessions: Counter;
  private readonly logger: ReturnType<CreateLogger>;
  private startTime: number | undefined;
  private options: DryRunOptions | undefined;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly topUpSummarizer: TopUpSummarizer,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TopUpManagedDeploymentsInstrumentationService.name });

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

    this.chainTxErrors = this.metricsService.createCounter(this.meter, "auto_top_up_chain_tx_errors_total", {
      description: "Total number of failed deposit attempts"
    });

    this.messagePreparationErrors = this.metricsService.createCounter(this.meter, "auto_top_up_message_preparation_errors_total", {
      description: "Total number of failed message preparation attempts"
    });

    this.deploymentsMarkedClosed = this.metricsService.createCounter(this.meter, "auto_top_up_deployments_marked_closed_total", {
      description: "Total number of deployments marked as closed by the auto top-up job"
    });

    this.settingsWithoutChainState = this.metricsService.createCounter(this.meter, "auto_top_up_settings_without_chain_state_total", {
      description: "Deployment records the sweep could not resolve to any chain state, so it neither funded nor closed them"
    });
    this.deploymentsScanned = this.metricsService.createCounter(this.meter, "auto_top_up_deployments_scanned_total", {
      description: "Total number of draining deployments the auto top-up job evaluated for funding"
    });

    this.depositAmount = this.metricsService.createHistogram(this.meter, "auto_top_up_deposit_amount", {
      description: "Deposit amounts per transaction",
      unit: "uakt"
    });

    this.predictedCloseBlocks = this.metricsService.createHistogram(this.meter, "auto_top_up_predicted_close_blocks", {
      description: "Number of blocks until predicted closure at detection time"
    });

    this.insufficientBalanceWithAutoReload = this.metricsService.createCounter(this.meter, "auto_top_up_insufficient_balance_with_auto_reload_total", {
      description: "Total number of insufficient balance errors where wallet auto-reload is enabled"
    });

    this.depositsBelowUsefulRunway = this.metricsService.createCounter(this.meter, "auto_top_up_deposits_below_useful_runway_total", {
      description: "Total number of deposits declined because the credits available bought less runway than the dedup cooldown"
    });

    this.headroomConcessions = this.metricsService.createCounter(this.meter, "auto_top_up_headroom_concessions_total", {
      description: "Total number of deposits sized from the whole balance because keeping the headroom would have skipped them"
    });
  }

  start(blockHeight: number, options: DryRunOptions) {
    this.topUpSummarizer.set("startBlockHeight", blockHeight);
    this.startTime = Date.now();
    this.options = options;
  }

  finish(status: "success" | "failure", blockHeight?: number): void {
    if (blockHeight !== undefined) {
      this.topUpSummarizer.set("endBlockHeight", blockHeight);
    }

    const summary = this.topUpSummarizer.summarize();
    const log = { event: "TOP_UP_DEPLOYMENTS_SUMMARY", summary, dryRun: !!this.options?.dryRun };
    const hasErrors = summary.deploymentTopUpErrorCount > 0;

    if (hasErrors) {
      this.logger.error(log);
    } else {
      this.logger.info(log);
    }

    this.execWhenEnabled(() => {
      this.jobExecutions.add(1, { status });

      if (this.startTime) {
        const durationMs = Date.now() - this.startTime;
        this.jobDuration.record(durationMs, { status });
      }
    });
  }

  recordDeposit(details: {
    owner: string;
    items: {
      deployment: DrainingDeployment;
      input: DepositDeploymentMsgOptions;
    }[];
  }): void {
    this.topUpSummarizer.inc("deploymentTopUpCount", details.items.length);
    this.topUpSummarizer.trackSuccessfulWallet(details.owner);
    details.items.forEach(({ input }) => {
      this.topUpSummarizer.addTopUpAmount(input.amount);
    });

    this.logger.info({
      event: "TOP_UP_DEPLOYMENTS_SUCCESS",
      ...details,
      dryRun: this.options?.dryRun
    });

    this.execWhenEnabled(() => {
      this.depositsTotal.add(details.items.length);
      details.items.forEach(({ input }) => {
        this.depositAmount.record(input.amount);
      });
    });
  }

  recordChainTxError({
    error,
    ...errorDetails
  }: {
    owner: string;
    items: {
      deployment: DrainingDeployment;
      input: DepositDeploymentMsgOptions;
    }[];
    error: unknown;
  }): void {
    this.topUpSummarizer.trackFailedWallet(errorDetails.owner);
    this.topUpSummarizer.inc("deploymentTopUpErrorCount", errorDetails.items.length);

    this.logger.error({
      event: "TOP_UP_DEPLOYMENTS_ERROR",
      ...errorDetails,
      ...this.serializeError(error),
      dryRun: this.options?.dryRun
    });

    this.execWhenEnabled(() => {
      this.chainTxErrors.add(1);
    });
  }

  recordHeadroomConceded(details: {
    dseq: string;
    address: string;
    desiredAmount: number;
    flooredAmount: number;
    affordableAmount: number;
    runwayMinutes: number;
  }): void {
    this.topUpSummarizer.inc("headroomConcessionCount");
    this.logger.warn({ event: "AUTO_TOP_UP_HEADROOM_CONCEDED", ...details, dryRun: this.options?.dryRun });

    this.execWhenEnabled(() => {
      this.headroomConcessions.add(1);
    });
  }

  recordMessagePreparationError({ error, ...errorDetails }: { deployment: DrainingDeployment; error: unknown }): void {
    const serialized = this.serializeError(error);
    const isInsufficientBalance = serialized.message.startsWith("Insufficient balance");
    const log = {
      event: "MESSAGE_PREPARATION_ERROR",
      ...errorDetails,
      ...serialized,
      dryRun: this.options?.dryRun
    };

    if (isInsufficientBalance) {
      this.topUpSummarizer.inc("insufficientBalanceCount");
      this.logger.warn(log);

      this.execWhenEnabled(() => {
        this.messagePreparationErrors.add(1, { error_type: "insufficient_balance" });

        if (errorDetails.deployment.isWalletAutoTopUpEnabled) {
          this.insufficientBalanceWithAutoReload.add(1);
        }
      });
    } else {
      this.topUpSummarizer.inc("deploymentTopUpErrorCount");
      this.topUpSummarizer.trackFailedWallet(errorDetails.deployment.address);
      this.logger.error(log);

      this.execWhenEnabled(() => {
        this.messagePreparationErrors.add(1, { error_type: "unknown" });
      });
    }
  }

  recordOwnerInsufficientBalance({ owner, spendable, deployments }: { owner: string; spendable: number; deployments: OwnerInsufficientBalanceItem[] }): void {
    this.topUpSummarizer.inc("insufficientBalanceCount", deployments.length);

    this.logger.warn({
      event: "TOP_UP_OWNER_INSUFFICIENT_BALANCE",
      owner,
      spendable,
      deploymentCount: deployments.length,
      deployments: deployments.map(({ deployment, desiredAmount }) => ({ dseq: deployment.dseq, desiredAmount })),
      dryRun: this.options?.dryRun
    });

    this.execWhenEnabled(() => {
      this.messagePreparationErrors.add(deployments.length, { error_type: "insufficient_balance" });

      const withAutoReloadCount = deployments.filter(({ deployment }) => deployment.isWalletAutoTopUpEnabled).length;

      if (withAutoReloadCount > 0) {
        this.insufficientBalanceWithAutoReload.add(withAutoReloadCount);
      }
    });
  }

  recordDepositBelowUsefulRunway(details: { dseq: string; address: string; desiredAmount: number; affordableAmount: number; runwayMinutes: number }): void {
    this.topUpSummarizer.inc("depositsBelowUsefulRunwayCount");

    this.logger.warn({
      event: "DEPOSIT_BELOW_USEFUL_RUNWAY",
      ...details,
      dryRun: this.options?.dryRun
    });

    this.execWhenEnabled(() => {
      this.depositsBelowUsefulRunway.add(1);
    });
  }

  recordDeploymentsMarkedClosed(count: number): void {
    this.topUpSummarizer.inc("deploymentsMarkedClosedCount", count);

    this.execWhenEnabled(() => {
      this.deploymentsMarkedClosed.add(count);
    });
  }

  /** Logged at debug because a churning owner produces one per pass, while the counter is what says whether the number is falling. */
  recordSettingWithoutChainState({ dseq, address }: { dseq: string; address: string }): void {
    this.execWhenEnabled(() => {
      this.settingsWithoutChainState.add(1);
    });

    this.logger.debug({ event: "TOP_UP_SETTING_WITHOUT_CHAIN_STATE", dseq, address, dryRun: this.options?.dryRun });
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

    this.logger.warn({
      event: "TOP_UP_DEPLOYMENT_CLOSED_ON_CHAIN",
      owner,
      dseq: deployment.dseq,
      address: deployment.address,
      messageIndex,
      ...this.serializeError(error),
      dryRun: this.options?.dryRun
    });
  }

  /** The count stays uncredited so the summary never reports a row as closed that the database still has open. */
  recordDeploymentCloseMarkFailed({ owner, deployment, error }: { owner: string; deployment: DrainingDeployment; error: unknown }): void {
    this.logger.warn({
      event: "TOP_UP_DEPLOYMENT_CLOSE_MARK_FAILED",
      owner,
      dseq: deployment.dseq,
      address: deployment.address,
      ...this.serializeError(error),
      dryRun: this.options?.dryRun
    });
  }

  recordClosedDeploymentRetryLimit({ owner, remainingCount }: { owner: string; remainingCount: number }): void {
    this.logger.warn({
      event: "TOP_UP_CLOSED_DEPLOYMENT_RETRY_LIMIT",
      owner,
      remainingCount,
      dryRun: this.options?.dryRun
    });
  }

  recordDeploymentPreparation(ownerAddress: string, predictedClosedHeight: number): void {
    this.topUpSummarizer.inc("deploymentCount");
    this.topUpSummarizer.trackWallet(ownerAddress);
    this.topUpSummarizer.ensurePredictedClosedHeight(predictedClosedHeight);

    this.execWhenEnabled(() => {
      this.deploymentsScanned.add(1);
    });

    const startHeight = this.topUpSummarizer.get("startBlockHeight");

    if (startHeight === undefined) {
      return;
    }

    const blocksUntilClose = predictedClosedHeight - startHeight;
    if (blocksUntilClose > 0) {
      this.execWhenEnabled(() => {
        this.predictedCloseBlocks.record(blocksUntilClose);
      });
    }
  }

  recordSkipped(details: { owner: string; deploymentCount: number }) {
    this.logger.info({
      event: "TOP_UP_SKIPPED_NOTHING_TO_TOP_UP",
      ...details,
      dryRun: this.options?.dryRun
    });
  }

  recordInvalidDepositAmount(details: { desiredAmount: number; dseq: string; address: string; blockRate: number }) {
    this.logger.warn({
      event: "TOP_UP_AMOUNT_NON_POSITIVE",
      ...details
    });
  }

  recordRuntimeLimitReached(details: { dseq: string; address: string; runtimeEndsAt: Date }) {
    this.logger.info({
      event: "TOP_UP_RUNTIME_LIMIT_REACHED",
      ...details
    });
  }

  recordMasterWalletInsufficientFundsError({
    error,
    ...details
  }: {
    owner: string;
    items: {
      deployment: DrainingDeployment;
      input: DepositDeploymentMsgOptions;
    }[];
    error: unknown;
  }) {
    this.logger.error({
      event: "MASTER_WALLET_INSUFFICIENT_FUNDS",
      ...details,
      ...this.serializeError(error),
      dryRun: this.options?.dryRun
    });
  }

  recordClaimReleaseError({ error, ...details }: { owner: string; deploymentIds: string[]; error: unknown }): void {
    this.logger.error({
      event: "TOP_UP_CLAIM_RELEASE_ERROR",
      ...details,
      ...this.serializeError(error),
      dryRun: this.options?.dryRun
    });
  }

  recordCreditsLowScheduleError({ error, ...details }: { walletId?: number; error: unknown }): void {
    this.logger.error({
      event: "CREDITS_LOW_SCHEDULE_SWEEP_ERROR",
      ...details,
      ...this.serializeError(error),
      dryRun: this.options?.dryRun
    });
  }

  private serializeError(error: unknown): { message: string; stack?: string; data?: unknown } {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        data: "data" in error ? (error as Record<string, unknown>).data : undefined
      };
    }

    return { message: String(error) };
  }

  private execWhenEnabled(fn: () => void): void {
    if (!this.options?.dryRun) {
      fn();
    }
  }
}
