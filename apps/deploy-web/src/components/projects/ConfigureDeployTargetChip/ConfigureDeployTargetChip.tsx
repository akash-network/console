"use client";
import { DeployTargetChip } from "../DeployTargetChip/DeployTargetChip";
import { useConfigureDeployTarget } from "../DeployTargetGate/DeployTargetGate";

export const DEPENDENCIES = { useConfigureDeployTarget, DeployTargetChip };

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

/** The project the deployment being configured goes to, changeable until it is created; the gate asks for a missing one. */
export function ConfigureDeployTargetChip({ dependencies: d = DEPENDENCIES }: Props) {
  const target = d.useConfigureDeployTarget();

  if (!target.project || target.isFiled) return null;

  return (
    <div className="px-4 sm:px-6">
      <d.DeployTargetChip target={{ ...target, isMissing: false }} onChoose={target.chooseProject} />
    </div>
  );
}
