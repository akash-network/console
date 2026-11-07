"use client";
import type { FC } from "react";

import { isUsableDeploymentDefinition, useDeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { useSaveUserTemplate } from "@src/queries/useTemplateQuery";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import { useDeploymentName } from "../useDeploymentName/useDeploymentName";

export const DEPENDENCIES = { useDeploymentDefinition, useSaveUserTemplate, useDeploymentName, ActionCardChrome };

export const SaveAsTemplateCard: FC<ActionCardProps<"save_as_template"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const definition = d.useDeploymentDefinition(action.dseq);
  const deploymentName = d.useDeploymentName(action.dseq, definition.name);
  const { mutateAsync: saveTemplate } = d.useSaveUserTemplate();
  const isUsable = isUsableDeploymentDefinition(definition);
  const isResolving = definition.source === "resolving";

  return (
    <d.ActionCardChrome
      title="Save as a template"
      scope={<DeploymentLink dseq={action.dseq} name={deploymentName} />}
      tier={action.tier}
      decision={decision}
      rows={[
        { label: "Title", value: action.title },
        ...(action.description ? [{ label: "Description", value: action.description }] : []),
        { label: "Visibility", value: "Private, only you" }
      ]}
      costNote="Saves this deployment's SDL as Console holds it, so you can deploy it again later."
      confirmLabel="Save template"
      successMessage="Saved to your templates."
      isConfirmDisabled={!isUsable}
      onConfirm={async () => {
        if (!isUsable) return;
        await saveTemplate({ sdl: definition.sdl, title: action.title, description: action.description ?? undefined, isPublic: false });
      }}
    >
      {isResolving && <p className="text-sm text-muted-foreground">Reading the deployment…</p>}
      {!isResolving && !isUsable && (
        <p className="text-sm text-muted-foreground">Console holds no usable copy of this deployment&apos;s SDL, so it can&apos;t be saved as a template.</p>
      )}
    </d.ActionCardChrome>
  );
};
