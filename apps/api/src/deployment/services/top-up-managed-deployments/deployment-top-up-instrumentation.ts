import type { DepositDeploymentMsgOptions } from "@src/billing/services";
import type { DrainingDeployment } from "@src/deployment/types/draining-deployment";

export type FundingMessageItem = { deployment: DrainingDeployment; input: DepositDeploymentMsgOptions };

/**
 * Telemetry sink shared by the two deployment top-up paths: the hourly cron and the event-driven
 * immediate funding that runs when credits land. The cron's summarizer-backed instrumentation and the
 * stateless per-job instrumentation each implement this, so the shared funding mechanics can report to
 * whichever instrumentation owns the current run without knowing which meter it feeds.
 */
export interface DeploymentTopUpInstrumentation {
  recordDeploymentPreparation(ownerAddress: string, predictedClosedHeight: number): void;
  recordInvalidDepositAmount(details: { desiredAmount: number; dseq: string; address: string; blockRate: number }): void;
  recordRuntimeLimitReached(details: { dseq: string; address: string; runtimeEndsAt: Date }): void;
  recordDepositBelowUsefulRunway(details: { dseq: string; address: string; desiredAmount: number; affordableAmount: number; runwayMinutes: number }): void;
  recordMessagePreparationError(details: { deployment: DrainingDeployment; error: unknown }): void;
  recordSkipped(details: { owner: string; deploymentCount: number }): void;
  recordDeposit(details: { owner: string; items: FundingMessageItem[] }): void;
  recordChainTxError(details: { owner: string; items: FundingMessageItem[]; error: unknown }): void;
  recordMasterWalletInsufficientFundsError(details: { owner: string; items: FundingMessageItem[]; error: unknown }): void;
  recordClaimReleaseError(details: { owner: string; deploymentIds: string[]; error: unknown }): void;
  recordDeploymentsMarkedClosed(count: number): void;
}
