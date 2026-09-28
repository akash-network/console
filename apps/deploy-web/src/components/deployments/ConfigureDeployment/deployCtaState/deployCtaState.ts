import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";

export type DeployCtaState = "request-quotes" | "requesting" | "select-providers" | "deploy" | "retry" | "close-and-edit";

export interface DeployCtaInput {
  phase: DeploymentFlowPhase;
  allPlacementsHaveBids: boolean;
  allPlacementsSelected: boolean;
  hasDeployError: boolean;
  quotesExpired: boolean;
  /** The bid timer is only indicative, so close and edit waits until no placement has an open bid left. */
  hasOpenBids: boolean;
}

export function deployCtaState(input: DeployCtaInput): DeployCtaState {
  if (input.phase === "configuring" || input.phase === "error") return "request-quotes";
  if (input.quotesExpired && !input.hasOpenBids) return "close-and-edit";
  if (input.phase !== "quoting" || !input.allPlacementsHaveBids) return "requesting";
  if (!input.allPlacementsSelected) return "select-providers";
  return input.hasDeployError ? "retry" : "deploy";
}
