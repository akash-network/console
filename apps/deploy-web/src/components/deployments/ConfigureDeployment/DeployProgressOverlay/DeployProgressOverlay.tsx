import type { FC } from "react";

import { PhasedDeploymentProgress } from "@src/components/deployments/PhasedDeploymentProgress/PhasedDeploymentProgress";
import { ProvidersGlobe } from "./ProvidersGlobe";
import { type DeployActivePhase, useConfigureDeployProgress } from "./useConfigureDeployProgress";

export const DEPENDENCIES = { PhasedDeploymentProgress, ProvidersGlobe, useConfigureDeployProgress };

interface Props {
  /** Provider chosen for the deployment; the globe narrows to and focuses on it. */
  providerAddress?: string | null;
  /** The deploy's current active step, from `useDeploymentFlow`: the lease ("preparing"), then "success" once it lands. */
  activePhase?: DeployActivePhase;
  /** The user's deployment name, shown in the title; falls back to "your deployment" when unset. */
  deploymentName?: string;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Full-screen overlay shown during the `deploying` phase: the reused CON-315 progress panel (creating +
 * matching pre-completed, since the deployment already exists and the provider is chosen) over the provider
 * globe. The "choose my provider" CTA is intentionally omitted — the provider was already selected here.
 * Deploy failures unmount this overlay (the flow returns to quoting) and surface a toast, so no error panel
 * is rendered here; a `"success"` active phase completes the panel and is held briefly before the flow redirects.
 */
export const DeployProgressOverlay: FC<Props> = ({ providerAddress, activePhase = "preparing", deploymentName, dependencies: d = DEPENDENCIES }) => {
  const { state, progressPercent, phases } = d.useConfigureDeployProgress(activePhase);
  const title = deploymentName?.trim() || "your deployment";
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center overflow-hidden bg-white dark:bg-background">
      <div className="w-[632px] max-w-full px-[20px] pt-[80px]">
        <d.PhasedDeploymentProgress state={state} templateName={title} progressPercent={progressPercent} phases={phases} />
      </div>
      <d.ProvidersGlobe focusedProviderAddress={providerAddress} />
    </div>
  );
};
