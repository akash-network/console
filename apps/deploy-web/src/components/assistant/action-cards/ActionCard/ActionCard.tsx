"use client";
import type { FC } from "react";

import type { AssistantAction } from "@src/types/assistant";
import { useFollowDeployment } from "../../useFollowDeployment/useFollowDeployment";
import { ACTION_CARD_REGISTRY } from "../actionCardRegistry";
import type { ActionCardComponent, ActionCardRegistry } from "../actionCardTypes";
import { GenericActionCard } from "../GenericActionCard/GenericActionCard";
import { useActionCardDecision } from "../useActionCardDecision/useActionCardDecision";

export const DEPENDENCIES = { useActionCardDecision, useFollowDeployment, GenericActionCard };

type Props = {
  conversationId: string | null;
  proposalId: string;
  action: AssistantAction;
  registry?: ActionCardRegistry;
  continueConversation?: (message: string) => void;
  dependencies?: typeof DEPENDENCIES;
};

/** Renders a proposal from its typed data only, never from the assistant's prose, so nothing the model writes can change what Confirm does. */
export const ActionCard: FC<Props> = ({
  conversationId,
  proposalId,
  action,
  registry = ACTION_CARD_REGISTRY,
  continueConversation,
  dependencies: d = DEPENDENCIES
}) => {
  const followDeployment = d.useFollowDeployment();
  const decision = d.useActionCardDecision({ conversationId, proposalId, actionType: action.type, ...followedDeploymentOf(action, followDeployment) });
  const Card = registry[action.type] as ActionCardComponent<typeof action.type> | undefined;

  return Card ? (
    <Card action={action} decision={decision} continueConversation={continueConversation} />
  ) : (
    <d.GenericActionCard action={action} decision={decision} />
  );
};

function followedDeploymentOf(action: AssistantAction, followDeployment: (dseq: string) => void) {
  switch (action.type) {
    case "create_deployment":
      return { followDeployment };
    case "update_deployment":
    case "close_deployment":
    case "choose_bid":
      return { dseq: action.dseq, followDeployment };
    default:
      return {};
  }
}
