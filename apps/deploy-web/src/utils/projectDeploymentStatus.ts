import { isLeaseLive } from "@akashnetwork/http-sdk";

import type { ProjectDeploymentStatus } from "@src/types/project";
import { isReclaiming } from "@src/utils/reclamationUtils";

const OVERDRAWN_ESCROW_STATE = "overdrawn";

/** The fields of a `listDeployments` item the status reads: the chain states of the deployment, its leases and its escrow. */
export interface ListedDeploymentStates {
  deployment: { state: string };
  leases: { state: string }[];
  escrow_account?: { state: { state: string } };
}

/** Folds a listed deployment into the five states a folder sheet knows. */
export function toProjectDeploymentStatus(item: ListedDeploymentStates): ProjectDeploymentStatus {
  if (item.deployment.state !== "active") return "closed";
  if (item.leases.some(isReclaiming)) return "reclaiming";
  if (item.leases.length === 0) return "spinning";
  if (!item.leases.some(isLeaseLive) || item.escrow_account?.state.state === OVERDRAWN_ESCROW_STATE) return "degraded";
  return "running";
}
