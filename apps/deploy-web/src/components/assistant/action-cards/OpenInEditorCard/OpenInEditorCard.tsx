"use client";
import type { FC } from "react";
import { useRouter } from "next/navigation";

import { isUsableDeploymentDefinition, sdlToRedeploy, useDeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import type { AssistantActionOf } from "@src/types/assistant";
import { UrlService } from "@src/utils/urlUtils";
import type { ActionCardRow } from "../ActionCardChrome/ActionCardChrome";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { assertOpensInEditor } from "../assertOpensInEditor/assertOpensInEditor";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import { keepsPricing, PRICING_CHANGE_MESSAGE } from "../pricingGuard/pricingGuard";
import { useDeploymentName } from "../useDeploymentName/useDeploymentName";
import { keepsSecretsWithTheirServices } from "./keepsSecretsWithTheirServices";

export const DEPENDENCIES = { useDeploymentDefinition, useRedeploy, useRouter, useDeploymentName, ActionCardChrome };

const DEFINITION_UNAVAILABLE_MESSAGE = "This deployment's configuration isn't available here. Redeploy it from its page instead.";

/** Opens Configure the way redeploy does; an SDL based on a deployment is refused if it would move its pricing, and inherits its secrets only where they stay with their services. */
export const OpenInEditorCard: FC<ActionCardProps<"open_in_editor"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const definition = d.useDeploymentDefinition(action.dseq, { acceptReferences: true });
  const deploymentName = d.useDeploymentName(action.dseq, definition.name);
  const redeploy = d.useRedeploy();
  const router = d.useRouter();
  const templateId = action.templateId ?? undefined;
  const currentSdl = isUsableDeploymentDefinition(definition) ? sdlToRedeploy(definition) : undefined;
  const inheritsSecrets = !action.sdl || (!!currentSdl && keepsSecretsWithTheirServices(currentSdl, action.sdl));

  const openInEditor = async () => {
    if (!action.dseq) {
      if (!action.sdl) return router.push(UrlService.configureDeployment({ templateId }));
      assertOpensInEditor(action.sdl);
      return redeploy({ sdl: action.sdl, templateId });
    }

    if (!currentSdl) throw new Error(DEFINITION_UNAVAILABLE_MESSAGE);
    if (action.sdl && !keepsPricing(currentSdl, action.sdl)) throw new Error(PRICING_CHANGE_MESSAGE);
    const sdl = action.sdl ?? currentSdl;
    assertOpensInEditor(sdl);
    redeploy({ sdl, name: definition.name, templateId, ...(inheritsSecrets ? { sourceDseq: action.dseq } : {}) });
  };

  return (
    <d.ActionCardChrome
      title="Open in the editor"
      tier={action.tier}
      decision={decision}
      rows={rowsOf(action, { inheritsSecrets, deploymentName })}
      costNote="Nothing is deployed until you review it and click Deploy in the editor."
      confirmLabel="Open in editor"
      successMessage="Opened in the editor."
      isConfirmDisabled={!!action.dseq && definition.source === "resolving"}
      onConfirm={openInEditor}
    >
      {action.sdl && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">SDL</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs">{action.sdl}</pre>
        </details>
      )}
    </d.ActionCardChrome>
  );
};

function rowsOf(
  action: AssistantActionOf<"open_in_editor">,
  { inheritsSecrets, deploymentName }: { inheritsSecrets: boolean; deploymentName: string | null }
): ActionCardRow[] {
  return [
    ...(action.dseq ? [{ label: "Based on deployment", value: <DeploymentLink dseq={action.dseq} name={deploymentName} /> }] : []),
    ...(action.templateId ? [{ label: "Template", value: action.templateId }] : []),
    ...(action.dseq ? [{ label: "Secrets", value: inheritsSecrets ? "carried over" : "re-enter them in the editor" }] : [])
  ];
}
