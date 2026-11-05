import { useEffect, useRef } from "react";

import type { DeploymentFlow } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { useDeploymentOutcomes } from "@src/hooks/useDeploymentOutcomes/useDeploymentOutcomes";
import type { KnownDeploymentOutcome } from "@src/store/deploymentOutcomeStore";
import { deployFlowOutcomeOf } from "../deploymentOutcome/deploymentOutcome";

export const DEPENDENCIES = { useDeploymentOutcomes };

/** Records how the browser deploy flow ended for the deployment page to ask about, and returns a failure to ask about right here. */
export function useDeployFlowOutcome(
  flow: DeploymentFlow,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): (KnownDeploymentOutcome & { dseq: string }) | undefined {
  const { recordOutcome } = dependencies.useDeploymentOutcomes();
  const lastDseqRef = useRef<string | null>(null);
  if (flow.dseq) lastDseqRef.current = flow.dseq;
  else if (flow.phase === "configuring" || flow.phase === "creating") lastDseqRef.current = null;

  const outcome = deployFlowOutcomeOf(flow, lastDseqRef.current);

  useEffect(
    function recordFlowOutcome() {
      if (outcome) recordOutcome(outcome.dseq, { outcome: outcome.outcome, failureReason: outcome.failureReason });
    },
    [outcome?.dseq, outcome?.outcome, outcome?.failureReason, recordOutcome]
  );

  return outcome?.outcome === "failed" ? { dseq: outcome.dseq, outcome: "failed", failureReason: outcome.failureReason } : undefined;
}
