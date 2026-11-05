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
import { keepsPricing, PRICING_CHANGE_MESSAGE } from "../pricingGuard/pricingGuard";

export const DEPENDENCIES = { useDeploymentDefinition, useRedeploy, useRouter, ActionCardChrome };

const DEFINITION_UNAVAILABLE_MESSAGE = "This deployment's configuration isn't available here. Redeploy it from its page instead.";

/** Opens Configure the way redeploy does, so an SDL based on a deployment inherits its secrets and is refused if it would move its pricing. */
export const OpenInEditorCard: FC<ActionCardProps<"open_in_editor"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const definition = d.useDeploymentDefinition(action.dseq, { acceptReferences: true });
  const redeploy = d.useRedeploy();
  const router = d.useRouter();
  const templateId = action.templateId ?? undefined;

  const openInEditor = async () => {
    if (!action.dseq) {
      if (action.sdl) redeploy({ sdl: action.sdl, templateId });
      else router.push(UrlService.configureDeployment({ templateId }));
      return;
    }

    if (!isUsableDeploymentDefinition(definition)) throw new Error(DEFINITION_UNAVAILABLE_MESSAGE);
    const currentSdl = sdlToRedeploy(definition);
    if (action.sdl && !keepsPricing(currentSdl, action.sdl)) throw new Error(PRICING_CHANGE_MESSAGE);
    redeploy({ sdl: action.sdl ?? currentSdl, name: definition.name, sourceDseq: action.dseq, templateId });
  };

  return (
    <d.ActionCardChrome
      title="Open in the editor"
      tier={action.tier}
      decision={decision}
      rows={rowsOf(action)}
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

function rowsOf(action: AssistantActionOf<"open_in_editor">): ActionCardRow[] {
  return [
    ...(action.dseq ? [{ label: "Based on deployment", value: action.dseq }] : []),
    ...(action.templateId ? [{ label: "Template", value: action.templateId }] : []),
    ...(action.dseq ? [{ label: "Secrets", value: "carried over" }] : [])
  ];
}
