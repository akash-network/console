"use client";
import type { FC, ReactNode } from "react";

import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { useDeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = { useEnsureTrialStarted, useDeploymentFlow };

/** The shared flow state machine plus the trial-readiness handles both configure branches need. */
export type DeploymentFlowContext = {
  flow: DeploymentFlow;
  /** Whether the trial wallet can broadcast — gates the create so requesting quotes waits for the trial to provision. */
  isWalletReady: boolean;
  /** A terminal start-trial failure, surfaced so a held create fails instead of waiting forever. */
  trialError: unknown;
  /** Clears a terminal start-trial failure so a deploy retry can re-attempt it. */
  retryTrial: () => void;
};

interface Props {
  /** The resolved configure intent whose dseq (already settled by the `ResumeDeploymentGuard`) seeds the flow. */
  intent: DeploymentIntent;
  children: (context: DeploymentFlowContext) => ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Owns the single base deployment flow (and trial readiness) for the configure screen, so the auto and manual branches
 * share one state machine instead of each mounting their own. Rendered below the `ResumeDeploymentGuard`: the flow
 * seeds its initial phase/dseq from `intent.dseq` at mount, so it must only be created once the guard has settled that
 * dseq (stripped a dead one on 404, kept an open one on resume) — creating it above the guard would pin the flow to a
 * dseq the guard may still discard. Keyed by the draft id upstream, so switching drafts remounts it (a fresh flow),
 * while an auto→manual switch within the same draft keeps the instance so the in-progress deployment is handed off
 * rather than abandoned.
 */
export const DeploymentFlowProvider: FC<Props> = ({ intent, children, dependencies: d = DEPENDENCIES }) => {
  const { isWalletReady, error: trialError, retryTrial } = d.useEnsureTrialStarted();
  const flow = d.useDeploymentFlow({ intent, isWalletReady, trialError });
  return <>{children({ flow, isWalletReady, trialError, retryTrial })}</>;
};
