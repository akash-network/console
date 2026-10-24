"use client";
import type { FC, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useWarnBeforeUnload } from "@src/hooks/useWarnBeforeUnload/useWarnBeforeUnload";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { useDeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = { useDeploymentFlow, useWarnBeforeUnload, useSnackbar, Snackbar };

/** The shared flow state machine both configure branches need. */
export type DeploymentFlowContext = {
  flow: DeploymentFlow;
};

export type DeploymentLeaveGuard = {
  isCreating: boolean;
  /** An open deployment no lease holds yet keeps its deposit locked once the page is gone, so leaving has to discard it first. */
  holdsUnleasedDeployment: boolean;
  /** A lease already sent may still land once the page is gone, so leaving keeps the deployment instead of discarding it. */
  isLeaseInFlight: boolean;
  discard: () => void;
};

interface Props {
  /** The resolved configure intent whose dseq (already settled by the `ResumeDeploymentGuard`) seeds the flow. */
  intent: DeploymentIntent;
  children: (context: DeploymentFlowContext) => ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

const NOTHING_TO_GUARD: DeploymentLeaveGuard = { isCreating: false, holdsUnleasedDeployment: false, isLeaseInFlight: false, discard: () => {} };

const DeploymentLeaveGuardContext = createContext<DeploymentLeaveGuard>(NOTHING_TO_GUARD);

/** A create's response only reaches the page that sent it, so chrome that navigates away (the onboarding skip, Back) steps aside until it lands, unless the api finishes it in the background. */
export function useIsDeploymentCreating(): boolean {
  return useContext(DeploymentLeaveGuardContext).isCreating;
}

export function useDeploymentLeaveGuard(): DeploymentLeaveGuard {
  return useContext(DeploymentLeaveGuardContext);
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
  const isCreating = flow.phase === "creating" && !flow.isCreatingInBackground;
  const { isLeaseInFlight } = flow;
  const holdsUnleasedDeployment = isAwaitingLease(flow) && !flow.isCreatingInBackground && !isLeaseInFlight;
  const { discard } = flow.actions;
  d.useWarnBeforeUnload(isCreating);
  const leaveGuard = useMemo(
    () => ({ isCreating, holdsUnleasedDeployment, isLeaseInFlight, discard }),
    [isCreating, holdsUnleasedDeployment, isLeaseInFlight, discard]
  );
  const { enqueueSnackbar } = d.useSnackbar();

  useEffect(
    function announceDeployFinishingInBackground() {
      if (!flow.isDeployedInBackground) return;
      enqueueSnackbar(<d.Snackbar title="Deployment created" subTitle="It's spinning up. We'll let you know when it's ready." iconVariant="success" />, {
        variant: "success"
      });
    },
    [flow.isDeployedInBackground, enqueueSnackbar, d]
  );

  return <DeploymentLeaveGuardContext.Provider value={leaveGuard}>{children({ flow })}</DeploymentLeaveGuardContext.Provider>;
};

/** The auto flow's no-providers error keeps its deployment open, and a close that failed leaves one open in any phase. */
function isAwaitingLease({ phase, deploySucceeded, dseq, pendingClose }: DeploymentFlow): boolean {
  return phase === "quoting" || (phase === "deploying" && !deploySucceeded) || (phase === "error" && !!dseq) || !!pendingClose?.failed;
}
