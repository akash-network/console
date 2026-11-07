"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";

import { sdlToRedeploy, useDeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import type { ActionCardRow } from "../ActionCardChrome/ActionCardChrome";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { isResourcesChanged, useAssistantDeploymentPatch } from "../useAssistantDeploymentPatch/useAssistantDeploymentPatch";
import { deploymentLabelOf, useDeploymentName } from "../useDeploymentName/useDeploymentName";
import { updateDeploymentDiff } from "./updateDeploymentDiff";

export const DEPENDENCIES = { useAssistantDeploymentPatch, useDeploymentDefinition, useRedeploy, useDeploymentName, ActionCardChrome };

const NEEDS_REDEPLOY_MESSAGE = "This change needs a new deployment. Redeploy in the editor to apply it.";

export const UpdateDeploymentCard: FC<ActionCardProps<"update_deployment"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const patch = d.useAssistantDeploymentPatch();
  const deploymentName = d.useDeploymentName(action.dseq, action.name);
  const [needsRedeploy, setNeedsRedeploy] = useState(false);
  const definition = d.useDeploymentDefinition(needsRedeploy ? action.dseq : null, { acceptReferences: true });
  const redeploy = d.useRedeploy();
  const diff = updateDeploymentDiff(action.services);
  const rows: ActionCardRow[] = [
    { label: "Resources, provider, lease", value: "unchanged" },
    ...(diff.restartsContainer ? [{ label: "Downtime", value: "container restarts once" }] : [])
  ];

  const applyUpdate = async () => {
    const services = Object.fromEntries(action.services.map(({ service, patch: servicePatch }) => [service, servicePatch]));
    try {
      await patch({ dseq: action.dseq, services, ifManifestVersion: action.manifestVersion });
    } catch (cause) {
      if (!isResourcesChanged(cause)) throw cause;
      setNeedsRedeploy(true);
      throw new Error(NEEDS_REDEPLOY_MESSAGE, { cause });
    }
  };

  const redeployInEditor = () => {
    const sdl = sdlToRedeploy(definition);
    if (sdl) redeploy({ sdl, name: definition.name, sourceDseq: action.dseq });
  };

  return (
    <d.ActionCardChrome
      title={`Update ${deploymentLabelOf(deploymentName)}`}
      scope={scopeOf(action.services.map(({ service }) => service))}
      tier={action.tier}
      decision={decision}
      diff={{ removed: diff.removed, added: diff.added, unchanged: diff.unchanged }}
      rows={rows}
      costNote={diff.newDomains.length > 0 ? `Add a CNAME record for ${diff.newDomains.join(", ")} that points to this service's current URI.` : undefined}
      confirmLabel="Apply update"
      successMessage="Update sent. Follow the rollout in Activities."
      onConfirm={applyUpdate}
    >
      {needsRedeploy && (
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={!definition.sdl} onClick={redeployInEditor}>
          Redeploy in the editor
        </Button>
      )}
    </d.ActionCardChrome>
  );
};

function scopeOf(services: string[]): string {
  return services.length === 1 ? `service: ${services[0]}` : `${services.length} services`;
}
