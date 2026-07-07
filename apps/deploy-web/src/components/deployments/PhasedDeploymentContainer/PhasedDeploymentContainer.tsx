"use client";

import { usePhasedDeploymentFlow } from "@src/hooks/usePhasedDeploymentFlow/usePhasedDeploymentFlow";
import { PhasedDeployProgressScene } from "../ConfigureDeployment/DeployProgressOverlay/PhasedDeployProgressScene";

const DEFAULT_DEPOSIT_USD = 0.5;

export const DEPENDENCIES = {
  usePhasedDeploymentFlow,
  PhasedDeployProgressScene
};

type PhasedDeploymentContainerProps = {
  templateName: string;
  sdl: string;
  deposit?: number;
  isWalletReady: boolean;
  trialError?: unknown;
  /** A dseq carried in from the URL on a resumed session; the flow skips creating and resumes from matching/preparing. */
  initialDseq?: string;
  /** Notified once the deployment exists on chain so the caller can write its dseq into the URL for resumability. */
  onDeploymentCreated?: (dseq: string) => void;
  onSuccess?: (dseq: string) => void;
  onCancel?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The onboarding-driven auto deploy: orchestrates create → match → lease via {@link usePhasedDeploymentFlow} and
 * renders the shared {@link PhasedDeployProgressScene} (progress panel over the provider globe), which the manual
 * configure deploy also uses.
 */
export function PhasedDeploymentContainer({
  templateName,
  sdl,
  deposit = DEFAULT_DEPOSIT_USD,
  isWalletReady,
  trialError,
  initialDseq,
  onDeploymentCreated,
  onSuccess,
  onCancel,
  dependencies: d = DEPENDENCIES
}: PhasedDeploymentContainerProps) {
  const { state, progressPercent, phases, matchedProviderAddress, startOver } = d.usePhasedDeploymentFlow({
    sdl,
    deposit,
    isWalletReady,
    trialError,
    initialDseq,
    onDeploymentCreated,
    onSuccess: dseq => onSuccess?.(dseq)
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
