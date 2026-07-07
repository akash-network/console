"use client";
import type { FC } from "react";

import { PhasedDeployProgressScene } from "@src/components/deployments/ConfigureDeployment/DeployProgressOverlay/PhasedDeployProgressScene";
import { type ManualDeployActivePhase, usePhasedDeployProgress } from "@src/hooks/usePhasedDeploymentFlow/deployPhases";

export const DEPENDENCIES = { PhasedDeployProgressScene, usePhasedDeployProgress };

interface Props {
  /** Provider chosen for the deployment; the globe narrows to and focuses on it. */
  providerAddress?: string | null;
  /** The deploy's current active step, from `useDeploymentFlow`: the lease ("preparing"), then "success" once it lands. */
  activePhase?: ManualDeployActivePhase;
  /** The deployment's chosen name, shown in the progress title; falls back to a generic label when blank. */
  deploymentName?: string;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Full-screen overlay shown during the manual configure flow's `deploying` phase: the shared deploy-progress
 * scene (creating + matching pre-completed, since the deployment already exists and the provider is chosen) over
 * the provider globe. The "choose my provider" CTA is intentionally omitted — the provider was already selected.
 * Deploy failures unmount this (the flow returns to quoting) and surface a toast, so no error panel is rendered
 * here; a `"success"` active phase completes the panel and is held briefly before the flow redirects.
 */
export const DeployProgressOverlay: FC<Props> = ({ providerAddress, activePhase = "preparing", deploymentName, dependencies: d = DEPENDENCIES }) => {
  const { state, progressPercent, phases } = d.usePhasedDeployProgress(activePhase);
  return (
    <d.PhasedDeployProgressScene
      className="absolute inset-0 z-20 overflow-hidden bg-white dark:bg-background"
      templateName={deploymentName?.trim() || "your deployment"}
      state={state}
      progressPercent={progressPercent}
      phases={phases}
      focusedProviderAddress={providerAddress}
    />
  );
};
