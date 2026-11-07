"use client";
import type { FC } from "react";

import { useRenameDeployment } from "@src/hooks/useRenameDeployment/useRenameDeployment";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import { useDeploymentName } from "../useDeploymentName/useDeploymentName";

export const DEPENDENCIES = { useRenameDeployment, useDeploymentName, ActionCardChrome };

export const RenameDeploymentCard: FC<ActionCardProps<"rename_deployment"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const renameDeployment = d.useRenameDeployment();
  const deploymentName = d.useDeploymentName(action.dseq, action.from);

  return (
    <d.ActionCardChrome
      title="Rename the deployment"
      scope={<DeploymentLink dseq={action.dseq} name={deploymentName} />}
      tier={action.tier}
      decision={decision}
      diff={{ removed: action.from ? [action.from] : [], added: [action.to] }}
      costNote="Only the name shown in Console changes. The deployment keeps running."
      confirmLabel="Rename"
      successMessage={`Renamed to ${action.to}.`}
      onConfirm={() => renameDeployment(action.dseq, action.to)}
    />
  );
};
