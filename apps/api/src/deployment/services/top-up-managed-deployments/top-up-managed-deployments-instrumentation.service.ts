import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { Lifecycle, scoped } from "tsyringe";

import { DepositDeploymentMsgOptions } from "@src/billing/services";
import { LoggerService, MetricsService } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { TopUpSummarizer } from "@src/deployment/lib/top-up-summarizer/top-up-summarizer";
import { DrainingDeployment } from "@src/deployment/types/draining-deployment";

@scoped(Lifecycle.ResolutionScoped)
export class TopUpManagedDeploymentsInstrumentationService {
  private readonly USER_SIDE_ERROR_PATTERNS = ["insufficient balance", "deployment closed", "deposit invalid"];

  private readonly meter: Meter;
  private readonly jobExecutions: Counter;
  private readonly jobDuration: Histogram;
  private readonly depositsTotal: Counter;
  private readonly chainTxErrors: Counter;
  private readonly messagePreparationErrors: Counter;
  private readonly deploymentsMarkedClosed: Counter;
  private readonly depositAmount: Histogram;
  private readonly predictedCloseBlocks: Histogram;
  private readonly insufficientBalanceWithAutoReload: Counter;
  private readonly settingToggles: Counter;
  private startTime: number | undefined;
  private options: DryRunOptions | undefined;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly topUpSummarizer: TopUpSummarizer,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(TopUpManagedDeploymentsInstrumentationService.name);

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

    this.settingToggles = this.metricsService.createCounter(this.meter, "auto_top_up_setting_toggles_total", {
      description: "Total number of auto top-up setting enable/disable toggles"
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
    const serialized = this.serializeError(error);
    const isUserSideError = this.isUserSideError(serialized.message);
    const log = {
      event: "TOP_UP_DEPLOYMENTS_ERROR",
      ...errorDetails,
      ...serialized,
      dryRun: this.options?.dryRun
    };

    if (isUserSideError) {
      this.topUpSummarizer.inc("userSideErrorCount", errorDetails.items.length);
      this.logger.warn(log);
    } else {
      this.topUpSummarizer.trackFailedWallet(errorDetails.owner);
      this.topUpSummarizer.inc("deploymentTopUpErrorCount", errorDetails.items.length);
      this.logger.error(log);
    }

    this.execWhenEnabled(() => {
      this.chainTxErrors.add(1, { error_type: isUserSideError ? "user_side" : "system" });
    });
  }

  private isUserSideError(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return this.USER_SIDE_ERROR_PATTERNS.some(pattern => lowerMessage.includes(pattern));
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

  recordDeploymentsMarkedClosed(count: number): void {
    this.topUpSummarizer.inc("deploymentsMarkedClosedCount", count);

    this.execWhenEnabled(() => {
      this.deploymentsMarkedClosed.add(count);
    });
  }

  recordDeploymentPreparation(ownerAddress: string, predictedClosedHeight: number): void {
    this.topUpSummarizer.inc("deploymentCount");
    this.topUpSummarizer.trackWallet(ownerAddress);
    this.topUpSummarizer.ensurePredictedClosedHeight(predictedClosedHeight);

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

  recordSettingToggle(enabled: boolean): void {
    this.execWhenEnabled(() => {
      this.settingToggles.add(1, { enabled: String(enabled) });
    });
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
