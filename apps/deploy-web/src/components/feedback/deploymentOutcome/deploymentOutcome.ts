import type { DeploymentFlow } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import type { DeploymentLaunch } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import type { KnownDeploymentOutcome, RecordedDeploymentOutcome } from "@src/store/deploymentOutcomeStore";
import type { LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { averageBlockTime } from "@src/utils/priceUtils";

const BLOCKS_IN_AN_HOUR = Math.round(3600 / averageBlockTime);

export const NO_BIDS_REASON = "No bids arrived in the bid window";
export const ATTEMPT_ABANDONED_REASON = "The deploy attempt was abandoned";
export const LAUNCH_FAILED_REASON = "The lease never started";
export const LEASE_CLOSED_EARLY_REASON = "The lease closed within its first hour";

export type DeployFlowOutcome = Omit<RecordedDeploymentOutcome, "isPrompted"> & { dseq: string };

type FlowSnapshot = Pick<DeploymentFlow, "phase" | "dseq" | "autoLeasedDseq" | "deploySucceeded" | "isDeployedInBackground" | "noBidsReceived" | "error">;

/** Only an end the flow can't recover from is a failure; `lastDseq` names the deployment an abandoned attempt closed. */
export function deployFlowOutcomeOf(flow: FlowSnapshot, lastDseq: string | null): DeployFlowOutcome | undefined {
  if (flow.autoLeasedDseq) return { dseq: flow.autoLeasedDseq, outcome: "unknown" };
  if (!flow.dseq) return flow.phase === "error" && lastDseq ? failedOutcome(lastDseq, flow.error?.message ?? ATTEMPT_ABANDONED_REASON) : undefined;
  if (flow.deploySucceeded) return { dseq: flow.dseq, outcome: flow.isDeployedInBackground ? "unknown" : "live" };
  if (flow.noBidsReceived) return failedOutcome(flow.dseq, NO_BIDS_REASON);
  if (flow.phase === "error") return failedOutcome(flow.dseq, flow.error?.message ?? ATTEMPT_ABANDONED_REASON);

  return undefined;
}

function failedOutcome(dseq: string, failureReason: string): DeployFlowOutcome {
  return { dseq, outcome: "failed", failureReason };
}

export function observedDeploymentOutcomeOf(input: {
  createdHeight: number;
  leases: Pick<LeaseDto, "state" | "closedOn">[];
  launch: DeploymentLaunch | null | undefined;
}): KnownDeploymentOutcome | undefined {
  if (input.launch?.phase === "failed") return { outcome: "failed", failureReason: input.launch.reason ?? LAUNCH_FAILED_REASON };
  if (input.leases.some(lease => isClosedWithinFirstHour(lease, input.createdHeight))) return { outcome: "failed", failureReason: LEASE_CLOSED_EARLY_REASON };
  if (input.leases.some(isLeaseLive)) return { outcome: "live" };

  return undefined;
}

function isClosedWithinFirstHour(lease: Pick<LeaseDto, "state" | "closedOn">, createdHeight: number) {
  const closedHeight = Number(lease.closedOn);

  return !isLeaseLive(lease) && closedHeight > 0 && closedHeight - createdHeight <= BLOCKS_IN_AN_HOUR;
}

/** Only a deploy this tab started is asked about, and a failure seen on the page wins over a success the deploy flow recorded before it. */
export function promptableOutcomeOf(
  recorded: RecordedDeploymentOutcome | undefined,
  observed: KnownDeploymentOutcome | undefined
): KnownDeploymentOutcome | undefined {
  if (!recorded || recorded.isPrompted) return undefined;
  if (observed?.outcome === "failed") return observed;
  if (recorded.outcome !== "unknown") return { outcome: recorded.outcome, failureReason: recorded.failureReason };

  return observed;
}
