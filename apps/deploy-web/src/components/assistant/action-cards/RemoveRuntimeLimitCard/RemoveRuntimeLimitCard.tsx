"use client";
import type { FC } from "react";

import { useUpdateDeploymentSettingMutation } from "@src/queries/deploymentSettingsQuery";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import { useDeploymentName } from "../useDeploymentName/useDeploymentName";

export const DEPENDENCIES = { useUpdateDeploymentSettingMutation, useDeploymentName, ActionCardChrome };

export const RemoveRuntimeLimitCard: FC<ActionCardProps<"remove_runtime_limit"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { mutateAsync: updateSetting } = d.useUpdateDeploymentSettingMutation({ dseq: action.dseq });
  const deploymentName = d.useDeploymentName(action.dseq);

  return (
    <d.ActionCardChrome
      title="Switch to always on"
      scope={<DeploymentLink dseq={action.dseq} name={deploymentName} />}
      tier={action.tier}
      decision={decision}
      diff={{ removed: [`Closes after ${action.currentLimitHours}h`], added: ["Runs until you close it"] }}
      costNote="The deployment keeps topping up from your credits until you close it."
      irreversibleNote="You can't switch back to a fixed runtime."
      confirmLabel="Switch to always on"
      successMessage="The deployment now runs until you close it."
      onConfirm={async () => {
        await updateSetting({ runtimeLimitHours: null });
      }}
    />
  );
};
