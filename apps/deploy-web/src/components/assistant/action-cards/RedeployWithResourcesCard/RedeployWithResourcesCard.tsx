"use client";
import type { FC } from "react";
import isEqual from "lodash/isEqual";

import { isUsableDeploymentDefinition, sdlToRedeploy, useDeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import type { AssistantActionOf } from "@src/types/assistant";
import type { ActionCardDiff } from "../ActionCardChrome/ActionCardChrome";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { keepsPricing, PRICING_CHANGE_MESSAGE } from "../pricingGuard/pricingGuard";
import type { ServiceResources } from "../serviceResourcesFormat/serviceResourcesFormat";
import { computeLabelOf, gpuLabelOf } from "../serviceResourcesFormat/serviceResourcesFormat";
import { withServiceResources } from "./withServiceResources";

export const DEPENDENCIES = { useDeploymentDefinition, useRedeploy, ActionCardChrome };

const DEFINITION_UNAVAILABLE_MESSAGE = "This deployment's configuration isn't available here. Redeploy it from its page instead.";

/** Resources are fixed once a deployment exists, so the card opens a new one in the editor, prefilled and inheriting secrets, for the user to deploy. */
export const RedeployWithResourcesCard: FC<ActionCardProps<"redeploy_with_resources"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const definition = d.useDeploymentDefinition(action.dseq, { acceptReferences: true });
  const redeploy = d.useRedeploy();

  const openInEditor = async () => {
    if (!isUsableDeploymentDefinition(definition)) throw new Error(DEFINITION_UNAVAILABLE_MESSAGE);
    const sourceSdl = sdlToRedeploy(definition);
    const sdl = withServiceResources(sourceSdl, action.services);
    if (!keepsPricing(sourceSdl, sdl)) throw new Error(PRICING_CHANGE_MESSAGE);
    redeploy({ sdl, name: definition.name, sourceDseq: action.dseq });
  };

  return (
    <d.ActionCardChrome
      title={`Redeploy ${definition.name ?? `deployment ${action.dseq}`} with new resources`}
      tier={action.tier}
      decision={decision}
      diff={resourcesDiffOf(action.services)}
      rows={[
        { label: "Why", value: action.reason },
        ...(action.providersAbleToBid === null ? [] : [{ label: "Providers able to bid now", value: String(action.providersAbleToBid) }])
      ]}
      costNote="Opens a new deployment in the editor with your current secrets. The old one keeps running, and billing, until you close it."
      confirmLabel="Open in editor"
      successMessage="Opened in the editor. Review and deploy from there."
      isConfirmDisabled={definition.source === "resolving"}
      onConfirm={openInEditor}
    />
  );
};

function resourcesDiffOf(services: AssistantActionOf<"redeploy_with_resources">["services"]): ActionCardDiff {
  const prefixes = services.length > 1;
  const removed: string[] = [];
  const added: string[] = [];

  services.forEach(({ service, before, after }) => {
    const prefix = prefixes ? `${service}: ` : "";
    resourceLines(before, after).forEach(([beforeLine, afterLine]) => {
      removed.push(`${prefix}${beforeLine}`);
      added.push(`${prefix}${afterLine}`);
    });
  });

  return { removed, added, unchanged: "Image, env, ports and pricing unchanged" };
}

function resourceLines(before: ServiceResources, after: ServiceResources): [string, string][] {
  const lines: [string, string][] = [];
  if (before.cpu !== after.cpu || before.memory !== after.memory || !isEqual(before.storage, after.storage)) {
    lines.push([`CPU / memory / storage: ${computeLabelOf(before)}`, `CPU / memory / storage: ${computeLabelOf(after)}`]);
  }
  if (!isEqual(before.gpu, after.gpu)) lines.push([`GPU: ${gpuLabelOf(before.gpu)}`, `GPU: ${gpuLabelOf(after.gpu)}`]);
  if (before.count !== after.count) lines.push([`replicas: ${before.count ?? 1}`, `replicas: ${after.count ?? 1}`]);
  return lines;
}
