"use client";

import { usePhasedDeploymentFlow } from "@src/hooks/usePhasedDeploymentFlow/usePhasedDeploymentFlow";
import { PhasedDeployProgressScene } from "../ConfigureDeployment/DeployProgressOverlay/PhasedDeployProgressScene";

export const DEPENDENCIES = {
  usePhasedDeploymentFlow,
  PhasedDeployProgressScene
};

type PhasedDeploymentContainerProps = {
  templateName: string;
  sdl: string;
  isWalletReady: boolean;
  trialError?: unknown;
  /** A dseq carried in from the URL on a resumed session; the flow skips creating and resumes from matching/preparing. */
  initialDseq?: string;
  /** The template the flow deploys, mirrored into the deployment intent so URL resume preserves it. */
  templateId?: string;
  /** The active configure draft id, mirrored into the deployment intent so a reload resolves the same session. */
  draftId?: string;
  onCancel?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The onboarding-driven auto deploy: drives {@link usePhasedDeploymentFlow} (an autopilot over the shared
 * `useDeploymentFlow` state machine) and renders the shared {@link PhasedDeployProgressScene} (progress panel over
 * the provider globe), which the manual configure deploy also uses. Creation, URL resume, and the deploy-success
 * redirect are all owned by the underlying flow — this container only wires cancel back to manual configuration.
 */
export function PhasedDeploymentContainer({
  templateName,
  sdl,
  isWalletReady,
  trialError,
  initialDseq,
  templateId,
  draftId,
  onCancel,
  dependencies: d = DEPENDENCIES
}: PhasedDeploymentContainerProps) {
  const { state, progressPercent, phases, matchedProviderAddress, startOver } = d.usePhasedDeploymentFlow({
    sdl,
    isWalletReady,
    trialError,
    initialDseq,
    templateId,
    draftId
  });

  return (
    <d.PhasedDeployProgressScene
      templateName={templateName}
      state={state}
      progressPercent={progressPercent}
      phases={phases}
      focusedProviderAddress={matchedProviderAddress}
      onStartOver={() => {
        startOver();
        onCancel?.();
      }}
      onContactSupport={() => {
        window.open("https://akash.network/discord", "_blank", "noopener,noreferrer");
      }}
    />
  );
}
