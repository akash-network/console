"use client";
import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";

import { PhasedDeploymentProgress } from "@src/components/deployments/PhasedDeploymentProgress/PhasedDeploymentProgress";
import type { DeployPhase, DeployProgressState } from "@src/hooks/usePhasedDeploymentFlow/deployPhases";
import { ProviderGlobe } from "./ProviderGlobe";

export const DEPENDENCIES = { PhasedDeploymentProgress, ProviderGlobe };

interface Props {
  templateName: string;
  state: DeployProgressState;
  progressPercent: number;
  phases: [DeployPhase, DeployPhase, DeployPhase];
  /** Provider the globe narrows to and focuses on; all online providers show while none is set. */
  focusedProviderAddress?: string | null;
  /** Extra classes for the outer wrapper — e.g. the manual flow renders this as a full-screen absolute overlay. */
  className?: string;
  onStartOver?: () => void;
  onContactSupport?: () => void;
  onChooseProvider?: () => void;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * The shared deploy-progress surface: the phased progress panel over the provider globe. Both the
 * onboarding-driven auto flow ({@link PhasedDeploymentContainer}) and the manual configure deploy render this,
 * differing only in how they derive the progress state and how they position the wrapper.
 */
export const PhasedDeployProgressScene: FC<Props> = ({
  templateName,
  state,
  progressPercent,
  phases,
  focusedProviderAddress,
  className,
  onStartOver,
  onContactSupport,
  onChooseProvider,
  dependencies: d = DEPENDENCIES
}) => (
  <div className={cn("flex flex-1 flex-col items-center", className)}>
    <div className="w-[632px] max-w-full px-[20px] pt-[80px]">
      <d.PhasedDeploymentProgress
        state={state}
        templateName={templateName}
        progressPercent={progressPercent}
        phases={phases}
        onStartOver={onStartOver}
        onContactSupport={onContactSupport}
        onChooseProvider={onChooseProvider}
      />
    </div>
    <d.ProviderGlobe focusedProviderAddress={focusedProviderAddress} />
  </div>
);
