"use client";
import type { FC } from "react";

import { useUpdateDeploymentSettingMutation } from "@src/queries/deploymentSettingsQuery";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";

export const DEPENDENCIES = { useUpdateDeploymentSettingMutation, ActionCardChrome };

export const RemoveRuntimeLimitCard: FC<ActionCardProps<"remove_runtime_limit"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { mutateAsync: updateSetting } = d.useUpdateDeploymentSettingMutation({ dseq: action.dseq });

  return (
    <d.ActionCardChrome
      title="Switch to always on"
      scope={`dseq ${action.dseq}`}
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
