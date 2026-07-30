"use client";
import type { FC, ReactNode } from "react";

import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { useDeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = { useDeploymentFlow };

/** The shared flow state machine both configure branches need. */
export type DeploymentFlowContext = {
  flow: DeploymentFlow;
};

interface Props {
  /** The resolved configure intent whose dseq (already settled by the `ResumeDeploymentGuard`) seeds the flow. */
  intent: DeploymentIntent;
  children: (context: DeploymentFlowContext) => ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Owns the single base deployment flow for the configure screen, so the auto and manual branches
 * share one state machine instead of each mounting their own. Rendered below the `ResumeDeploymentGuard`: the flow
 * seeds its initial phase/dseq from `intent.dseq` at mount, so it must only be created once the guard has settled that
 * dseq (stripped a dead one on 404, kept an open one on resume) — creating it above the guard would pin the flow to a
 * dseq the guard may still discard. Keyed by the draft id upstream, so switching drafts remounts it (a fresh flow),
 * while an auto→manual switch within the same draft keeps the instance so the in-progress deployment is handed off
 * rather than abandoned.
 */
export const DeploymentFlowProvider: FC<Props> = ({ intent, children, dependencies: d = DEPENDENCIES }) => {
  const flow = d.useDeploymentFlow({ intent });
  return <>{children({ flow })}</>;
};
